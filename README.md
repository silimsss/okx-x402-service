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
npm test           # 冒烟测试
```

## 启用 x402 收款

```bash
cp .env.example .env   # 填入 PAY_TO_ADDRESS 与 OKX API Key 三件套
npm install @okxweb3/x402-express @okxweb3/x402-core @okxweb3/x402-evm
npm start
```

配置后，付费接口返回 HTTP 402 与 `PAYMENT-REQUIRED` 头；客户端通过 Agentic Wallet
支付后自动重试，服务端经 OKX facilitator 验证后放行。未配置时付费接口直接放行，
便于本地调试。

## 配置

| 变量 | 说明 |
| --- | --- |
| `PORT` | 服务端口，默认 `4000` |
| `OKX_API_KEY` / `OKX_SECRET_KEY` / `OKX_PASSPHRASE` | x402 收款所需的 OKX 开发者 API 三件套 |
| `PAY_TO_ADDRESS` | 收款地址；未设置时回落到内置的 Agentic Wallet 地址 |
| `X402_NETWORK` | 支付网络，默认 `eip155:196`（X Layer） |
| `PRICE` | 单价，默认 `$0.05` |
| `OKX_BASE` | OKX 行情接口地址，默认 `https://www.okx.com` |

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
