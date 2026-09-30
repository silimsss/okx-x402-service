'use strict';
/**
 * 模拟 OKX 公开行情 API（用于无外网环境端到端验证）
 * 提供: /api/v5/market/ticker  /api/v5/market/candles
 */
const http = require('http');

const BASE = 64000;
function genCandles(n) {
  const rows = [];
  let price = BASE;
  let t = Date.now() - n * 86400000;
  for (let i = 0; i < n; i++) {
    const drift = Math.sin(i / 5) * 400 + (Math.random() - 0.5) * 300;
    const open = price;
    price = +(price + drift).toFixed(1);
    rows.unshift([String(t + i * 86400000), String(open), String(Math.max(open, price) + 120), String(Math.min(open, price) - 120), String(price), '1000']);
  }
  return rows;
}
const candles = genCandles(35);
const last = +candles[candles.length - 1][4];

http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/v5/market/ticker') {
    res.end(JSON.stringify({ code: '0', data: [{ last: String(last), open24h: String(BASE), volCcy24h: '123456789' }] }));
  } else if (url.pathname === '/api/v5/market/candles') {
    res.end(JSON.stringify({ code: '0', data: candles }));
  } else {
    res.statusCode = 404; res.end('{}');
  }
}).listen(4300, () => console.log('mock OKX on :4300'));
