const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = __dirname;
const port = Number(process.env.PORT) || 4183;
const host = process.env.HOST || "0.0.0.0";
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

const anchors = {
  平静: "就沿着这份平静待一会儿吧。海面没有催你，今晚也不需要急着成为谁。",
  开心: "把这一点小小的光收好。它不喧闹，却足够照亮今天剩下的路。",
  低落: "不用马上振作。让难过在岸边坐一会儿，我会陪你把这段潮水听完。",
  焦虑: "先看近一点的地方，比如脚边这一小片沙。我们不用一次想完所有事情。",
  说不清: "说不清也没关系。感受不需要先有名字，才值得被认真接住。",
};

const musicCache = new Map();
const bottleFile = path.join(root, "data", "bottles.json");

function readBottles() {
  try {
    const bottles = JSON.parse(fs.readFileSync(bottleFile, "utf8"));
    if (!Array.isArray(bottles) || !bottles.length) throw new Error("empty bottle shore");
    return bottles;
  } catch {
    const seeded = [
      {
        id: crypto.randomUUID(),
        text: "今天在海边坐了很久。没有发生什么大事，只是忽然想允许自己慢一点。",
        from: "一位路过的旅人",
        clientId: "shore-seed",
        createdAt: new Date().toISOString(),
        replies: [
          {
            text: "慢一点也很好，海会替你收着这段黄昏。",
            from: "潮汐之间",
            createdAt: new Date().toISOString(),
          },
        ],
      },
    ];
    writeBottles(seeded);
    return seeded;
  }
}

