# 部署到公网（Render，从 GitHub 自动部署）

本项目是服务端应用（密钥留在服务器，不进浏览器），不能只靠 GitHub Pages 运行。
最简单的方式：把代码推到 GitHub，再用 Render 从 GitHub 拉取并运行 Node 服务，拿到免费公网域名。

## 一键部署

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/bowenzheng552-svg/tideline)

点击后按提示连接 GitHub、选择本仓库即可。Render 会读取仓库里的 `render.yaml`：
- 构建：`npm ci && npm run build`
- 启动：`node scripts/serve.mjs`（监听 `0.0.0.0:$PORT`）
- 需在 Render 控制台手动填入环境变量 `CHAT_API_KEY`（你的 DeepSeek 密钥）

## 手动部署

1. 在 Render 新建 Web Service，连接 GitHub 仓库 `bowenzheng552-svg/tideline`。
2. 运行环境选 Node，构建命令 `npm ci && npm run build`，启动命令 `node scripts/serve.mjs`。
3. 环境变量：
   - `CHAT_PROVIDER_URL=https://api.deepseek.com/v1/chat/completions`
   - `CHAT_MODEL=deepseek-chat`
   - `CHAT_API_KEY=你的 DeepSeek 密钥`（标记为 secret）
4. 部署完成后，Render 给出一个 `https://tideline.onrender.com` 公网地址。

## 网页内直接连接你的大模型（无需改服务端配置）

部署后，访客打开页面右上角齿轮「模型连接设置」，在「连接你的大模型」里填写：

- API 地址：OpenAI 兼容的 `/chat/completions` 接口，例如 `https://api.deepseek.com/v1/chat/completions`
- API Key：你的服务商密钥
- 模型名：例如 `deepseek-chat`

保存后，每次聊天会把这份配置随请求发给服务端代为调用，密钥只保存在本机浏览器、只在调用时发送，不进前端代码。服务端 `worker/api.js` 会以请求里的配置覆盖环境变量（两者任一齐备即为在线陪伴）。这样即使服务端环境变量没填，也能在页面里直接接上模型。

## 本地试玩（不受影响）

仍用 `node scripts/play.mjs`，访问 http://127.0.0.1:4173 。

## 安全

- `.env.local`、`.env`、`dist/` 已在 `.gitignore` 中，不会进入仓库。
- `CHAT_API_KEY` 只存在于运行环境（本地 `.env.local` 或 Render secret），不会出现在代码或浏览器。
- 转发仓库给他人时，记得让他们自己填 `CHAT_API_KEY`。
