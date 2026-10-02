'use strict';
/**
 * 跨交易所 mock：Binance / Gate / Bybit 三家的公开行情形状。
 * 端口用 XV_PORT（不能用 PORT —— npm 会把自己的 IPC 端口注入 PORT 变量）。
 *
 * 费率刻意造出真实量级的离散度（Binance 最高、Gate 最低），让冒烟测试能断言
 * 「倍数差」与「排名」确实被算出来，而不只是字段存在。
 */

const http = require('http');

const RATES = {
  binance: { rate: 0.0001, mark: 86081.2, oi: 99438.08, next: 1790928000000 },
  gate: { rate: 0.000014, mark: 86075.0 },
  bybit: { rate: 0.00005, mark: 86077.1, oi: 5123400 },
  // 取线上实测值（2026-10-02），使 mock 的费率排序与真实情况一致
  okx: { rate: 0.0000167, mark: 86081.0, oi: 41230, next: 1790928000000 },
};

function send(res, body, code = 200) {
  const buf = Buffer.from(JSON.stringify(body));
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': buf.length });
  res.end(buf);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  const sym = url.searchParams.get('symbol') || url.pathParams || 'BTCUSDT';

  // ---- Binance ----
  if (p === '/fapi/v1/premiumIndex') {
    return send(res, {
      symbol: sym, markPrice: String(RATES.binance.mark), indexPrice: String(RATES.binance.mark + 30),
      lastFundingRate: String(RATES.binance.rate), nextFundingTime: RATES.binance.next,
    });
  }
  if (p === '/fapi/v1/openInterest') {
    return send(res, { symbol: sym, openInterest: String(RATES.binance.oi), time: Date.now() });
  }

  // ---- Gate ----
  if (p.startsWith('/api/v4/futures/usdt/contracts/')) {
    return send(res, { name: 'BTC_USDT', funding_rate: RATES.gate.rate, mark_price: RATES.gate.mark });
  }

  // ---- Bybit ----
  if (p === '/v5/market/tickers') {
    return send(res, {
      retCode: 0, retMsg: 'OK',
      result: { list: [{
        symbol: sym, fundingRate: String(RATES.bybit.rate), markPrice: String(RATES.bybit.mark),
        openInterestValue: String(RATES.bybit.oi), indexPrice: String(RATES.bybit.mark),
      }] },
    });
  }

  // ---- OKX（本测试自包含，不依赖 mock-okx-v2）----
  if (p === '/api/v5/public/funding-rate') {
    return send(res, { code: '0', data: [{
      instId: 'BTC-USDT-SWAP', fundingRate: String(RATES.okx.rate),
      fundingTime: String(RATES.okx.next), nextFundingRate: String(RATES.okx.rate),
    }] });
  }
  if (p === '/api/v5/public/open-interest') {
    return send(res, { code: '0', data: [{
      instId: 'BTC-USDT-SWAP', oi: String(RATES.okx.oi), oiCcy: String(RATES.okx.oi * RATES.okx.mark),
    }] });
  }
  if (p === '/api/v5/market/ticker') {
    return send(res, { code: '0', data: [{ instId: 'BTC-USDT-SWAP', last: String(RATES.okx.mark) }] });
  }

  send(res, { error: 'not mocked', path: p }, 404);
});

// 跟踪连接：Node 在 Windows 上直接 close() 掉仍有 keep-alive socket 的 server
// 会报 “Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)”，先销毁再关。
const sockets = new Set();
server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
function closeAll() {
  return new Promise((resolve) => {
    sockets.forEach((s) => s.destroy());
    server.close(() => resolve());
  });
}

if (require.main === module) {
  const port = Number(process.env.XV_PORT || 4102);
  server.listen(port, () => console.log(`[mock-venues] binance/gate/bybit/okx listening on ${port}`));
}

module.exports = server;
module.exports.closeAll = closeAll;