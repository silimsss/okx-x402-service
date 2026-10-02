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
const path = require('path');
const { buildBrief, toPreview } = require('./brief');
const mx = require('./matrix');
const rd = require('./radar');

const app = express();
const PORT = process.env.PORT || 4000;

// 服务展示首页（public/index.html）挂在根路径，/health 等路由不受影响
app.use(express.static(path.join(__dirname, '..', 'public')));

// 支付中间件容器。必须先于所有业务路由注册（Express 按注册顺序匹配），
// 因此先在顶层占位，initX402() 里再异步往里装配内容。
const paymentRouter = express.Router();
app.use(paymentRouter);

// ---- x402 支付保护（可选启用，多链结算）-------------------------
// 文档: https://web3.okx.com/zh-hans/onchainos/dev-docs/payments/service-seller-sdk
// 启用条件: .env 中配置 X402_NETWORK / PAY_TO_ADDRESS / OKX_API_KEY
// 多链: BASE_PAY_TO 配置后，自动追加 Base(eip155:8453)/USDC 通道（CDP facilitator，
//       启动时探测，失败自动停用且不影响 OKX 通道）；BSC 见 multichain.js 占位
const mc = require('./multichain');
const x402Enabled = !!process.env.OKX_API_KEY;
// PAY_TO_ADDRESS 缺省回落到 Agentic Wallet 收款地址
process.env.PAY_TO_ADDRESS = process.env.PAY_TO_ADDRESS || '0xe716aac67216948dad46fa4d610cc297e13d03f8';
let baseActive = false; // 运行时反映 Base 通道状态（health 展示用）
let x402State = 'off'; // off | ok | error
const X402_INIT_TIMEOUT_MS = Number(process.env.X402_INIT_TIMEOUT_MS || 20000);

function buildRoutes() {
  const N = process.env.X402_NETWORK || 'eip155:196';
  const acc = (price) => ({ scheme: 'exact', network: N, payTo: process.env.PAY_TO_ADDRESS, price });
  return {
    'GET /v1/brief/:instId': {
      accepts: [acc(process.env.PRICE || '$0.05')],
      description: 'Crypto Market Brief (RSI/trend/key levels, JSON+Markdown)',
      mimeType: 'application/json',
    },
    'GET /v1/sentiment': {
      accepts: [acc('$0.02')],
      description: 'Fear & Greed sentiment dashboard (7d history + analysis)',
      mimeType: 'application/json',
    },
    'GET /v1/funding': {
      accepts: [acc('$0.03')],
      description: 'OKX funding rate radar (full scan, top lists, annualized)',
      mimeType: 'application/json',
    },
    'GET /v1/funding/:instId': {
      accepts: [acc('$0.02')],
      description: 'Single-instrument funding rate detail',
      mimeType: 'application/json',
    },
    'GET /v1/combo/:instId': {
      accepts: [acc('$0.08')],
      description: 'Combo: sentiment + funding + spot context for one pair',
      mimeType: 'application/json',
    },
    'GET /v1/smartmoney': {
      accepts: [acc('$0.03')],
      description: 'Smart-money positioning radar (top-trader vs retail long/short divergence)',
      mimeType: 'application/json',
    },
    'GET /v1/liquidation': {
      accepts: [acc('$0.02')],
      description: 'OKX perpetual liquidation radar (24h long/short squeeze stats)',
      mimeType: 'application/json',
    },
    'GET /v1/openinterest': {
      accepts: [acc('$0.02')],
      description: 'Open-interest monitor (market OI ranking + surge alerts)',
      mimeType: 'application/json',
    },
  };
}

async function initX402() {
  if (!x402Enabled) {
    console.log('[x402] 未配置 OKX_API_KEY，以开发模式运行（付费接口放行）');
    return;
  }
  try {
    // npm i @okxweb3/x402-express @okxweb3/x402-core @okxweb3/x402-evm
    const { paymentMiddlewareFromHTTPServer, x402HTTPResourceServer, x402ResourceServer } = require('@okxweb3/x402-express');
    const { ExactEvmScheme } = require('@okxweb3/x402-evm/exact/server');
    const { OKXFacilitatorClient } = require('@okxweb3/x402-core');

    const facilitators = [new OKXFacilitatorClient({
      baseUrl: process.env.OKX_FACILITATOR_URL || 'https://web3.okx.com', // 可指向 mock，仅本地测试用
      apiKey: process.env.OKX_API_KEY,
      secretKey: process.env.OKX_SECRET_KEY,
      passphrase: process.env.OKX_PASSPHRASE,
    })];
    const resourceServer = new x402ResourceServer(facilitators);
    resourceServer.register(process.env.X402_NETWORK || 'eip155:196', new ExactEvmScheme());

    const routes = buildRoutes();

    // Base 通道：显式开关(BASE_PAY_TO) + facilitator 探测通过才启用；失败不影响 OKX 通道
    if (mc.baseEnabled()) {
      const baseFacilitator = mc.buildBaseFacilitator();
      const ok = baseFacilitator ? await mc.baseSupported().catch(() => false) : false;
      if (ok) {
        facilitators.push(baseFacilitator);
        resourceServer.register(mc.NETWORKS.BASE, new ExactEvmScheme());
        mc.augmentRoutesWithBase(routes);
        console.log('[multichain] Base 通道已加入路由 (eip155:8453 USDC) ->', process.env.BASE_PAY_TO);
      } else {
        console.warn('[multichain] CDP facilitator 探测未通过，Base 通道本次启动停用（OKX 通道不受影响）');
      }
    }

    // 显式预初始化：拉取各 facilitator 的 supported kinds + 校验路由配置。
    // 不用 paymentMiddleware() 的惰性初始化，因为初始化失败会变成未捕获拒绝直接把进程打死，
    // 而我们希望「启动失败可观测 + 付费接口不放行」。
    const httpServer = new x402HTTPResourceServer(resourceServer, routes);
    await mc.withTimeout(httpServer.initialize(), X402_INIT_TIMEOUT_MS, 'x402 initialize');

    // 已手动 initialize 完成 -> syncFacilitatorOnStart=false，避免每个进程重复打 facilitator
    paymentRouter.use(paymentMiddlewareFromHTTPServer(httpServer, undefined, undefined, false));
    baseActive = routesAcceptBase(routes);
    x402State = 'ok';
    console.log('[x402] 支付保护已启用 ->', process.env.PAY_TO_ADDRESS,
      '| routes:', Object.keys(routes).length, '| base:', baseActive ? 'on' : 'off');
  } catch (err) {
    x402State = 'error';
    // 不放行付费数据，也不让进程崩溃：付费路由统一 503，/health 可观测
    console.error('[x402] 初始化失败，付费接口一律 503（不放行）:', err.message);
    const FREE_V1 = [
      /^\/v1\/preview\/[^/]+$/, /^\/v1\/sentiment\/preview$/,
      /^\/v1\/funding\/preview$/, /^\/v1\/combo\/preview\/[^/]+$/,
    ];
    paymentRouter.use((req, res, next) => {
      if (!req.path.startsWith('/v1')) return next();
      if (FREE_V1.some((re) => re.test(req.path))) return next();
      return res.status(503).json({ error: 'x402_unavailable', message: 'payment gateway not ready' });
    });
  }
}

