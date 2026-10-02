'use strict';
/**
 * 部署后自检：一条命令确认服务处于预期状态。
 *
 *   node tools/postdeploy.js                        # 检查默认域名
 *   BASE_URL=http://localhost:4000 node tools/postdeploy.js
 *
 * 检查项：
 *   1. /health 的 x402 与各通道状态
 *   2. 每个付费端点返回 402，且 PAYMENT-REQUIRED 头里 accepts 正确
 *   3. （若能连外网）调用 Coinbase 免鉴权 validate，检查 Bazaar 收录资格
 * 无需任何密钥。
 */
const http = require('http');
const https = require('https');

const BASE = (process.env.BASE_URL || 'https://crypto-market-pulse.onrender.com').replace(/\/$/, '');
const PAYLOADS = [
  '/v1/brief/BTC-USDT', '/v1/sentiment', '/v1/funding', '/v1/funding/BTC-USDT',
  '/v1/combo/BTC-USDT', '/v1/smartmoney', '/v1/liquidation', '/v1/openinterest',
];
const USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';

const agent = BASE.startsWith('https') ? https : http;
let fail = 0;
const ok = (m) => console.log(`  ✔ ${m}`);
const bad = (m) => { fail++; console.log(`  ✘ ${m}`); };

function req(pathname, { method = 'GET', body, host, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const h = host || BASE;
    const lib = h.startsWith('https') ? https : http;
    const u = new URL(pathname, h);
    const payload = body ? JSON.stringify(body) : null;
    const r = lib.request(u, {
      method,
      headers: { ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}), ...headers },
      timeout: 30000,
    }, (res) => {
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: b }));
    });
    r.on('error', reject);
    r.on('timeout', () => r.destroy(new Error('timeout')));
    if (payload) r.write(payload);
    r.end();
  });
}

const requirements = (r) => {
  const h = r.headers['payment-required'];
  if (!h) return null;
  try { return JSON.parse(Buffer.from(h, 'base64').toString('utf8')); } catch { return null; }
};

(async () => {
  console.log(`检查 ${BASE}\n`);

  // ---- 1. /health ----
  let health;
  try {
    const r = await req('/health');
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    health = JSON.parse(r.body);
    ok(`/health 200 · x402=${health.x402}`);
  } catch (e) {
    bad(`/health 不可用: ${e.message}`);
    console.log('\n服务没起来，后面的检查没意义。');
    process.exit(1);
  }
  const ch = health.channels || {};
  ch['eip155:196'] === 'usdt0' ? ok('X Layer 通道 (eip155:196/usdt0) 正常') : bad(`X Layer 通道异常: ${ch['eip155:196']}`);
  if (ch['eip155:8453'] === 'usdc') ok('Base 通道 (eip155:8453/usdc) 已开启');
  else if (ch['eip155:8453'] === 'off:not-configured') bad('Base 通道未配置（需要填 BASE_PAY_TO）');
  else bad(`Base 通道探测失败: ${health.baseProbeError || ch['eip155:8453']}`);

  // ---- 2. 每个付费端点 ----
  console.log('');
  for (const p of PAYLOADS) {
    try {
      const r = await req(p);
      if (r.status !== 402) { bad(`${p} 返回 ${r.status}（期望 402）`); continue; }
      const rq = requirements(r);
      if (!rq) { bad(`${p} 402 但缺 PAYMENT-REQUIRED 头`); continue; }
      const nets = (rq.accepts || []).map((a) => a.network);
      const b = (rq.accepts || []).find((a) => a.network === 'eip155:8453');
      const x = (rq.accepts || []).find((a) => a.network === 'eip155:196');
      const parts = [`402 · ${nets.join('+')}`];
      if (x && b) parts.push(`同价 ${x.amount === b.amount ? '✓' : '✗'}`);
      if (b) parts.push(`USDC ${String(b.asset).toLowerCase() === USDC_BASE ? '✓' : '✗'}`);
      parts.push(`bazaar ${rq.extensions && rq.extensions.bazaar ? '✓' : '✗'}`);
      const good = (rq.accepts || []).length >= 1 && rq.extensions && rq.extensions.bazaar;
      (good ? ok : bad)(`${p}  ${parts.join(' · ')}`);
    } catch (e) {
      bad(`${p} 请求失败: ${e.message}`);
    }
  }

  // ---- 3. 免费端点 ----
  console.log('');
  for (const p of ['/v1/preview/BTC-USDT', '/public/sentiment', '/public/funding', '/public/smartmoney', '/public/liquidation', '/public/openinterest']) {
    try {
      const r = await req(p);
      r.status === 200 ? ok(`${p} 200（免费端点可用）`) : bad(`${p} 返回 ${r.status}`);
    } catch (e) { bad(`${p} 请求失败: ${e.message}`); }
  }

  // ---- 4. Bazaar 收录资格（需能连外网） ----
  console.log('\nBazaar 收录自检（Coinbase 免鉴权 validate）:');
  let reachable = true;
  for (const p of PAYLOADS) {
    try {
      const r = await req('/platform/v2/x402/validate', {
        method: 'POST', host: 'https://api.cdp.coinbase.com', body: { resource: BASE + p, method: 'GET' },
      });
      const j = JSON.parse(r.body);
      const failed = (j.preflight || []).filter((c) => !c.passed);
      const line = failed.map((c) => c.check).join(', ') || '全部通过';
      (j.valid ? ok : bad)(`${p} valid=${j.valid} ${j.valid ? '' : '(' + line + ')'}`);
    } catch (e) {
      reachable = false;
      console.log(`  · 跳过（连不上 api.cdp.coinbase.com: ${e.message}）`);
      break;
    }
  }
  if (reachable && fail) {
    console.log('\n提示：validate 未全绿时，Base 通道还没生效。见 CDP_SETUP.md。');
  }

  console.log(fail ? `\n${fail} 项需要处理` : '\n全部通过');
  process.exit(fail ? 1 : 0);
})();