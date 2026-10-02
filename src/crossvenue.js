'use strict';
/**
 * 跨交易所对比模块（差异化能力）
 *
 * 为什么单独做这个：现有 /v1/funding 只扫 OKX 自家费率，而资金费率是逐交易所
 * 独立的定价。同一时刻同一个 BTCUSDT 永续，Binance / OKX / Gate / Bybit 的费率
 * 可以相差数倍——对 OKX 交易者来说，「在本所能拿到的」永远只是其中一档，
 * 跨所价差才是决策信息。
 *
 * 这也是单一交易所结构上给不了的东西：交易所不会发布一个揭露自家持仓相对
 * 市场同侪贵或便宜的工具，所以本文档不假设任何一家是基准，OKX 只是默认参照。
 *
 * 数据源（全部公开行情、免鉴权、无需 API Key）：
 *   - Binance  https://fapi.binance.com/fapi/v1/premiumIndex | /fapi/v1/openInterest
 *   - OKX      https://www.okx.com/api/v5/public/funding-rate | /public/open-interest
 *   - Gate     https://api.gateio.ws/api/v4/futures/usdt/contracts/{contract}
 *   - Bybit    https://api.bybit.com/v5/market/tickers?category=linear
 */

const OKX_BASE = process.env.OKX_BASE || 'https://www.okx.com';
// 其余三家同样做成可覆盖：测试时全部指向本地 mock，避免冒烟测试依赖真实外网
const BINANCE_BASE = process.env.BINANCE_BASE || 'https://fapi.binance.com';
const GATE_BASE = process.env.GATE_BASE || 'https://api.gateio.ws';
const BYBIT_BASE = process.env.BYBIT_BASE || 'https://api.bybit.com';
const CACHE_TTL_MS = 60_000;
const cache = new Map();

async function cached(key, ttl, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.data;
  const data = await fn();
  cache.set(key, { at: Date.now(), data });
  return data;
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'CryptoMarketPulse/1.0' } });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  return res.json();
}

/** 每 8 小时结算一次 -> 年化百分比 */
function annualize(rate) { return +(rate * 3 * 365 * 100).toFixed(2); }

/** BTC-USDT-SWAP / BTCUSDT / BTC_USDT / BTCUSDT-SWAP / btcusdt -> 统一成 BTC/USDT */
function parseSymbol(raw) {
  const s = String(raw || 'BTC-USDT-SWAP')
    .trim().toUpperCase()
    .replace(/[\s/]+/g, '-')
    .replace(/_+/g, '-');
  // 去掉永续后缀，剩下的要么是 BASE-QUOTE，要么是拼在一起的 BASEQUOTE
  const parts = s.replace(/-(SWAP|PERP|P)$/, '').split('-').filter(Boolean);
  let base = parts[0];
  if (!base) throw new Error(`bad symbol: ${raw}`);
  let settle = 'USDT';
  if (parts.length >= 2) {
    if (parts[1] === 'USDT' || parts[1] === 'USD') settle = parts[1];
  } else if (base.endsWith('USDT') && base.length > 4) {
    base = base.slice(0, -4); // 紧凑写法 BTCUSDT
  } else if (base.endsWith('USD') && base.length > 3) {
    base = base.slice(0, -3);
    settle = 'USD';
  }
  return { base, settle, compact: `${base}${settle}` };
}

/* ---------------- 各交易所适配器 ----------------
 * 每个适配器只负责取自己那一份，拿不到就抛错，由上层 allSettled 兜住，
 * 单家故障不能拖垮整个响应。 */