/** 路由里是否已经带上了 Base 支付选项 */
function routesAcceptBase(routes) {
  return Object.values(routes).some((c) => c.accepts.some((a) => a.network === mc.NETWORKS.BASE));
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
    x402: !x402Enabled ? 'dev-mode' : (x402State === 'ok' ? 'enabled' : x402State),
    channels: {
      'eip155:196': x402State === 'ok' ? 'usdt0' : 'off',
      'eip155:8453': baseActive ? 'usdc' : 'off',
      'eip155:56': 'pending-merchant-onboarding',
    },
    endpoints: [
      '/v1/preview/:instId (free)', '/v1/brief/:instId (x402 $0.05)',
      '/v1/sentiment/preview | /public/sentiment (free)', '/v1/sentiment (x402 $0.02)',
      '/v1/funding/preview | /public/funding (free)', '/v1/funding[/:instId] (x402 $0.03/$0.02)',
      '/v1/combo/preview/:instId | /public/combo/:instId (free)', '/v1/combo/:instId (x402 $0.08)',
      '/public/smartmoney (free)', '/v1/smartmoney (x402 $0.03, ?ccy=BTC 可选)',
      '/public/liquidation (free)', '/v1/liquidation (x402 $0.02)',
      '/public/openinterest (free)', '/v1/openinterest (x402 $0.02)',
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

const freeJson = (handler) => async (req, res) => {
  try { res.json(await handler(req)); }
  catch (err) { res.status(502).json({ error: 'upstream_error', message: err.message }); }
};

// ---- 雷达矩阵：聪明钱 / 爆仓 / 持仓量异动 --------------------------
// 付费路由均无 :param，不存在 preview 被误拦的问题；免费预览仍走 /public/*。

app.get('/public/smartmoney', freeJson(async () => rd.smartPreview(await rd.smartScan(['BTC']))));
app.get('/public/liquidation', freeJson(async () => rd.liqPreview(await rd.liqScan(['BTC-USDT', 'BTC-USD']))));
app.get('/public/openinterest', freeJson(async () => rd.oiPreview(await rd.oiScan())));

app.get('/v1/smartmoney', devMode, async (req, res) => {
  try {
    let ccys = null;
    if (req.query.ccy) ccys = String(req.query.ccy).split(',').map((s) => s.trim()).filter(Boolean);
    const data = await rd.smartScan(ccys || undefined);
    const report = rd.smartReport(data);
    res.json(req.devMode ? { ...data, report, _devMode: true } : { ...data, report });
  } catch (err) { res.status(502).json({ error: 'upstream_error', message: err.message }); }
});

app.get('/v1/liquidation', devMode, async (req, res) => {
  try {
    const data = await rd.liqScan();
    const report = rd.liqReport(data);
    res.json(req.devMode ? { ...data, report, _devMode: true } : { ...data, report });
  } catch (err) { res.status(502).json({ error: 'upstream_error', message: err.message }); }
});

app.get('/v1/openinterest', devMode, async (req, res) => {
  try {
    const data = await rd.oiScan();
    const report = rd.oiReport(data);
    res.json(req.devMode ? { ...data, report, _devMode: true } : { ...data, report });
  } catch (err) { res.status(502).json({ error: 'upstream_error', message: err.message }); }
});

// ---- 矩阵扩展：情绪 / 费率 / 三合一 --------------------------------
// 注意：preview（免费）路由必须在 x402 中间件之后注册但由于 SDK 的 :param
// 正则 ^[^/]+$ 不会匹配含斜杠的 "preview"——实测会误拦，因此这里用独立
// 前缀 /public/ 保证免费路由不被付费规则命中。

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
  (async () => {
    await initX402(); // 先完成支付中间件装配（含 Base 通道探测），再监听端口
    app.listen(PORT, () => {
      console.log(`[server] Crypto Market Pulse listening at http://localhost:${PORT}`);
    });
  })();
}

module.exports = app;
module.exports.initX402 = initX402;
