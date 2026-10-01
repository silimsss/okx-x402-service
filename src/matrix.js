'use strict';
/**
 * 矩阵扩展模块：情绪仪表盘 / 资金费率雷达 / 三合一速览
 * 数据源：
 *   - alternative.me  https://api.alternative.me/fng/?limit=N  (免费无鉴权)
 *   - OKX 公开行情     /api/v5/public/funding-rate(-history), /api/v5/public/open-interest, /api/v5/market/tickers
 */

const OKX_BASE = process.env.OKX_BASE || 'https://www.okx.com';
const FNG_BASE = 'https://api.alternative.me';
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
  if (!res.ok) throw new Error(`upstream ${res.status}: ${url}`);
  return res.json();
}

/* ---------------- 1. 恐惧贪婪指数 ---------------- */

async function getFng(limit = 8) {
  return cached(`fng:${limit}`, 120_000, async () => {
    const j = await fetchJson(`${FNG_BASE}/fng/?limit=${limit}&format=json`);
    const rows = (j.data || []).map((d) => ({
      value: +d.value,
      label: d.value_classification,
      ts: +d.timestamp * 1000,
    }));
    if (!rows.length) throw new Error('empty fng response');
    return rows;
  });
}

function fngLabelZh(v) {
  if (v <= 24) return '极度恐惧';
  if (v <= 44) return '恐惧';
  if (v <= 55) return '中性';
  if (v <= 75) return '贪婪';
  return '极度贪婪';
}

async function sentimentReport() {
  const rows = await getFng(8);
  const now = rows[0];
  const week = rows.slice(0, 8);
  const values = week.map((r) => r.value);
  const avg7 = +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
  const min7 = Math.min(...values), max7 = Math.max(...values);
  const delta7 = +(now.value - values[values.length - 1]).toFixed(0);

  let bias;
  if (now.value <= 25) bias = '历史上此区域常伴随阶段性底部，但底部可以有更深的底部——分批与耐心优先。';
  else if (now.value <= 45) bias = '恐惧区，市场情绪谨慎；适合观察恐慌是否见底，而非追涨杀跌。';
  else if (now.value <= 55) bias = '中性区域，情绪无方向性指引，跟随结构与趋势。';
  else if (now.value <= 75) bias = '贪婪区，乐观情绪主导；注意拥挤交易与回调风险。';
  else bias = '极度贪婪，历史上此区域常伴随过热与剧烈回调风险，仓位管理优先。';

  return {
    fact: {
      asOf: new Date().toISOString(),
      index: now.value,
      label: now.label,
      labelZh: fngLabelZh(now.value),
      yesterday: rows[1] ? rows[1].value : null,
      lastWeek: rows[7] ? rows[7].value : null,
      week: week.map((r) => ({ date: new Date(r.ts).toISOString().slice(0, 10), value: r.value, label: r.label })),
      stats: { avg7, min7, max7, delta7 },
      source: 'alternative.me',
    },
    analysis: {
      bias,
      note: `7日均值 ${avg7}（区间 ${min7}~${max7}），较一周前${delta7 >= 0 ? '上升' : '下降'} ${Math.abs(delta7)} 点。`,
      disclaimer: '情绪指数为综合市场信息，不构成投资建议。',
    },
    report: [
      `# 市场情绪仪表盘（恐惧贪婪指数）`,
      `> ${new Date().toISOString()} · 数据源: alternative.me`,
      '',
      `## 当前读数`,
      `**${now.value} / 100 — ${fngLabelZh(now.value)}**（${now.label}）`,
      '',
      `## 一周走势`,
      ...week.map((r) => `- ${new Date(r.ts).toISOString().slice(0, 10)}: ${r.value}（${r.label}）`),
      '',
      `## 统计`,
      `- 7日均值: ${avg7} · 区间 ${min7} ~ ${max7} · 周变化: ${delta7 >= 0 ? '+' : ''}${delta7}`,
      '',
      `## 分析判断`,
      `- ${bias}`,
      '',
      `---`,
      `*情绪指数为综合市场信息，不构成投资建议。*`,
    ].join('\n'),
  };
}

function sentimentPreview(data) {
  return {
    preview: true,
    asOf: data.fact.asOf,
    index: data.fact.index,
    labelZh: data.fact.labelZh,
    avg7: data.fact.stats.avg7,
    upsell: '完整版含一周走势、7日统计与情绪区间分析。付费调用 /v1/sentiment。',
  };
}

