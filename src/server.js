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
const mx = require('./matrix');

const app = express();
const PORT = process.env.PORT || 4000;

// ---- x402 支付保护（可选启用）---------------------------------
// 官方文档: https://web3.okx.com/zh-hans/onchainos/dev-docs/payments/service-seller-sdk
// 启用条件: .env 中配置 X402_NETWORK / PAY_TO_ADDRESS / OKX_API_KEY 三件套
const x402Enabled = !!process.env.OKX_API_KEY;
// PAY_TO_ADDRESS 缺省回落到 Agentic Wallet 收款地址，避免漏配时静默进入开发模式
process.env.PAY_TO_ADDRESS = process.env.PAY_TO_ADDRESS || '0xe716aac67216948dad46fa4d610cc297e13d03f8';

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
        'GET /v1/sentiment': {
          accepts: [{
            scheme: 'exact',
            network: process.env.X402_NETWORK || 'eip155:196',
            payTo: process.env.PAY_TO_ADDRESS,
            price: '$0.02',
          }],
          description: 'Fear & Greed sentiment dashboard (7d history + analysis)',
          mimeType: 'application/json',
        },
        'GET /v1/funding': {
          accepts: [{
            scheme: 'exact',
            network: process.env.X402_NETWORK || 'eip155:196',
            payTo: process.env.PAY_TO_ADDRESS,
            price: '$0.03',
          }],
          description: 'OKX funding rate radar (full scan, top lists, annualized)',
          mimeType: 'application/json',
        },
        'GET /v1/funding/:instId': {
          accepts: [{
            scheme: 'exact',
            network: process.env.X402_NETWORK || 'eip155:196',
            payTo: process.env.PAY_TO_ADDRESS,
            price: '$0.02',
          }],
          description: 'Single-instrument funding rate detail',
          mimeType: 'application/json',
        },
        'GET /v1/combo/:instId': {
          accepts: [{
            scheme: 'exact',
            network: process.env.X402_NETWORK || 'eip155:196',
            payTo: process.env.PAY_TO_ADDRESS,
            price: '$0.08',
          }],
          description: 'Combo: sentiment + funding + spot context for one pair',
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
    endpoints: [
      '/v1/preview/:instId (free)', '/v1/brief/:instId (x402 $0.05)',
      '/v1/sentiment/preview (free)', '/v1/sentiment (x402 $0.02)',
      '/v1/funding/preview (free)', '/v1/funding[/:instId] (x402 $0.03)',
      '/v1/combo/preview/:instId (free)', '/v1/combo/:instId (x402 $0.08)',
    ],
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

// ---- 矩阵扩展：情绪 / 费率 / 三合一 --------------------------------

app.get('/v1/sentiment/preview', async (_req, res) => {
  try { res.json(mx.sentimentPreview(await mx.sentimentReport())); }
  catch (err) { res.status(502).json({ error: 'upstream_error', message: err.message }); }
});

app.get('/v1/sentiment', devMode, async (req, res) => {
  try { res.json(req.devMode ? { ...(await mx.sentimentReport()), _devMode: true } : await mx.sentimentReport()); }
  catch (err) { res.status(502).json({ error: 'upstream_error', message: err.message }); }
});

app.get('/v1/funding/preview', async (_req, res) => {
  try { res.json(mx.fundingPreview(await mx.fundingScan())); }
  catch (err) { res.status(502).json({ error: 'upstream_error', message: err.message }); }
});

app.get('/v1/funding', devMode, async (req, res) => {
  try {
    const data = await mx.fundingScan();
    const report = mx.fundingReport(data);
    res.json(req.devMode ? { ...data, report, _devMode: true } : { ...data, report });
  } catch (err) { res.status(502).json({ error: 'upstream_error', message: err.message }); }
});

app.get('/v1/funding/:instId', devMode, async (req, res) => {
  try {
    const instId = req.params.instId.replace(/-SWAP$/, '');
    const data = await mx.fundingScan(`${instId}-SWAP`);
    res.json(req.devMode ? { ...data, _devMode: true } : { ...data, report: mx.fundingReport(data, instId) });
  } catch (err) { res.status(502).json({ error: 'upstream_error', message: err.message }); }
});

app.get('/v1/combo/preview/:instId', async (req, res) => {
  try { res.json(mx.comboPreview(await mx.comboBrief(req.params.instId))); }
  catch (err) { res.status(502).json({ error: 'upstream_error', message: err.message }); }
});

app.get('/v1/combo/:instId', devMode, async (req, res) => {
  try { res.json(req.devMode ? { ...(await mx.comboBrief(req.params.instId)), _devMode: true } : await mx.comboBrief(req.params.instId)); }
  catch (err) { res.status(502).json({ error: 'upstream_error', message: err.message }); }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[server] Crypto Market Pulse listening at http://localhost:${PORT}`);
  });
}

module.exports = app;
