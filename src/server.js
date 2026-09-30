'use strict';
/**
 * Crypto Market Pulse — HTTP 服务
 *
 * 路由:
 *   GET /health                 -> 健康检查（免费）
 *   GET /v1/preview/:instId     -> 免费预览（引流/信誉积累）
 *   GET /v1/brief/:instId       -> 完整付费快报（x402: $0.05/次）
 *
 * x402 说明:
 *   按 OKX 官方推荐 @okxweb3/x402-express 接入。当配置了 OKX API Key
 *   （见 .env.example）时，付费接口受 402 支付保护；未配置时服务自动以
 *   "开发模式"运行（直接放行并在响应中标注），便于本地调试与测试网验证。
 */

const express = require('express');
const { buildBrief, toPreview } = require('./brief');

const app = express();
const PORT = process.env.PORT || 4000;

// ---- x402 支付保护（可选启用）---------------------------------
// 官方文档: https://web3.okx.com/zh-hans/onchainos/dev-docs/payments/service-seller-sdk
// 启用条件: .env 中配置 X402_NETWORK / PAY_TO_ADDRESS / OKX_API_KEY 三件套
const x402Enabled = !!process.env.OKX_API_KEY && !!process.env.PAY_TO_ADDRESS;

let paymentMiddleware = null;
if (x402Enabled) {
  try {
    // npm i @okxweb3/x402-express @okxweb3/x402-core @okxweb3/x402-evm
    const { paymentMiddleware: pm, x402ResourceServer } = require('@okxweb3/x402-express');
    const { ExactEvmScheme } = require('@okxweb3/x402-evm/exact/server');
    const { OKXFacilitatorClient } = require('@okxweb3/x402-core');

    const facilitator = new OKXFacilitatorClient({
      apiKey: process.env.OKX_API_KEY,
      secretKey: process.env.OKX_SECRET_KEY,
      passphrase: process.env.OKX_PASSPHRASE,
    });
    const resourceServer = new x402ResourceServer(facilitator);
    resourceServer.register(process.env.X402_NETWORK || 'eip155:196', new ExactEvmScheme());

    paymentMiddleware = pm(
      {
        'GET /v1/brief/:instId': {
          accepts: [{
            scheme: 'exact',
            network: process.env.X402_NETWORK || 'eip155:196',
            payTo: process.env.PAY_TO_ADDRESS,
            price: process.env.PRICE || '$0.05',
          }],
          description: 'Crypto Market Brief (RSI/trend/key levels, JSON+Markdown)',
          mimeType: 'application/json',
        },
      },
      resourceServer,
    );
    app.use(paymentMiddleware);
    console.log('[x402] 支付保护已启用 ->', process.env.PAY_TO_ADDRESS);
  } catch (err) {
    console.error('[x402] SDK 未安装或初始化失败，退回开发模式:', err.message);
  }
} else {
  console.log('[x402] 未配置 OKX_API_KEY —— 开发模式（付费接口放行，方便联调）');
}

const devMode = (req, res, next) => {
  if (!x402Enabled) req.devMode = true;
  next();
};

// ---- 路由 ------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'crypto-market-pulse',
    x402: x402Enabled ? 'enabled' : 'dev-mode',
    endpoints: ['/v1/preview/:instId (free)', '/v1/brief/:instId (x402 $0.05)'],
  });
});

// 免费预览：给广场用户/Agent 免费试用的钩子
app.get('/v1/preview/:instId', async (req, res) => {
  try {
    const data = await buildBrief(req.params.instId);
    res.json(toPreview(data));
  } catch (err) {
    res.status(502).json({ error: 'upstream_error', message: err.message });
  }
});

// 付费完整版
app.get('/v1/brief/:instId', devMode, async (req, res) => {
  try {
    const data = await buildBrief(req.params.instId);
    res.json(req.devMode ? { ...data, _devMode: true } : data);
  } catch (err) {
    res.status(502).json({ error: 'upstream_error', message: err.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[server] Crypto Market Pulse listening at http://localhost:${PORT}`);
  });
}

module.exports = app;