/* ---------------- 2. 资金费率雷达 ---------------- */

const MAJOR_INSTS = ['BTC-USDT-SWAP', 'ETH-USDT-SWAP', 'SOL-USDT-SWAP', 'XRP-USDT-SWAP', 'OKB-USDT-SWAP', 'DOGE-USDT-SWAP', 'LTC-USDT-SWAP', 'ADA-USDT-SWAP'];

async function okxPublic(path) {
  return cached(`okx:${path}`, 60_000, async () => {
    let j;
    try {
      j = await fetchJson(OKX_BASE + path);
    } catch (err) {
      // 主站受限时回落到 OKX 海外入口（Render/海外服务器可直连 aws 域名）
      const alt = OKX_BASE.replace('www.okx.com', 'aws.okx.com');
      if (alt !== OKX_BASE) {
        j = await fetchJson(alt + path);
      } else throw err;
    }
    return j.data !== undefined ? j : j;
  });
}

function annualize(rate) { return +(rate * 3 * 365 * 100).toFixed(1); } // 每8h一次结算

async function fundingScan(instId) {
  if (instId) {
    const singleRes = await okxPublic(`/api/v5/public/funding-rate?instId=${instId}`);
    const single = Array.isArray(singleRes) ? singleRes[0] : (singleRes.data ? singleRes.data[0] : singleRes);
    if (!single) throw new Error(`no data for ${instId}`);
    return fmtFunding([single], false);
  }
  // 全量扫描：拉取所有 SWAP 资金费率（分批按 uly 组，避免单次全量被拒）
  // OKX funding-rate 全量接口不稳定，改用 instruments 先列再逐个查的成本太高，
  // 折中：先试全量 instType=SWAP，失败则用常见主流币列表
  let allRows;
  try {
    const all = await okxPublic('/api/v5/public/funding-rate?instType=SWAP');
    allRows = Array.isArray(all) ? all : all.data;
  } catch (e) {
    const fallback = [];
    for (const inst of MAJOR_INSTS) {
      try {
        const one = await okxPublic(`/api/v5/public/funding-rate?instId=${inst}`);
        const row = Array.isArray(one) ? one[0] : one.data ? one.data[0] : null;
        if (row) fallback.push(row);
      } catch (_) { /* skip */ }
    }
    allRows = fallback;
  }
  const tickers = await okxPublic('/api/v5/market/tickers?instType=SWAP');
  const tickRows = Array.isArray(tickers) ? tickers : tickers.data;
  const volMap = new Map(tickRows.map((t) => [t.instId, +t.volCcy24h || 0]));
  const rows = allRows
    .filter((r) => r.instId.endsWith('-USDT-SWAP'))
    .map((r) => ({ ...r, vol: volMap.get(r.instId) || 0 }))
    .sort((a, b) => b.vol - a.vol)
    .slice(0, 60);
  return fmtFunding(rows, true);
}

function fmtFunding(rows, ranked) {
  const items = rows.map((r) => ({
    instId: r.instId,
    fundingRate: +r.fundingRate,
    annualizedPct: annualize(+r.fundingRate),
    nextFundingTime: +r.fundingTime,
    ...(r.vol != null ? { vol24hUsd: r.vol } : {}),
  }));
  const positive = items.filter((i) => i.fundingRate > 0);
  const negative = items.filter((i) => i.fundingRate < 0);
  const extremes = ranked ? {
    mostPositive: [...items].sort((a, b) => b.fundingRate - a.fundingRate).slice(0, 5),
    mostNegative: [...items].sort((a, b) => a.fundingRate - b.fundingRate).slice(0, 5),
  } : undefined;
  const avg = items.length ? +(items.reduce((a, b) => a + b.fundingRate, 0) / items.length).toFixed(6) : 0;
  return {
    items,
    summary: {
      count: items.length,
      avgFundingRate: avg,
      avgAnnualizedPct: annualize(avg),
      positiveCount: positive.length,
      negativeCount: negative.length,
      sentimentHint: avg > 0.0003 ? '多数永续多头付费，市场偏多头拥挤' : avg < -0.0003 ? '多数永续空头付费，市场偏空头拥挤' : '费率中性',
      ...(extremes || {}),
    },
    generatedAt: new Date().toISOString(),
  };
}

