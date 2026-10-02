'use strict';
/**
 * 模拟 OKX 公开行情 API v2（沙箱无外网环境联调用）
 * 提供: /api/v5/market/ticker(s) /api/v5/market/candles
 *       /api/v5/public/funding-rate /api/v5/public/open-interest
 *       /api/v5/public/instruments /api/v5/public/liquidation-orders
 *       /api/v5/rubik/stat/contracts/* (多空比/主动买卖/OI)
 */
const http = require('http');

const BASE = 64000;
const SWAPS = ['BTC-USDT-SWAP', 'ETH-USDT-SWAP', 'SOL-USDT-SWAP', 'XRP-USDT-SWAP', 'OKB-USDT-SWAP', 'DOGE-USDT-SWAP', 'LTC-USDT-SWAP', 'ADA-USDT-SWAP', 'PEPE-USDT-SWAP'];
const CCYS = ['BTC', 'ETH', 'SOL', 'XRP', 'OKB', 'DOGE', 'LTC', 'ADA', 'PEPE'];

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

// 生成降序时间序列（新→旧），与 OKX 真实返回一致
function descSeries(n, periodMs, make) {
  const rows = [];
  const now = Math.floor(Date.now() / periodMs) * periodMs;
  for (let i = 0; i < n; i++) rows.push(make(now - i * periodMs, i));
  return rows;
}

const PX = { BTC: 84000, ETH: 3100, SOL: 210, XRP: 2.4, OKB: 52, DOGE: 0.35, LTC: 120, ADA: 1.05, PEPE: 0.00002 };

const SPECS = {};
for (const c of CCYS) {
  SPECS[`${c}-USDT-SWAP`] = { ctType: 'linear', ctValCcy: c, ctVal: c === 'BTC' ? 0.01 : c === 'ETH' ? 0.1 : 1, uly: `${c}-USDT` };
}
SPECS['BTC-USD-SWAP'] = { ctType: 'inverse', ctValCcy: 'USD', ctVal: 100, uly: 'BTC-USD' };
SPECS['ETH-USD-SWAP'] = { ctType: 'inverse', ctValCcy: 'USD', ctVal: 10, uly: 'ETH-USD' };

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
  } else if (p === '/api/v5/public/instruments') {
    const instId = url.searchParams.get('instId');
    const rows = instId ? [SPECS[instId] ? { instId, instType: 'SWAP', ...SPECS[instId] } : null].filter(Boolean)
      : Object.entries(SPECS).map(([instId, s]) => ({ instId, instType: 'SWAP', ...s }));
    res.end(JSON.stringify({ code: '0', data: rows }));
  } else if (p === '/api/v5/public/open-interest') {
    const instId = url.searchParams.get('instId');
    const mk = (id) => {
      const c = id.split('-')[0];
      const oiCcy = 20000 + c.length * 1000;
      return { instId: id, instType: 'SWAP', oi: String(oiCcy), oiCcy: String(oiCcy), oiUsd: String(oiCcy * (PX[c] || 1)), ts: String(Date.now()) };
    };
    res.end(JSON.stringify({ code: '0', data: instId ? [mk(instId)] : SWAPS.map(mk) }));
  } else if (p === '/api/v5/public/liquidation-orders') {
    const uly = url.searchParams.get('uly');
    if (!uly) { res.statusCode = 400; res.end(JSON.stringify({ code: '50015', data: [] })); return; }
    const instId = `${uly}-SWAP`;
    const spec = SPECS[instId] || { ctType: 'linear', ctVal: 1 };
    const px0 = PX[uly.split('-')[0]] || 100;
    const details = descSeries(18, 900000, (ts, i) => ({
      ts: String(ts - Math.floor(i * 137000)),
      bkPx: String(+(px0 * (0.98 + 0.01 * (i % 4))).toFixed(1)),
      sz: String((i % 5 === 0 ? 50 : 2) + i),
      posSide: i % 6 === 5 ? 'short' : 'long',
      side: i % 6 === 5 ? 'buy' : 'sell',
      bkLoss: '0',
      ccy: '',
    }));
    res.end(JSON.stringify({ code: '0', data: [{ instId, instType: 'SWAP', uly, instFamily: uly, totalLoss: '0', details }] }));
  } else if (p === '/api/v5/rubik/stat/contracts/long-short-account-ratio') {
    res.end(JSON.stringify({ code: '0', data: descSeries(48, 300000, (ts, i) => [String(ts), (1.43 - i * 0.002).toFixed(4)]) }));
  } else if (p === '/api/v5/rubik/stat/contracts/long-short-position-ratio-contract-top-trader') {
    res.end(JSON.stringify({ code: '0', data: descSeries(100, 300000, (ts, i) => [String(ts), (0.95 + Math.sin(i / 7) * 0.05).toFixed(6)]) }));
  } else if (p === '/api/v5/rubik/stat/contracts/long-short-account-ratio-contract-top-trader') {
    res.end(JSON.stringify({ code: '0', data: descSeries(100, 300000, (ts, i) => [String(ts), (1.15 - i * 0.001).toFixed(6)]) }));
  } else if (p === '/api/v5/rubik/stat/taker-volume-contract') {
    res.end(JSON.stringify({ code: '0', data: descSeries(100, 300000, (ts, i) => [String(ts), (2600 - i * 5).toFixed(2), (3930 + i * 3).toFixed(2)]) }));
  } else if (p === '/api/v5/rubik/stat/contracts/open-interest-volume') {
    res.end(JSON.stringify({ code: '0', data: descSeries(48, 300000, (ts, i) => [String(ts), (3071783358 * (1 + i * 0.0004)).toFixed(2), (7127166 - i * 900).toFixed(2)]) }));
  } else if (p === '/api/v5/rubik/stat/contracts/open-interest-history') {
    // 升序构造 +10% 的 24h 增长，再反转为降序输出
    const rows = [];
    const nowH = Math.floor(Date.now() / 3600000) * 3600000;
    for (let i = 0; i < 72; i++) {
      const oi = 2600000 * (1 + (i / 71) * 0.1);
      rows.push([String(nowH - (71 - i) * 3600000), String(oi.toFixed(2)), String((oi / 100).toFixed(4)), String((oi * (last / 100)).toFixed(2))]);
    }
    res.end(JSON.stringify({ code: '0', data: rows.reverse() }));
  } else {
    res.statusCode = 404; res.end('{}');
  }
// 注意：不要读 PORT —— npm 会把自己的 IPC 端口注入 PORT，导致 mock 被劫持到随机端口
}).listen(process.env.MOCK_OKX_PORT || 4312, function () {
  console.log(`mock OKX v2 on :${this.address().port}`);
});
