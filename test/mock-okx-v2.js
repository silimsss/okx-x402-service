'use strict';
/**
 * 模拟 OKX 公开行情 API v2（沙箱无外网环境联调用）
 * 提供: /api/v5/market/ticker(s) /api/v5/market/candles
 *       /api/v5/public/funding-rate /api/v5/public/open-interest
 */
const http = require('http');

const BASE = 64000;
const SWAPS = ['BTC-USDT-SWAP', 'ETH-USDT-SWAP', 'SOL-USDT-SWAP', 'XRP-USDT-SWAP', 'OKB-USDT-SWAP', 'DOGE-USDT-SWAP', 'LTC-USDT-SWAP', 'ADA-USDT-SWAP', 'PEPE-USDT-SWAP'];

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
  const p = url.pathname;
  if (p === '/api/v5/market/ticker') {
    res.end(JSON.stringify({ code: '0', data: [{ last: String(last), open24h: String(BASE), volCcy24h: '123456789' }] }));
  } else if (p === '/api/v5/market/tickers') {
    res.end(JSON.stringify({ code: '0', data: SWAPS.map((s, i) => ({ instId: s, last: String(BASE + i * 100), volCcy24h: String(9000000 - i * 1000000) })) }));
  } else if (p === '/api/v5/market/candles') {
    res.end(JSON.stringify({ code: '0', data: candles }));
  } else if (p === '/api/v5/public/funding-rate') {
    const instId = url.searchParams.get('instId');
    if (instId) {
      res.end(JSON.stringify({ code: '0', data: [{ instId, fundingRate: '0.00012', fundingTime: String(Date.now() + 3600000) }] }));
    } else {
      const rows = SWAPS.map((s, i) => ({
        instId: s,
        fundingRate: ((i % 2 === 0 ? 1 : -1) * (0.00005 + i * 0.00004)).toFixed(6),
        fundingTime: String(Date.now() + 3600000),
      }));
      res.end(JSON.stringify({ code: '0', data: rows }));
    }
  } else {
    res.statusCode = 404; res.end('{}');
  }
}).listen(4312, () => console.log('mock OKX v2 on :4310'));
