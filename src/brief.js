'use strict';
/**
 * Crypto Market Pulse — 核心快报逻辑
 * 数据源: OKX 公开行情 API (无需鉴权)
 *   - 最新成交: GET /api/v5/market/ticker?instId=BTC-USDT
 *   - 日K线:    GET /api/v5/market/candles?instId=BTC-USDT&bar=1D&limit=35
 * 输出: 结构化 JSON + 中文 Markdown 报告
 */

const OKX_BASE = process.env.OKX_BASE || 'https://www.okx.com';
const CACHE_TTL_MS = 60_000;
const cache = new Map(); // key -> { at, data }

/** 计算常用技术指标: RSI(14)、20日高低点、波动率 */
function analyze(closes) {
  const n = closes.length;
  // RSI(14) — Wilder 平滑
  let gains = 0, losses = 0;
  const period = 14;
  for (let i = n - period; i < n; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);

  const window = closes.slice(-20);
  const hi20 = Math.max(...window);
  const lo20 = Math.min(...window);

  // 波动率: 近14日对数收益标准差年化
  const rets = [];
  for (let i = n - 14; i < n; i++) rets.push(Math.log(closes[i] / closes[i - 1]));
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, r) => a + (r - mean) ** 2, 0) / rets.length;
  const volAnnual = Math.sqrt(variance * 365) * 100;

  // 趋势判定: 短期(7日) vs 中期(30日)均值
  const ma = (k) => closes.slice(-k).reduce((a, b) => a + b, 0) / k;
  const ma7 = ma(Math.min(7, n));
  const ma30 = ma(Math.min(30, n));
  let trend = '中性';
  if (ma7 > ma30 * 1.01) trend = '上行';
  else if (ma7 < ma30 * 0.99) trend = '下行';

  return { rsi: +rsi.toFixed(1), hi20, lo20, volAnnual: +volAnnual.toFixed(1), trend, ma7, ma30 };
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'CryptoMarketPulse/1.0' } });
  if (!res.ok) throw new Error(`OKX API ${res.status}: ${url}`);
  const body = await res.json();
  if (body.code !== '0') throw new Error(`OKX API code=${body.code} msg=${body.msg}`);
  return body.data;
}

async function buildBrief(instId = 'BTC-USDT') {
  const key = `brief:${instId}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const [ticker] = await fetchJson(`${OKX_BASE}/api/v5/market/ticker?instId=${instId}`);
  const candles = await fetchJson(
    `${OKX_BASE}/api/v5/market/candles?instId=${instId}&bar=1D&limit=35`
  );
  // OKX K线返回为 [ts,o,h,l,c,vol...] 且按时间倒序
  const rows = candles.map((c) => ({
    ts: +c[0], open: +c[1], high: +c[2], low: +c[3], close: +c[4],
  })).reverse();

  const last = rows[rows.length - 1].close;
  const ch24 = ticker.open24h ? ((ticker.last - ticker.open24h) / ticker.open24h) * 100 : 0;
  const d7 = rows.length >= 8 ? ((last - rows[rows.length - 8].close) / rows[rows.length - 8].close) * 100 : null;
  const d30 = rows.length >= 31 ? ((last - rows[rows.length - 31].close) / rows[rows.length - 31].close) * 100 : null;

  const ind = analyze(rows.map((r) => r.close));

  // 市场状态判定
  let regime = '中性';
  if (ch24 > 3 && ind.rsi > 55) regime = '风险偏好';
  else if (ch24 < -3 || ind.rsi < 35) regime = '风险厌恶';

  const fact = {
    instId,
    asOf: new Date().toISOString(),
    price: +ticker.last,
    vol24hUsd: +ticker.volCcy24h,
    change: {
      '24h': +ch24.toFixed(2),
      ...(d7 != null ? { '7d': +d7.toFixed(2) } : {}),
      ...(d30 != null ? { '30d': +d30.toFixed(2) } : {}),
    },
    indicators: {
      rsi14: ind.rsi,
      trend: ind.trend,
      annualizedVolPct: ind.volAnnual,
      high20d: ind.hi20,
      low20d: ind.lo20,
    },
  };

  const analysis = {
    regime,
    keyLevels: {
      resistance: ind.hi20,
      support: ind.lo20,
      note: `20日区间 ${ind.lo20.toFixed(0)} ~ ${ind.hi20.toFixed(0)}；RSI ${ind.rsi}${ind.rsi > 70 ? '（超买区）' : ind.rsi < 30 ? '（超卖区）' : ''}`,
    },
    bias: regime === '风险偏好'
      ? '多头占优，但注意高位波动放大，突破前高可确认延续。'
      : regime === '风险厌恶'
        ? '空头压力明显，守住区间下沿前不宜激进。'
        : '方向未明，区间操作为主，等待突破确认。',
    disclaimer: '本报告为自动生成的市场信息，区分事实数据与分析判断，不构成投资建议。',
  };

  const md = [
    `# ${instId} 市场快报`,
    `> 生成时间: ${fact.asOf} (UTC) · 数据源: OKX`,
    '',
    '## 一、事实数据',
    `- 现价: **${fact.price}** USDT`,
    `- 24h 涨跌: **${fact.change['24h']}%**${fact.change['7d'] != null ? ` · 7d: ${fact.change['7d']}%` : ''}${fact.change['30d'] != null ? ` · 30d: ${fact.change['30d']}%` : ''}`,
    `- 24h 成交额: ${(fact.vol24hUsd / 1e6).toFixed(1)}M USDT`,
    `- RSI(14): ${ind.rsi} · 趋势: ${ind.trend} · 年化波动率: ${ind.volAnnual}%`,
    '',
    '## 二、关键位',
    `- 阻力(20日高): ${ind.hi20.toFixed(0)}`,
    `- 支撑(20日低): ${ind.lo20.toFixed(0)}`,
    '',
    '## 三、分析判断',
    `- 市场状态: **${regime}**`,
    `- ${analysis.bias}`,
    '',
    '---',
    `*${analysis.disclaimer}*`,
  ].join('\n');

  const data = { fact, analysis, report: md };
  cache.set(key, { at: Date.now(), data });
  return data;
}

/** 免费预览版：只暴露部分字段 */
function toPreview(data) {
  return {
    preview: true,
    instId: data.fact.instId,
    asOf: data.fact.asOf,
    price: data.fact.price,
    change24h: data.fact.change['24h'],
    regime: data.analysis.regime,
    upsell: '完整报告（RSI/趋势/关键位/Markdown 全文）需通过 x402 付费调用。',
  };
}

module.exports = { buildBrief, toPreview };