const VENUES = [
  {
    id: 'okx',
    label: 'OKX',
    funding: async (sym) => {
      const j = await fetchJson(`${OKX_BASE}/api/v5/public/funding-rate?instId=${sym.base}-${sym.settle}-SWAP`);
      const r = j.data && j.data[0];
      if (!r) throw new Error('empty');
      return { rate: +r.fundingRate, nextTime: +r.fundingTime };
    },
    openInterest: async (sym) => {
      const j = await fetchJson(`${OKX_BASE}/api/v5/public/open-interest?instType=SWAP&instId=${sym.base}-${sym.settle}-SWAP`);
      const r = j.data && j.data[0];
      if (!r) throw new Error('empty');
      return { contracts: +r.oi, quoteCcy: +r.oiCcy };
    },
    markPrice: async (sym) => {
      const j = await fetchJson(`${OKX_BASE}/api/v5/market/ticker?instId=${sym.base}-${sym.settle}-SWAP`);
      const r = j.data && j.data[0];
      return r ? +r.last : null;
    },
  },
  {
    id: 'binance',
    label: 'Binance',
    funding: async (sym) => {
      const j = await fetchJson(`${BINANCE_BASE}/fapi/v1/premiumIndex?symbol=${sym.compact}`);
      if (j.lastFundingRate == null) throw new Error('empty');
      return { rate: +j.lastFundingRate, nextTime: +j.nextFundingTime };
    },
    openInterest: async (sym) => {
      const j = await fetchJson(`${BINANCE_BASE}/fapi/v1/openInterest?symbol=${sym.compact}`);
      return { contracts: +j.openInterest };
    },
    markPrice: async (sym) => {
      const j = await fetchJson(`${BINANCE_BASE}/fapi/v1/premiumIndex?symbol=${sym.compact}`);
      return j.markPrice != null ? +j.markPrice : null;
    },
  },
  {
    id: 'gate',
    label: 'Gate',
    funding: async (sym) => {
      const j = await fetchJson(`${GATE_BASE}/api/v4/futures/usdt/contracts/${sym.base}_${sym.settle}`);
      if (j.funding_rate == null) throw new Error('empty');
      return { rate: +j.funding_rate, nextTime: null };
    },
    openInterest: () => Promise.reject(new Error('not exposed')),
    markPrice: async (sym) => {
      const j = await fetchJson(`${GATE_BASE}/api/v4/futures/usdt/contracts/${sym.base}_${sym.settle}`);
      return j.mark_price != null ? +j.mark_price : null;
    },
  },
  {
    id: 'bybit',
    label: 'Bybit',
    funding: async (sym) => {
      const j = await fetchJson(`${BYBIT_BASE}/v5/market/tickers?category=linear&symbol=${sym.compact}`);
      const r = j.result && j.result.list && j.result.list[0];
      if (!r || r.fundingRate == null) throw new Error('empty');
      return { rate: +r.fundingRate, nextTime: null };
    },
    openInterest: async (sym) => {
      const j = await fetchJson(`${BYBIT_BASE}/v5/market/tickers?category=linear&symbol=${sym.compact}`);
      const r = j.result && j.result.list && j.result.list[0];
      return { contracts: +r.openInterestValue, quoteCcy: +r.openInterestValue };
    },
    markPrice: async (sym) => {
      const j = await fetchJson(`${BYBIT_BASE}/v5/market/tickers?category=linear&symbol=${sym.compact}`);
      const r = j.result && j.result.list && j.result.list[0];
      return r.markPrice != null ? +r.markPrice : null;
    },
  },
];

/* ---------------- 主查询 ---------------- */

