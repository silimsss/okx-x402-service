'use strict';
/**
 * 用 Coinbase 官方 validate 端点自检 Bazaar 可收录性（免鉴权、无需 CDP Key）。
 *
 *   node tools/validate-bazaar.js                       # 全部 8 个付费端点
 *   node tools/validate-bazaar.js /v1/sentiment         # 指定端点
 *
 * validate 会检查：URL 可达、返回 402、PAYMENT-REQUIRED 头、x402 v2、
 * accepts[0] 的网络/资产是否被 CDP facilitator 支持、以及 extensions.bazaar 元数据。
 * 注意它只看 accepts[0]——所以 Base 必须排在首位（见 src/multichain.js）。
 */
const http = require('http');

const HOST = process.env.BASE_URL || 'https://crypto-market-pulse.onrender.com';
const ALL = [
  '/v1/brief/BTC-USDT', '/v1/sentiment', '/v1/funding', '/v1/funding/BTC-USDT',
  '/v1/combo/BTC-USDT', '/v1/smartmoney', '/v1/liquidation', '/v1/openinterest',
];

function post(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request({
      host: 'api.cdp.coinbase.com', path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      timeout: 30000,
    }, (res) => {
      let b = ''; res.on('data', (c) => (b += c));
      res.on('end', () => { try { resolve({ status: res.statusCode, json: JSON.parse(b) }); } catch (e) { reject(new Error(b.slice(0, 300))); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.write(payload); req.end();
  });
}

(async () => {
  const targets = process.argv.slice(2);
  const paths = targets.length ? targets : ALL;
  let bad = 0;

  for (const p of paths) {
    process.stdout.write(`${p.padEnd(26)} `);
    let j;
    try {
      ({ json: j } = await post('/platform/v2/x402/validate', { resource: HOST + p, method: 'GET' }));
    } catch (e) {
      console.log(`请求失败: ${e.message}`); bad++; continue;
    }
    const failed = (j.preflight || []).filter((c) => !c.passed);
    const req = failed.filter((c) => c.severity === 'required');
    const adv = failed.filter((c) => c.severity !== 'required');
    if (req.length) {
      bad++;
      console.log(`✘ valid=${j.valid} outcome=${j.simulation && j.simulation.outcome}`);
      failed.forEach((c) => console.log(`     [${c.severity}] ${c.check}: ${c.detail}`));
    } else {
      console.log(`✔ valid=${j.valid} outcome=${j.simulation && j.simulation.outcome}` +
        (adv.length ? `（${adv.length} 条 advisory）` : ''));
      adv.forEach((c) => console.log(`     [advisory] ${c.check}: ${c.detail}`));
    }
  }
  console.log(bad ? `\n${bad}/${paths.length} 个端点未通过` : `\n全部 ${paths.length} 个端点通过`);
  process.exit(bad ? 1 : 0);
})();