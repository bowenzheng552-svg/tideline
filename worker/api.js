const MOODS=['平静','开心','低落','焦虑','说不清'];
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const configured=env=>!!(env.CHAT_PROVIDER_URL&&env.CHAT_API_KEY&&env.CHAT_MODEL);
const systemPrompt=`你是原创角色小屿，住在海边的小小旅人，披着绿色披风，围着暖金色围巾。你是温柔、平等、尊重边界的聊天伙伴。以自然简短的中文交流，每次2到4句话，认真回应对方刚说的具体事情。允许沉默和复杂心情，先听和理解，需要建议时给一个容易做到的小步骤。不说教，不诊断疾病，不假装治疗，不声称自己是人类，不承诺永远陪伴，不要求依赖你。避免“不是……而是……”及类似对照句式。不要每次都提海或呼吸；偶尔自然提及当前海边氛围。遇到明确的自伤意图时，温和认真地鼓励立即联系身边可信任的人和当地紧急援助，不编造热线号码。`;
function offlineReply(text,mood,count){
  if(/自杀|不想活|伤害自己|结束生命/.test(text))return '听到你这么说，我很担心你此刻的安全。先把可能伤到自己的东西放远一些，去一个有人的地方，联系一位你信任的人来陪你。如果你可能马上伤害自己，请立即联系当地急救或紧急服务。你愿意先告诉我，你现在身边有人吗？';
  const options=[
    [/累|疲惫|撑不住|辛苦/,'今天似乎花掉了你很多力气。我们可以先在这里坐一会儿，不急着把所有事情理清。如果愿意，可以告诉我，今天最让你累的是哪一件事？'],
    [/想太多|焦虑|担心|紧张|害怕|压力/,'脑子里装着很多事的时候，连安静下来都会有点费力。我在听。此刻反复出现的那个担心，是什么呢？'],
    [/孤独|孤单|没人|寂寞/,'一个人扛着这些感受，可能很难熬。现在我们可以一起坐在这里。你想说说，最近什么时候最希望身边有人吗？'],
    [/开心|高兴|快乐|好消息|太棒|幸福/,'听起来，你今天口袋里装着一小束光。愿意跟我讲讲发生了什么吗？我想认真听听这件让你开心的事。'],
    [/难过|低落|伤心|哭|难受|委屈/,'这份难受可以在这里放一会儿，不用急着收起来。你愿意从让你最委屈的那一刻说起吗？如果现在说不出来，我们就先一起看看海。'],
    [/工作|加班|老板|同事|上班/,'听起来，工作占去了你不少心力。此刻可以先把那里的节奏放远一点。今天有什么事情，让你一直挂在心上？'],
    [/睡|失眠/,'夜里清醒着的时候，很多念头也会跟着醒来。可以先把屏幕放远一些，调低声音，让身体找一个舒服的位置。有什么念头一直舍不得离开吗？'],
    [/陪我|看看海|看海|安静|不想说|沉默/,'好，我们就一起看看海。你可以暂时不说话，听一朵浪慢慢靠近，又慢慢退回去。我会在这里坐一会儿。'],
    [/谢谢|好多了|轻松/,'听见你这么说，我也觉得这阵风变轻了一点。愿你离开海边之后，也能给自己留一点这样的空隙。还想坐一会儿吗？'],
    [/你好|你是谁|名字|介绍/,'你好呀，我叫小屿，是住在这片海边的小旅人。我喜欢看光落在水面上的样子，也喜欢听人慢慢讲心事。今天的你，想从哪里说起？'],
    [/喜欢|爱|朋友|家人|关系|分手/,'这段关系似乎在你心里占着很重要的位置。你可以照自己的节奏，讲讲你们之间的事。此刻最牵动你的，是哪个片段？']
  ];
  const match=options.find(([pattern])=>pattern.test(text));if(match)return match[1];
  const starters={平静:'这份安静很珍贵，我们可以在这里多待一会儿。',开心:'我愿意听听你今天的小小欢喜。',低落:'今天的心情似乎有些沉，我在认真听。',焦虑:'心里有些紧绷的时候，可以先给自己一点缓冲。',说不清:'有些感受暂时还没有名字，也没有关系。'};
  const replies=['你愿意多说一点吗？刚才这句话里，哪个部分最想被听见？','我在听，也想更了解你此刻的感受。这件事对你来说，最在意的是什么？','我们可以慢慢聊，不用一下子说清楚。你希望此刻有人怎样陪着你？'];
  return (count<2?(starters[mood]||'谢谢你愿意把这段心事带到这里。'):'')+replies[count%replies.length];
}
async function readLimited(request){const reader=request.body?.getReader();if(!reader)return '';let total=0,parts=[];while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>40000){await reader.cancel();throw new Error('TOO_LARGE');}parts.push(value);}const bytes=new Uint8Array(total);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}return new TextDecoder().decode(bytes);}
export async function handleApi(request,env={}){
  const path=new URL(request.url).pathname;
  if(path==='/api/status'){if(request.method!=='GET')return json({error:'请使用 GET 请求。'},405);return json({mode:configured(env)?'model':'offline',configured:configured(env),character:'小屿',version:'1.0.0'});}
  if(path!=='/api/chat')return json({error:'接口不存在。'},404);
  if(request.method!=='POST')return json({error:'请使用 POST 请求。'},405);
  const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'请求来源不受支持。'},403);
  let data;try{data=JSON.parse(await readLimited(request));}catch(error){return json({error:error.message==='TOO_LARGE'?'消息过长，请分几次慢慢说。':'消息格式无效。'},error.message==='TOO_LARGE'?413:400);}
  if(!data||!Array.isArray(data.messages)||!data.messages.length||data.messages.length>16)return json({error:'请提供 1 至 16 条对话消息。'},400);
  if(data.messages.some(m=>!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string'||!m.content.trim()||m.content.length>2000))return json({error:'每条消息需要有效的角色和 1 至 2000 字内容。'},400);
  const messages=data.messages.map(m=>({role:m.role,content:m.content.trim()}));
  if(messages.at(-1).role!=='user')return json({error:'最后一条消息应来自用户。'},400);
  const mood=MOODS.includes(data.mood)?data.mood:'说不清';const scene=data.scene==='moonlight'?'月光沙滩':'日落海滩';
  if(!configured(env))return json({reply:offlineReply(messages.at(-1).content,mood,messages.filter(m=>m.role==='user').length-1),mode:'offline'});
  try{
    const provider=new URL(env.CHAT_PROVIDER_URL);if(provider.protocol!=='https:')throw new Error('CONFIG');
    const response=await fetch(provider,{method:'POST',headers:{'Authorization':`Bearer ${env.CHAT_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:env.CHAT_MODEL,messages:[{role:'system',content:systemPrompt+`\n当前场景：${scene}。用户自选心情：${mood}。心情标签仅供参考，不要据此下结论。`},...messages],temperature:.8,stream:false}),signal:AbortSignal.timeout(20000),redirect:'error'});
    if(!response.ok)return json({error:'海边的信号暂时有些弱，模型服务未能回应。请稍后重试。',code:'PROVIDER_ERROR'},502);
    const result=await response.json();let reply=result.reply??result.choices?.[0]?.message?.content;
    if(typeof reply!=='string'||!reply.trim())throw new Error('EMPTY_REPLY');
    return json({reply:reply.trim().slice(0,2000),mode:'model'});
  }catch(error){return json({error:/Timeout|Abort/.test(error.name)?'这次回应等得有些久，请稍后重试。':'模型连接暂时不可用，请检查服务端配置后再试。',code:'CONNECTION_ERROR'},502);}
}