async function crossVenue(symbol) {
  const sym = parseSymbol(symbol);
  return cached(`xv:${sym.base}/${sym.settle}`, CACHE_TTL_MS, async () => {
    const rows = await Promise.all(VENUES.map(async (v) => {
      const [f, oi, px] = await Promise.allSettled([
        v.funding(sym), v.openInterest ? v.openInterest(sym) : Promise.reject(new Error('n/a')), v.markPrice(sym),
      ]);
      if (f.status !== 'fulfilled') {
        return { venue: v.id, label: v.label, ok: false, error: f.reason && f.reason.message };
      }
      return {
        venue: v.id,
        label: v.label,
        ok: true,
        fundingRate: f.value.rate,
        annualizedPct: annualize(f.value.rate),
        nextFundingTime: f.value.nextTime || null,
        // 各所 OI 计价单位不同（张数 vs 名义价值），仅标注不跨所相加
        openInterest: oi.status === 'fulfilled' ? oi.value : null,
        markPrice: px.status === 'fulfilled' ? px.value : null,
      };
    }));

    const ok = rows.filter((r) => r.ok);
    // 以 OKX 为参照（我们的买家就在 OKX），缺失时退化为均值
    const ref = rows.find((r) => r.venue === 'okx' && r.ok) || (ok.length ? { fundingRate: ok.reduce((a, b) => a + b.fundingRate, 0) / ok.length } : null);

    const spread = ok.length >= 2 ? {
      venueCount: ok.length,
      min: ok.reduce((a, b) => (a.fundingRate < b.fundingRate ? a : b)),
      max: ok.reduce((a, b) => (a.fundingRate > b.fundingRate ? a : b)),
    } : null;

    let gap;
    if (spread && ref && spread.min.fundingRate !== spread.max.fundingRate) {
      const lo = spread.min.fundingRate, hi = spread.max.fundingRate;
      // 用绝对值比，避免负费率除以负费率得出误导性的“倍数”
      gap = {
        ratioAbs: +(Math.max(Math.abs(hi), Math.abs(lo)) / Math.max(Math.min(Math.abs(hi), Math.abs(lo)), 1e-9)).toFixed(1),
        annualizedGapPct: +(annualize(hi) - annualize(lo)).toFixed(2),
      };
    }

    return {
      asOf: new Date().toISOString(),
      symbol: `${sym.base}-${sym.settle}`,
      venues: rows,
      summary: {
        okCount: ok.length,
        totalCount: rows.length,
        referenceVenue: ref ? (rows.find((r) => r.venue === 'okx' && r.ok) ? 'okx' : 'mean') : null,
        cheapest: spread ? spread.min.label : null,
        dearest: spread ? spread.max.label : null,
        ...(gap || {}),
      },
      caveat: '各家费率结算周期与计价币种可能不同，年化为按每 8 小时一次的等比换算，仅用于横向比较，不等于实际可实现收益。跨所搬砖还需考虑手续费、滑点与出入金成本。',
    };
  });
}

function crossVenueReport(d) {
  const s = d.summary;
  const lines = [
    `# 跨交易所资金费率对比 · ${d.symbol}`,
    `> ${d.asOf} · 数据源: Binance / OKX / Gate / Bybit 公开行情`,
    '',
    `## 明细`,
    '| 交易所 | 8h 费率 | 年化 | 标记价 |',
    '|---|---|---|---|',
  ];
  for (const v of d.venues) {
    if (!v.ok) { lines.push(`| ${v.label} | 取数失败 | — | — |`); continue; }
    lines.push(`| ${v.label} | ${(v.fundingRate * 100).toFixed(4)}% | ${v.annualizedPct}% | ${v.markPrice ?? '—'} |`);
  }
  lines.push('', '## 价差');
  if (s.okCount >= 2 && s.ratioAbs) {
    lines.push(`- 最贵: ${s.dearest} · 最便宜: ${s.cheapest}`);
    lines.push(`- 费率倍数差: **${s.ratioAbs}x** · 年化差 **${s.annualizedGapPct} 个百分点**`);
    lines.push(`- 本服务买家基准（${s.referenceVenue === 'okx' ? 'OKX' : '四所均值'}）处于上述区间之内`);
  } else {
    lines.push(`- 仅 ${s.okCount}/${s.totalCount} 家取数成功，本轮不输出价差结论`);
  }
  lines.push('', '## 注意', `- ${d.caveat}`, '', '---', '*公开市场数据与区间事实描述，不构成投资建议。*');
  return lines.join('\n');
}

function crossVenuePreview(d) {
  const s = d.summary;
  return {
    preview: true,
    asOf: d.asOf,
    symbol: d.symbol,
    okCount: s.okCount,
    cheapest: s.cheapest,
    dearest: s.dearest,
    ...(s.ratioAbs ? { ratioAbs: s.ratioAbs, annualizedGapPct: s.annualizedGapPct } : {}),
    upsell: '完整版含各家费率原值、标记价与跨所价差倍数。付费调用 /v1/crossvenue。',
  };
}

module.exports = { crossVenue, crossVenueReport, crossVenuePreview, parseSymbol, VENUES };