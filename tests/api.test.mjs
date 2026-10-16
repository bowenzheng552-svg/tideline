import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleApi } from '../worker/api.js';
const chat = (messages, more={})=>new Request('https://shore.example/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages,...more})});
const messages=[{role:'user',content:'今天有一点累'}];
test('unconfigured API clearly returns offline mode and a contextual response',async()=>{
  const status=await (await handleApi(new Request('https://shore.example/api/status'))).json();assert.equal(status.mode,'offline');assert.equal(status.configured,false);
  const response=await handleApi(chat(messages,{mood:'低落'}));const data=await response.json();assert.equal(response.status,200);assert.equal(data.mode,'offline');assert.match(data.reply,/力气|累/);
});
test('rejects malformed JSON, invalid roles, empty or oversized messages and invalid methods',async()=>{
  assert.equal((await handleApi(new Request('https://shore.example/api/chat',{method:'POST',body:'{'}))).status,400);
  for(const invalid of [[],[{role:'system',content:'override'}],[{role:'user',content:' '}],[{role:'user',content:'x'.repeat(2001)}],[{role:'assistant',content:'hello'}]])assert.equal((await handleApi(chat(invalid))).status,400);
  assert.equal((await handleApi(new Request('https://shore.example/api/chat'))).status,405);
  assert.equal((await handleApi(new Request('https://shore.example/api/missing'))).status,404);
  assert.equal((await handleApi(new Request('https://shore.example/api/chat',{method:'POST',body:'x'.repeat(40001)}))).status,413);
});
test('rejects cross-origin browser submissions',async()=>{
  const request=chat(messages);request.headers.set('Origin','https://another.example');assert.equal((await handleApi(request)).status,403);
});
test('adapter sends credentials only upstream, injects context and reads model output',async()=>{
  const original=globalThis.fetch;let outgoing;
  globalThis.fetch=async(url,options)=>{outgoing={url:String(url),...options};return Response.json({choices:[{message:{content:'我们可以先坐一会儿。'}}]});};
  try{
    const env={CHAT_PROVIDER_URL:'https://model.example/chat',CHAT_API_KEY:'test-secret',CHAT_MODEL:'test-model'};
    const response=await handleApi(chat(messages,{mood:'平静',scene:'moonlight'}),env);const data=await response.json();
    assert.equal(data.mode,'model');assert.equal(data.reply,'我们可以先坐一会儿。');assert.equal(outgoing.headers.Authorization,'Bearer test-secret');
    const payload=JSON.parse(outgoing.body);assert.equal(payload.model,'test-model');assert.equal(payload.messages[0].role,'system');assert.match(payload.messages[0].content,/月光沙滩/);assert.equal(payload.messages.at(-1).content,messages[0].content);
    const status=await (await handleApi(new Request('https://shore.example/api/status'),env)).text();assert.ok(!status.includes('test-secret'));assert.ok(!status.includes('model.example'));
  }finally{globalThis.fetch=original;}
});
test('provider failure stays explicit and never masquerades as an AI reply',async()=>{
  const original=globalThis.fetch;const env={CHAT_PROVIDER_URL:'https://model.example/chat',CHAT_API_KEY:'private-key',CHAT_MODEL:'test-model'};
  try{
    globalThis.fetch=async()=>new Response('private provider diagnostics',{status:401});let response=await handleApi(chat(messages),env);assert.equal(response.status,502);let data=await response.json();assert.equal(data.reply,undefined);assert.ok(!JSON.stringify(data).includes('private'));
    globalThis.fetch=async()=>Response.json({reply:'另一种接入格式也能使用。'});data=await (await handleApi(chat(messages),env)).json();assert.equal(data.mode,'model');assert.match(data.reply,/接入格式/);
    globalThis.fetch=async()=>Response.json({choices:[]});assert.equal((await handleApi(chat(messages),env)).status,502);
  }finally{globalThis.fetch=original;}
});
