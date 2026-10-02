'use strict';
/**
 * 抓取各付费端点的真实响应样例（dev 模式 + mock 行情），
 * 用于 Bazaar 发现元数据里的 output.example。
 *   node tools/dump-samples.js  ->  test/.samples.json
 */
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const APP_PORT = 4405;
const MOCK_PORT = 4406;
const root = path.join(__dirname, '..');

function get(p, port = APP_PORT) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: p }, (res) => {
      let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => resolve({ status: res.statusCode, body: b }));
    }).on('error', reject);
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ENDPOINTS = [
  'GET /v1/brief/BTC-USDT',
  'GET /v1/sentiment',
  'GET /v1/funding',
  'GET /v1/funding/BTC-USDT',
  'GET /v1/combo/BTC-USDT',
  'GET /v1/smartmoney?ccy=BTC',
  'GET /v1/liquidation',
  'GET /v1/openinterest',
];

function trim(obj, maxKeys = 14, maxArr = 3) {
  if (Array.isArray(obj)) return obj.slice(0, maxArr).map((x) => trim(x, maxKeys, maxArr));
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const k of Object.keys(obj).slice(0, maxKeys)) {
      const v = obj[k];
      out[k] = (typeof v === 'string' && v.length > 160) ? v.slice(0, 160) + '…' : trim(v, maxKeys, maxArr);
    }
    return out;
  }
  return obj;
}

(async () => {
  const kids = [];
  const go = (f, env) => { const c = spawn(process.execPath, [f], { cwd: root, env: { ...process.env, ...env }, stdio: 'ignore' }); kids.push(c); return c; };
  go(path.join('test', 'mock-okx-v2.js'), { MOCK_OKX_PORT: String(MOCK_PORT) });
  await sleep(1500);
  go(path.join('src', 'server.js'), { PORT: String(APP_PORT), OKX_BASE: `http://127.0.0.1:${MOCK_PORT}` });
  for (let i = 0; i < 20; i++) { await sleep(500); try { if ((await get('/health')).status === 200) break; } catch { /* retry */ } }

  const out = {};
  for (const e of ENDPOINTS) {
    const [method, p] = e.split(' ');
    const r = await get(p);
    try { out[e] = { status: r.status, sample: trim(JSON.parse(r.body)) }; }
    catch { out[e] = { status: r.status, sample: r.body.slice(0, 200) }; }
    console.log(`${r.status}  ${e}`);
  }
  require('fs').writeFileSync(path.join(root, 'test', '.samples.json'), JSON.stringify(out, null, 1));
  kids.forEach((c) => { try { c.kill(); } catch { /* ignore */ } });
  process.exit(0);
})();