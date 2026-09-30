'use strict';
/**
 * Crypto Market Pulse — HTTP 服务
 *
 * 路由:
 *   GET /health                 -> 健康检查
 *   GET /v1/preview/:instId     -> 免费预览
 *   GET /v1/brief/:instId       -> 完整快报（x402: $0.05/次）
 *
 * x402 说明:
 *   使用 @okxweb3/x402-express 接入。配置 OKX API Key（见 .env.example）后，
 *   付费接口受 402 支付保护；未配置时服务以开发模式运行（直接放行并在响应中
 *   标注），便于本地调试。
 */

const express = require('express');
const { buildBrief, toPreview } = require('./brief');
const mx = require('./matrix');

const app = express();
const PORT = process.env.PORT || 4000;

// ---- x402 支付保护（可选启用）---------------------------------
// 文档: https://web3.okx.com/zh-hans/onchainos/dev-docs/payments/service-seller-sdk
// 启用条件: .env 中配置 X402_NETWORK / PAY_TO_ADDRESS / OKX_API_KEY
const x402Enabled = !!process.env.OKX_API_KEY;
// PAY_TO_ADDRESS 缺省回落到 Agentic Wallet 收款地址
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
  console.log('[x402] 未配置 OKX_API_KEY，以开发模式运行（付费接口放行）');
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
      '/v1/sentiment/preview | /public/sentiment (free)', '/v1/sentiment (x402 $0.02)',
      '/v1/funding/preview | /public/funding (free)', '/v1/funding[/:instId] (x402 $0.03/$0.02)',
      '/v1/combo/preview/:instId | /public/combo/:instId (free)', '/v1/combo/:instId (x402 $0.08)',
    ],
  });
});

// 免费预览
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
// 注意：preview（免费）路由必须在 x402 中间件之后注册但由于 SDK 的 :param
// 正则 ^[^/]+$ 不会匹配含斜杠的 "preview"——实测会误拦，因此这里用独立
// 前缀 /public/ 保证免费路由不被付费规则命中。

const freeJson = (handler) => async (req, res) => {
  try { res.json(await handler(req)); }
  catch (err) { res.status(502).json({ error: 'upstream_error', message: err.message }); }
};

app.get('/public/sentiment', freeJson(async () => mx.sentimentPreview(await mx.sentimentReport())));
app.get('/public/funding', freeJson(async () => mx.fundingPreview(await mx.fundingScan())));
app.get('/public/combo/:instId', freeJson(async (req) => mx.comboPreview(await mx.comboBrief(req.params.instId))));

app.get('/v1/sentiment/preview', freeJson(async () => mx.sentimentPreview(await mx.sentimentReport())));

app.get('/v1/sentiment', devMode, async (req, res) => {
  try { res.json(req.devMode ? { ...(await mx.sentimentReport()), _devMode: true } : await mx.sentimentReport()); }
  catch (err) { res.status(502).json({ error: 'upstream_error', message: err.message }); }
});

app.get('/v1/funding/preview', freeJson(async () => mx.fundingPreview(await mx.fundingScan())));

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

app.get('/v1/combo/preview/:instId', freeJson(async (req) => mx.comboPreview(await mx.comboBrief(req.params.instId))));

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
