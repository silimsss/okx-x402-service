'use strict';
/**
 * 冒烟测试（自包含）：拉起 mock OKX 行情 + 开发模式服务，跑完自动收尾。
 * 不需要外网，也不需要事先 npm start。
 *   node test/smoke.js
 */
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const PORT = Number(process.env.SMOKE_PORT || 4400);
const MOCK_PORT = Number(process.env.SMOKE_MOCK_PORT || 4399); // 对应 MOCK_OKX_PORT

function get(p, port = PORT) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: p }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, tries = 20, gap = 500) {
  for (let i = 0; i < tries; i++) {
    try { if (await fn()) return true; } catch { /* retry */ }
    await sleep(gap);
  }
  return false;
}

(async () => {
  const root = path.join(__dirname, '..');
  const children = [];
  const spawnNode = (file, env, args = []) => {
    const c = spawn(process.execPath, [file, ...args], {
      cwd: root, env: { ...process.env, ...env }, stdio: 'ignore',
    });
    children.push(c);
    return c;
  };
  const cleanup = () => children.forEach((c) => { try { c.kill(); } catch { /* ignore */ } });

  spawnNode(path.join('test', 'mock-okx-v2.js'), { MOCK_OKX_PORT: String(MOCK_PORT) });

  let failed = 0;
  const check = (name, cond, extra) => {
    if (cond) console.log(`  ✔ ${name}`);
    else { failed++; console.error(`  ✘ ${name}`, extra || ''); }
  };

  try {
    const mockUp = await waitFor(async () => (await get('/api/v5/market/ticker?instId=BTC-USDT', MOCK_PORT)).status === 200);
    check('mock OKX 行情已启动', mockUp);
    if (!mockUp) throw new Error('mock 未就绪');

    spawnNode(path.join('src', 'server.js'), {
      PORT: String(PORT),
      OKX_BASE: `http://127.0.0.1:${MOCK_PORT}`,
    });

    const up = await waitFor(async () => (await get('/health')).status === 200);
    check('服务已启动', up);
    if (!up) throw new Error('服务未就绪');

    const health = await get('/health');
    const h = JSON.parse(health.body);
    check('GET /health 200', health.status === 200);
    check('无 OKX_API_KEY 时为 dev-mode', h.x402 === 'dev-mode', h.x402);
    check('health 列出三条结算通道', !!h.channels && Object.keys(h.channels).length === 3, JSON.stringify(h.channels));

    const prev = await get('/v1/preview/BTC-USDT');
    check('GET /v1/preview 200', prev.status === 200, prev.body);
    if (prev.status === 200) {
      const j = JSON.parse(prev.body);
      check('预览版含 upsell 字段', !!j.upsell);
      check('预览版不含完整指标', j.rsi14 === undefined);
    }

    const brief = await get('/v1/brief/BTC-USDT');
    check('GET /v1/brief 200 (dev 模式放行)', brief.status === 200, brief.body);
    if (brief.status === 200) {
      const j = JSON.parse(brief.body);
      check('付费版含 fact/analysis/report', !!(j.fact && j.analysis && j.report));
      check('付费版标注 _devMode', j._devMode === true);
    }

    for (const p of ['/public/sentiment', '/public/funding', '/public/smartmoney', '/public/liquidation', '/public/openinterest']) {
      const r = await get(p);
      check(`GET ${p} 200`, r.status === 200, r.body.slice(0, 120));
    }
    const combo = await get('/public/combo/BTC-USDT');
    check('GET /public/combo/:instId 200', combo.status === 200, combo.body.slice(0, 120));

    const html = await get('/');
    check('GET / 200 且返回首页', html.status === 200 && /Crypto Market Pulse/i.test(html.body));
  } catch (e) {
    failed++;
    console.error('  ✘ 测试异常:', e.message);
  } finally {
    cleanup();
  }

  console.log(failed ? `\n${failed} 项失败` : '\n全部通过');
  process.exit(failed ? 1 : 0);
})();