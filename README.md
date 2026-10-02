# Crypto Market Pulse

读取 OKX 公开行情，生成 BTC/ETH/SOL 等交易对的技术面快报，通过 x402 协议按次收费。

## 接口

| 路由 | 定价 | 内容 |
| --- | --- | --- |
| `GET /health` | 免费 | 健康检查 |
| `GET /v1/preview/:instId` | 免费 | 预览版：现价、24h 涨跌、市场状态 |
| `GET /v1/brief/:instId` | $0.05/次（x402） | 完整版：RSI(14)、趋势、20 日高低位、年化波动率，含 JSON 与 Markdown 报告 |

`instId` 支持任意 OKX USDT 交易对，如 `BTC-USDT`、`ETH-USDT`、`SOL-USDT`。

## 本地运行

```bash
npm install
npm start          # 未配置收款时以开发模式运行
npm test           # 全部测试
```

## 启用 x402 收款

```bash
cp .env.example .env   # 填入 PAY_TO_ADDRESS 与 OKX API Key 三件套
npm install @okxweb3/x402-express @okxweb3/x402-core @okxweb3/x402-evm
npm start
```

配置后，付费接口返回 HTTP 402 与 `PAYMENT-REQUIRED` 头（base64 JSON）；客户端通过
Agentic Wallet 支付后自动重试，服务端经 OKX facilitator 验证后放行。未配置时付费接口
直接放行，便于本地调试。

## 多链结算

同一个收款地址可以同时接收两条链的付款。设了 `BASE_PAY_TO` 后，服务会在每条付费路由的
`accepts` 里追加 Base（`eip155:8453` / USDC）选项，与 X Layer（`eip155:196` / USD₮0）
同价并列——买家用哪个钱包都能付。

Base 通道走 Coinbase CDP 托管 facilitator，需要免费 API Key（`CDP_API_KEY_ID` /
`CDP_API_KEY_SECRET`），每月前 1000 笔链上交易免费。启动时会先探测 facilitator 是否真的
支持 Base，**探测不通自动降级**：只关 Base 通道，X Layer 不受影响，`/health` 里能直接
看到当前各链状态。

> 📖 开通步骤见 [CDP_SETUP.md](CDP_SETUP.md)（分步操作手册 + 故障排查表）。

```jsonc
// GET /health
{ "x402": "enabled", "channels": { "eip155:196": "usdt0", "eip155:8453": "usdc", "eip155:56": "pending-merchant-onboarding" } }
```

实现要点见 [src/multichain.js](src/multichain.js) 与 [src/cdp-auth.js](src/cdp-auth.js)。

## 测试

```bash
npm test              # 原有冒烟 + CDP JWT 单测 + 多链回归
npm run test:auth     # 只跑 CDP JWT 单测（零依赖，秒级）
npm run test:multichain   # 5 种模式离线回归，全程 mock facilitator，不需外网
npm run validate:bazaar   # 调 Coinbase 免鉴权 validate 批量自检 8 个端点（需外网）
```

多链回归覆盖：仅 OKX 单通道 / Base 开关开但 CDP 不可达（应降级）/ 双通道正常（402 应同时
列出两条链）/ facilitator 全不可达（进程不崩、付费接口返回 503 不放行）/ 无 API Key 开发模式。

## 配置

| 变量 | 说明 |
| --- | --- |
| `PORT` | 服务端口，默认 `4000` |
| `OKX_API_KEY` / `OKX_SECRET_KEY` / `OKX_PASSPHRASE` | x402 收款所需的 OKX 开发者 API 三件套 |
| `PAY_TO_ADDRESS` | 收款地址；未设置时回落到内置的 Agentic Wallet 地址 |
| `X402_NETWORK` | 支付网络，默认 `eip155:196`（X Layer） |
| `PRICE` | 单价，默认 `$0.05` |
| `OKX_BASE` | OKX 行情接口地址，默认 `https://www.okx.com` |
| `BASE_PAY_TO` | Base 收款地址；设了才尝试启用 Base 通道 |
| `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` | Coinbase CDP API Key（免费注册） |
| `X402_INIT_TIMEOUT_MS` | 支付中间件初始化超时，默认 `20000` |
| `BASE_PROBE_TIMEOUT_MS` | Base facilitator 探测超时，默认 `8000` |

## 部署

```bash
docker build -t crypto-market-pulse .
docker run -p 4000:4000 --env-file .env crypto-market-pulse
```

服务器需能访问 `www.okx.com`，无其他依赖。

仓库内 `deploy/hf-space/` 提供了 Hugging Face Space（Docker 类型）的入口脚本：
`app.py` 监听平台要求的 7860 端口并反代到服务的 4000 端口，含健康探活。其他支持
Docker 的平台（Render、Fly.io、VPS 等）可直接使用根目录 `Dockerfile`。

## License

MIT
