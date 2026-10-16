# 潮汐之间 · 情绪陪伴海滩 MVP

固定场景、半开放漫步的浏览器小游戏。原创的小旅人「小屿」在海边陪伴玩家。视觉以低多边形石景、柔和海天渐变、暖金围巾和缓慢潮汐构成；角色和几何场景均由代码制作，无需下载游戏美术资源。

## 试玩内容

- 日落海滩 / 月光沙滩平滑切换，动态海水、岸线浪花、飞鸟、草丛和光点。
- WASD、方向键或点击沙滩移动，拖动环顾。活动范围由两侧石景与海岸限定。
- 小屿陪伴聊天；默认提供明确标记的离线精选对话，接入模型后使用真实模型回复。
- 平静、开心、低落、焦虑、说不清五种心情，可为聊天提供上下文。
- 心事漂流瓶：纸条不存储，提交后清空并出现漂流动画。
- 三轮潮汐呼吸：每轮吸气 4 秒、停留 2 秒、呼气 6 秒。
- Web Audio 合成海浪与海风，可分别控制音量及总音量。需要主动点击开启；音量偏好保存在本机。
- 沉浸看海、移动端布局与键盘可访问的设置。

## 本地运行

需要 Node.js 22+。

```sh
npm install
npm run dev
```

打开 http://127.0.0.1:4173 。使用本机 Chrome / Edge 等支持 WebGL 2 的现代浏览器。首次构建会打包 Three.js；运行时无需从 CDN 加载游戏脚本。Google Fonts 不可用时使用系统中文字体。

```sh
npm test
npm run build
npm run validate
```

构建输出 `dist/server/index.js` 是包含页面、样式、游戏脚本与 API 的单文件 Worker，`dist/.openai/hosting.json` 保留 Sites 项目标识。修改源码后重启本地服务以重新构建。

## 接入大语言模型

本地将 `.env.example` 复制为 `.env.local`，填写以下变量后重启服务。线上通过 Sites 的服务端环境变量管理配置；将密钥标记为 secret，重新部署后生效。

```dotenv
CHAT_PROVIDER_URL=https://your-provider.example/v1/chat/completions
CHAT_API_KEY=your-server-side-secret
CHAT_MODEL=your-model-id
```

`CHAT_PROVIDER_URL` 是完整的 HTTPS 对话接口地址。请求使用 Bearer 鉴权，JSON 包含 `model`、`messages`、`temperature`、`stream: false`。接口支持以下任一回复格式：

```json
{ "choices": [{ "message": { "content": "模型回复" } }] }
```

```json
{ "reply": "模型回复" }
```

如服务商使用其他协议，在 `worker/api.js` 内调整服务端适配器即可。客户端始终调用同源接口，密钥不会发往浏览器。连接状态仅表示变量配置是否完整，实际可用性由首次模型回复验证。

### 对话接口

`POST /api/chat`，`Content-Type: application/json`：

```json
{
  "messages": [{ "role": "user", "content": "今天有一点累" }],
  "mood": "低落",
  "scene": "sunset"
}
```

```json
{ "reply": "今天似乎花掉了你很多力气……", "mode": "offline" }
```

配置完整时 `mode` 为 `model`。允许 1–16 条 `user` / `assistant` 消息，每条最多 2000 字，末条必须为 `user`；客户端携带最近 15 条上下文。服务端注入独立角色提示词。场景接受 `sunset` / `moonlight`；心情接受界面上的五种标签。

错误使用 400 / 403 / 405 / 413 / 502 状态和 `{ "error": "可读说明" }`。模型调用超时为 20 秒，失败时保留明确的错误提示，允许玩家重试。

`GET /api/status` 返回 `{ "mode": "offline", "configured": false, "character": "小屿", "version": "1.0.0" }`，不泄露密钥或服务商地址。

Sites 私有站点沿用平台访问权限。外部程序调用私有站点需使用平台支持的服务访问授权；API 不设置跨域开放策略。若后续开放给多人，应同步加入持久的配额与速率限制。

## MVP 边界与数据

聊天仅在当前页面内存中保留，刷新后清空。接入模型后，最近的聊天上下文、心情和场景会传给所配置的模型服务商。漂流瓶文字只在输入期间存在，提交后清空。音量偏好存储在 `localStorage`。

首版聚焦单玩家、一个场景、一个伙伴。暂未加入账号存档、多人、语音识别、语音合成、任务系统或长期记忆。海浪与海风使用程序合成；后续可替换为高质量实地录音。小屿提供日常情绪陪伴。

## 源码结构

- `src/world.js`：Three.js 场景、角色、海水 / 天空 shader、移动与漂流动画。
- `src/app.js`：界面、聊天、心情和呼吸练习。
- `src/audio.js`：海浪与海风合成、混音。
- `src/index.html` / `src/style.css`：响应式界面。
- `worker/api.js`：服务端聊天适配器与离线模式。
- `scripts/build.mjs`：打包为自包含 Worker。
- `tests/api.test.mjs`：接口输入验证、模式区分与模型适配测试。

图形运行时参考 [Three.js 官方文档](https://threejs.org/docs/)。
