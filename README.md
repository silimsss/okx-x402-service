# Crypto Market Pulse — OKX.AI x402 付费行情快报服务

第一个可上架 OKX.AI 的 A2MCP 赚钱资产。对标广场已验证的畅销品类
（BTC 简报 0.05U/次、缠论指标 0.1U/次售出 8,580 次）。

## 接口

| 路由 | 定价 | 内容 |
|---|---|---|
| `GET /health` | 免费 | 健康检查 |
| `GET /v1/preview/:instId` | 免费 | 预览版（现价/24h 涨跌/市场状态），引流用 |
| `GET /v1/brief/:instId` | x402 $0.05/次 | 完整版：RSI、趋势、20日高低位、年化波动率、中文 Markdown 报告 |

支持任意 OKX 币本位 USDT 交易对，如 `BTC-USDT`、`ETH-USDT`、`SOL-USDT`。

## 本地运行

```bash
npm install
npm start          # 开发模式（付费接口放行）
npm test           # 冒烟测试
```

## 启用真实收款（x402）

```bash
cp .env.example .env   # 填入 PAY_TO_ADDRESS 和 OKX API Key 三件套
npm install @okxweb3/x402-express @okxweb3/x402-core @okxweb3/x402-evm
npm start
```

配置后付费接口返回 HTTP 402 + PAYMENT-REQUIRED 头，客户端用
Agentic Wallet 支付后自动重试，服务端经 OKX facilitator 验证后放行。

## 部署

```bash
docker build -t crypto-market-pulse .
docker run -p 4000:4000 --env-file .env crypto-market-pulse
```

云服务器要求：能访问 `www.okx.com`（拉行情）即可，无其他依赖。