function writeBottles(bottles) {
  fs.mkdirSync(path.dirname(bottleFile), { recursive: true });
  const temp = `${bottleFile}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(bottles, null, 2));
  fs.renameSync(temp, bottleFile);
}

function publicBottle(bottle) {
  return {
    id: bottle.id,
    text: bottle.text,
    from: bottle.from || "一位旅人",
    createdAt: bottle.createdAt,
    replies: (bottle.replies || []).slice(-8),
  };
}

function offlineReply(mood, messages) {
  const latest = [...messages].reverse().find((item) => item?.role === "user")?.content || "";
  if (/睡|失眠|半夜/.test(latest)) {
    return "先不用努力睡着。把肩膀放松一点，听四次海浪，再慢慢呼一口气。今晚只要休息，不用解决什么。";
  }
  if (/累|疲惫|撑不住|没力气/.test(latest)) {
    return "你已经走了很远。现在可以什么都不做，先让身体靠在这片沙滩上。疲惫不是做得不够好。";
  }
  if (/想太多|焦虑|担心|害怕/.test(latest)) {
    return "脑海里的浪一下子太密了。我们先只管下一次呼吸：慢慢吸气，再让肩膀落下来。其他的，晚一点再说。";
  }
  if (/谢谢|好多了|舒服/.test(latest)) {
    return "我也很高兴，这一刻的你轻了一点点。海会一直在这里，你也可以随时回来。";
  }
  return anchors[mood] || "我在听。你可以慢慢说，不用把话整理得很完整。";
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function modelReply(body) {
  const config = body.config || {};
  const endpoint =
    config.url || process.env.CHAT_PROVIDER_URL || "https://text.pollinations.ai/openai";
  const key = config.key || process.env.CHAT_API_KEY || "anonymous";
  const model = config.model || process.env.CHAT_MODEL || "openai";
  const messages = [
    {
      role: "system",
      content:
        `你是海边陪伴者“小屿”。请用简短、温柔、具体的中文回应，先接住情绪，不评判、不说教、不诊断。` +
        `用户当前心情：${body.mood || "说不清"}；场景：${body.scene === "moonlight" ? "月光沙滩" : "日落海滩"}。` +
        `每次回复控制在 80 字以内，不使用列表。`,
    },
    ...body.messages.slice(-12),
  ];

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.url || process.env.CHAT_PROVIDER_URL
        ? { Authorization: `Bearer ${key}` }
        : {}),
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.82,
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!response.ok) throw new Error(`模型服务返回 ${response.status}`);
  const payload = await response.json();
  return (
    (typeof payload.reply === "string" && payload.reply) ||
    payload.choices?.[0]?.message?.content ||
    null
  );
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": contentTypes[".json"],
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (url.pathname === "/api/status" && request.method === "GET") {
    const freeModel = !process.env.CHAT_PROVIDER_URL;
    sendJson(response, 200, { mode: "model", configured: true, freeModel });
    return;
  }

  if (url.pathname === "/api/music" && request.method === "GET") {
    const query = (url.searchParams.get("q") || "海浪 钢琴").trim().slice(0, 80);
    try {
      let results = musicCache.get(query);
      if (!results) {
        const endpoint = new URL("https://itunes.apple.com/search");
        endpoint.searchParams.set("term", query);
        endpoint.searchParams.set("entity", "song");
        endpoint.searchParams.set("limit", "10");
        const musicResponse = await fetch(endpoint, { signal: AbortSignal.timeout(12000) });
        if (!musicResponse.ok) throw new Error(`音乐服务返回 ${musicResponse.status}`);
        const payload = await musicResponse.json();
        results = (payload.results || [])
          .filter((item) => item.previewUrl)
          .map((item) => ({
            title: item.trackName,
            artist: item.artistName,
            cover: item.artworkUrl60,
            preview: item.previewUrl,
          }));
        musicCache.set(query, results);
      }
      sendJson(response, 200, { results });
    } catch (error) {
      sendJson(response, 502, {
        error: "海风暂时没有送来音乐，请换一个关键词。",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  if (url.pathname === "/api/bottles/random" && request.method === "GET") {
    const clientId = url.searchParams.get("clientId") || "";
    const seen = new Set((url.searchParams.get("seen") || "").split(",").filter(Boolean));
    const bottles = readBottles().filter(
      (bottle) => bottle.clientId !== clientId && !seen.has(bottle.id),
    );
    if (!bottles.length) {
      sendJson(response, 200, { bottle: null });
      return;
    }
    sendJson(response, 200, {
      bottle: publicBottle(bottles[Math.floor(Math.random() * bottles.length)]),
    });
    return;
  }

  if (url.pathname === "/api/bottles" && request.method === "POST") {
    try {
      const body = await readJson(request);
      const text = String(body.text || "").trim().slice(0, 500);
      if (!text) {
        sendJson(response, 400, { error: "瓶子里还没有写下心事。" });
        return;
      }
      const bottles = readBottles();
      const bottle = {
        id: crypto.randomUUID(),
        text,
        from: String(body.from || "一位无名旅人").trim().slice(0, 24),
        clientId: String(body.clientId || "").slice(0, 80),
        createdAt: new Date().toISOString(),
        replies: [],
      };
      bottles.unshift(bottle);
      writeBottles(bottles);
      sendJson(response, 201, { bottle: publicBottle(bottle) });
    } catch {
      sendJson(response, 400, { error: "海风没有听清这只瓶子。" });
    }
    return;
  }

  const bottleReplyPath = url.pathname.match(/^\/api\/bottles\/([^/]+)\/reply$/);
  if (bottleReplyPath && request.method === "POST") {
    try {
      const body = await readJson(request);
      const text = String(body.text || "").trim().slice(0, 500);
      if (!text) {
        sendJson(response, 400, { error: "回信还没有写完。" });
        return;
      }
      const bottles = readBottles();
      const bottle = bottles.find((item) => item.id === bottleReplyPath[1]);
      if (!bottle) {
        sendJson(response, 404, { error: "这只瓶子已经随潮水走远了。" });
        return;
      }
      bottle.replies ||= [];
      bottle.replies.push({
        text,
        from: String(body.from || "一位无名旅人").trim().slice(0, 24),
        createdAt: new Date().toISOString(),
      });
      writeBottles(bottles);
      sendJson(response, 201, { bottle: publicBottle(bottle) });
    } catch {
      sendJson(response, 400, { error: "回信暂时没有送进瓶子。" });
    }
    return;
  }

  if (url.pathname === "/api/chat" && request.method === "POST") {
    let body = {};
    try {
      body = await readJson(request);
      if (!Array.isArray(body.messages)) {
        sendJson(response, 400, { error: "messages 必须是数组。" });
        return;
      }
      const generated = await modelReply(body);
      sendJson(response, 200, {
        reply: generated || offlineReply(body.mood, body.messages),
        mode: generated ? "model" : "offline",
      });
    } catch (error) {
      sendJson(response, 200, {
        reply:
          Array.isArray(body.messages) && body.messages.length
            ? offlineReply(body.mood, body.messages)
            : "我在听。网络暂时有些远，但你可以慢慢说。",
        mode: "offline",
        warning: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  const requestPath = decodeURIComponent(url.pathname);
  const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const filePath = path.resolve(root, relative);
  if (!filePath.startsWith(`${root}${path.sep}`) && filePath !== path.join(root, "index.html")) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": path.extname(filePath) === ".html" ? "no-cache" : "public, max-age=3600",
    });
    fs.createReadStream(filePath).pipe(response);
  });
});

server.listen(port, host, () => {
  console.log(`Tide Between is running at http://${host}:${port}`);
});
