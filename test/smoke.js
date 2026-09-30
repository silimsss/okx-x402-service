'use strict';
/**
 * 冒烟测试: 不需要网络出站到 OKX 时也能验证路由与降级逻辑
 * 运行: npm test （需先 npm start 或 node test/smoke.js 自行拉起）
 */
const http = require('http');

const PORT = process.env.PORT || 4000;

function get(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: PORT, path }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

(async () => {
  let failed = 0;
  const check = (name, cond, extra) => {
    if (cond) console.log(`  ✔ ${name}`);
    else { failed++; console.error(`  ✘ ${name}`, extra || ''); }
  };

  const health = await get('/health');
  check('GET /health 200', health.status === 200, health.body);

  const prev = await get('/v1/preview/BTC-USDT');
  const prevOk = prev.status === 200;
  check('GET /v1/preview 200 (或上游不可达时 502)', prevOk || prev.status === 502, prev.body);
  if (prevOk) {
    const j = JSON.parse(prev.body);
    check('预览版含 upsell 字段', !!j.upsell);
    check('预览版不含完整指标', j.rsi14 === undefined);
  }

  const brief = await get('/v1/brief/BTC-USDT');
  check('GET /v1/brief 可达 (200/502)', brief.status === 200 || brief.status === 502, brief.body);
  if (brief.status === 200) {
    const j = JSON.parse(brief.body);
    check('付费版含 fact/analysis/report', !!(j.fact && j.analysis && j.report));
  }

  console.log(failed ? `\n${failed} 项失败` : '\n全部通过');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