function fundingReport(data, instId) {
  const s = data.summary;
  const lines = [
    `# 资金费率雷达${instId ? ` · ${instId}` : ' · OKX 全永续扫描'}`,
    `> ${data.generatedAt} · 数据源: OKX`,
    '',
    `## 总览`,
    `- 统计 ${s.count} 个 USDT 永续`,
    `- 平均费率: ${s.avgFundingRate}（年化 ${s.avgAnnualizedPct}%）`,
    `- 多头付费: ${s.positiveCount} 个 · 空头付费: ${s.negativeCount} 个`,
    `- 市场暗示: ${s.sentimentHint}`,
    '',
  ];
  if (s.mostPositive) {
    lines.push('## 费率最高（多头拥挤）');
    s.mostPositive.forEach((i) => lines.push(`- ${i.instId}: ${i.fundingRate}（年化 ${i.annualizedPct}%）`));
    lines.push('');
    lines.push('## 费率最低（空头拥挤）');
    s.mostNegative.forEach((i) => lines.push(`- ${i.instId}: ${i.fundingRate}（年化 ${i.annualizedPct}%）`));
    lines.push('');
  }
  lines.push('## 明细');
  data.items.slice(0, 20).forEach((i) => lines.push(`- ${i.instId}: ${i.fundingRate}（年化 ${i.annualizedPct}%）`));
  lines.push('', '---', '*费率为公开市场数据与区间事实描述，不构成投资建议。*');
  return lines.join('\n');
}

function fundingPreview(data) {
  const s = data.summary;
  return {
    preview: true,
    generatedAt: data.generatedAt,
    scanned: s.count,
    avgFundingRate: s.avgFundingRate,
    sentimentHint: s.sentimentHint,
    upsell: '完整版含 Top20 明细、费率极值榜与年化换算。付费调用 /v1/funding。',
  };
}

/* ---------------- 3. 三合一速览 ---------------- */

async function comboBrief(instId) {
  const [fng, spot, funding] = await Promise.all([
    getFng(8).catch(() => null),
    okxPublic(`/api/v5/market/ticker?instId=${instId}`).catch(() => { throw new Error(`bad instId: ${instId}`); }),
    okxPublic(`/api/v5/public/funding-rate?instId=${instId}-SWAP`).catch(() => null),
  ]);
  const t = spot.data[0];
  const ch24 = t.open24h ? +(((+t.last) - (+t.open24h)) / (+t.open24h) * 100).toFixed(2) : null;
  const f = funding && funding.data[0];
  const fr = f ? +f.fundingRate : null;
  const senti = fng ? fng[0].value : null;

  let context;
  if (senti != null && fr != null) {
    if (senti >= 75 && fr > 0.0003) context = '情绪贪婪且多头拥挤——典型的过热组合，注意回调风险。';
    else if (senti <= 25 && fr < -0.0003) context = '情绪恐惧且空头拥挤——负费率+恐慌，反向信号常在此出现。';
    else if (senti >= 55 && fr < 0) context = '情绪乐观但费率偏空——多空分歧，等待方向确认。';
    else if (senti <= 45 && fr > 0) context = '情绪谨慎但多头仍付费——下有承接，观望为主。';
    else context = '情绪与费率方向一致，中性观察。';
  } else context = '部分数据源暂不可用，仅提供行情事实。';

  return {
    asOf: new Date().toISOString(),
    instId,
    price: +t.last,
    change24hPct: ch24,
    vol24hUsd: +t.volCcy24h,
    sentiment: senti != null ? { value: senti, labelZh: fngLabelZh(senti) } : null,
    funding: fr != null ? { rate: fr, annualizedPct: annualize(fr), nextTime: +f.fundingTime } : null,
    context,
    disclaimer: '多源事实汇总与情境描述，不构成投资建议。',
  };
}

function comboPreview(data) {
  return {
    preview: true,
    instId: data.instId,
    price: data.price,
    change24hPct: data.change24hPct,
    sentiment: data.sentiment,
    upsell: '完整版含资金费率与组合情境判断。付费调用 /v1/combo/:instId。',
  };
}

module.exports = {
  okxPublic,
  sentimentReport, sentimentPreview,
  fundingScan, fundingReport, fundingPreview,
  comboBrief, comboPreview,
};
