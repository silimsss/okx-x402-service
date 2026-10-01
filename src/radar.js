'use strict';
/**
 * 雷达矩阵模块：聪明钱仓位雷达 / 全市场爆仓雷达 / 持仓量异动监控
 * 数据源（OKX 公开接口，全部免鉴权，2026-10-01 逐条实测通过）：
 *   - /api/v5/rubik/stat/contracts/long-short-account-ratio                      全网多空账户比 (ccy)
 *   - /api/v5/rubik/stat/contracts/long-short-position-ratio-contract-top-trader 大户持仓多空比 (instId)
 *   - /api/v5/rubik/stat/contracts/long-short-account-ratio-contract-top-trader  大户账户多空比 (instId)
 *   - /api/v5/rubik/stat/taker-volume-contract                                   合约主动买卖量 (instId)
 *   - /api/v5/rubik/stat/contracts/open-interest-volume                          币种合约 OI+成交 (ccy)
 *   - /api/v5/public/open-interest?instType=SWAP                                 全量合约 OI
 *   - /api/v5/rubik/stat/contracts/open-interest-history?instId=X&bar=1H         单合约 OI 小时线
 *   - /api/v5/public/liquidation-orders?instType=SWAP&uly=X&state=filled         爆仓单 (uly 必填)
 *   - /api/v5/public/instruments?instType=SWAP                                   合约规格（ctVal 金额换算）
 * 复用 matrix.js 的 okxPublic（60s 缓存 + www.okx.com 失败回落 aws.okx.com）。
 */

const { okxPublic } = require('./matrix');

const SMART_COINS = ['BTC', 'ETH', 'SOL'];
const LIQ_ULYS = [
  'BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'XRP-USDT', 'DOGE-USDT',
  'LTC-USDT', 'ADA-USDT', 'OKB-USDT', 'BTC-USD', 'ETH-USD',
];
const OI_FALLBACK_INSTS = [
  'BTC-USDT-SWAP', 'ETH-USDT-SWAP', 'SOL-USDT-SWAP', 'XRP-USDT-SWAP',
  'DOGE-USDT-SWAP', 'LTC-USDT-SWAP', 'ADA-USDT-SWAP', 'OKB-USDT-SWAP',
];

const num = (x) => { const v = +x; return Number.isFinite(v) ? v : null; };

/* rubik/历史类接口返回 [[ts, v, ...], ...]，统一升序整理 */
function series(rows) {
  return (rows || [])
    .filter((r) => Array.isArray(r) && r.length >= 2)
    .map((r) => r.map((x) => (typeof x === 'string' && x !== '' && !isNaN(+x) ? +x : x)))
    .sort((a, b) => a[0] - b[0]);
}
function lastVal(rows) { const s = series(rows); return s.length ? num(s[s.length - 1][1]) : null; }

async function okxData(path) {
  const j = await okxPublic(path);
  return Array.isArray(j) ? j : j.data;
}

/* ---------------- 合约规格（ctVal 换算用，60s 缓存足够） ---------------- */

async function getInstrumentMap() {
  const rows = await okxData('/api/v5/public/instruments?instType=SWAP');
  const map = new Map();
  for (const r of rows || []) {
    map.set(r.instId, { ctVal: num(r.ctVal) || 0, ctType: r.ctType, ctValCcy: r.ctValCcy, uly: r.uly });
  }
  return map;
}

/* ---------------- 1. 聪明钱仓位雷达 ---------------- */

function divVerdict(topPos, retail) {
  if (topPos == null || retail == null) return '大户或散户多空比数据暂缺，无法判断分歧。';
  const smartBull = topPos >= 1, crowdBull = retail >= 1;
  if (smartBull !== crowdBull) {
    if (!smartBull && retail > 1.2) return `大户持仓偏空（${topPos}）而散户明显偏多（${retail}）——筹码分歧显著，警惕多头拥挤后的踩踏风险。`;
    if (smartBull && retail < 0.8) return `大户持仓偏多（${topPos}）而散户明显偏空（${retail}）——散户恐慌或为反向线索，关注大户是否在吸筹。`;
    return `大户持仓${smartBull ? '偏多' : '偏空'}、散户${crowdBull ? '偏多' : '偏空'}，方向存在分歧。`;
  }
  return `大户与散户同向${smartBull ? '偏多' : '偏空'}（大户 ${topPos} / 散户 ${retail}），共识较强，顺趋势但注意拥挤度。`;
}

function smartCoin(ccy) {
  const c = String(ccy || '').toUpperCase();
  const instId = `${c}-USDT-SWAP`;
  const jobs = [
    ['retail', `/api/v5/rubik/stat/contracts/long-short-account-ratio?ccy=${c}&period=5m`],
    ['topPos', `/api/v5/rubik/stat/contracts/long-short-position-ratio-contract-top-trader?instId=${instId}&period=5m`],
    ['topAcct', `/api/v5/rubik/stat/contracts/long-short-account-ratio-contract-top-trader?instId=${instId}&period=5m`],
    ['taker', `/api/v5/rubik/stat/taker-volume-contract?instId=${instId}&period=5m`],
    ['oiVol', `/api/v5/rubik/stat/contracts/open-interest-volume?ccy=${c}&period=5m`],
  ];
  return (async () => {
    const out = { ccy: c, instId };
    for (const [key, path] of jobs) {
      try { out[key] = await okxData(path); }
      catch (err) { out[key] = null; out[`${key}Err`] = String(err.message || err).slice(0, 80); }
    }
    const retail = lastVal(out.retail);
    const topPos = lastVal(out.topPos);
    const topAcct = lastVal(out.topAcct);
    const tk = series(out.taker).slice(-12); // 近 1 小时
    const buy = tk.reduce((a, r) => a + (num(r[1]) || 0), 0);
    const sell = tk.reduce((a, r) => a + (num(r[2]) || 0), 0);
    const buySharePct = buy + sell > 0 ? +((buy / (buy + sell)) * 100).toFixed(1) : null;
    const oiS = series(out.oiVol);
    const oiUsd = oiS.length ? num(oiS[oiS.length - 1][1]) : null;
    const oiPrev = oiS.length > 12 ? num(oiS[oiS.length - 13][1]) : null;
    const oiChange1hPct = oiUsd != null && oiPrev ? +(((oiUsd - oiPrev) / oiPrev) * 100).toFixed(2) : null;

    // 聪明钱综合偏向：大户持仓/账户为主，主动买卖为辅，散户反向半权重
    let score = 0, parts = 0;
    if (topPos != null) { score += (topPos - 1) * 2; parts++; }
    if (topAcct != null) { score += (topAcct - 1); parts++; }
    if (buySharePct != null) { score += (buySharePct - 50) / 25; parts++; }
    if (retail != null) { score -= (retail - 1) * 0.5; parts++; }
    const bias = !parts ? '数据不足' : score > 0.15 ? '偏多' : score < -0.15 ? '偏空' : '中性';

    return {
      ccy: c,
      instId,
      topTraderPositionRatio: topPos,
      topTraderAccountRatio: topAcct,
      retailRatio: retail,
      taker1h: buySharePct != null ? { buySharePct, sellSharePct: +(100 - buySharePct).toFixed(1), lean: buySharePct > 55 ? '主动买占优' : buySharePct < 45 ? '主动卖占优' : '买卖均衡' } : null,
      openInterestUsd: oiUsd,
      oiChange1hPct,
      smartBias: bias,
      divergence: divVerdict(topPos, retail),
    };
  })();
}

async function smartScan(ccys) {
  const list = (ccys && ccys.length ? ccys : SMART_COINS).map((c) => String(c).toUpperCase()).slice(0, 6);
  const coins = [];
  for (const c of list) coins.push(await smartCoin(c)); // 串行：尊重 rubik 5次/2秒 限速
  const bulls = coins.filter((c) => c.smartBias === '偏多').length;
  const bears = coins.filter((c) => c.smartBias === '偏空').length;
  const stance = bulls > bears ? `聪明钱整体偏多（${bulls}/${coins.length} 币种偏多）` : bears > bulls ? `聪明钱整体偏空（${bears}/${coins.length} 币种偏空）` : '聪明钱态度分化或中性';
  return { generatedAt: new Date().toISOString(), coins, summary: { scanned: coins.length, bulls, bears, stance }, disclaimer: '多空比与主动买卖量为公开市场数据，偏向判断为启发式规则，不构成投资建议。' };
}

function smartReport(data) {
  const lines = [
    `# 聪明钱仓位雷达`,
    `> ${data.generatedAt} · 数据源: OKX 公开持仓统计`,
    '',
    `## 总览`,
    `- ${data.summary.stance}`,
    '',
  ];
  for (const c of data.coins) {
    lines.push(`## ${c.ccy}（${c.instId}）`);
    if (c.topTraderPositionRatio != null) lines.push(`- 大户持仓多空比: ${c.topTraderPositionRatio}${c.topTraderAccountRatio != null ? ` · 大户账户多空比: ${c.topTraderAccountRatio}` : ''}`);
    if (c.retailRatio != null) lines.push(`- 全网散户多空比: ${c.retailRatio}`);
    if (c.taker1h) lines.push(`- 近1小时主动买卖: 买 ${c.taker1h.buySharePct}% / 卖 ${c.taker1h.sellSharePct}%（${c.taker1h.lean}）`);
    if (c.openInterestUsd != null) lines.push(`- 合约持仓量: $${fmtUsd(c.openInterestUsd)}${c.oiChange1hPct != null ? `（1小时 ${c.oiChange1hPct >= 0 ? '+' : ''}${c.oiChange1hPct}%）` : ''}`);
    lines.push(`- 聪明钱偏向: **${c.smartBias}**`);
    lines.push(`- 分歧判断: ${c.divergence}`);
    lines.push('');
  }
  lines.push('---', '*偏向判断为启发式规则输出，不构成投资建议。*');
  return lines.join('\n');
}

function smartPreview(data) {
  const btc = data.coins.find((c) => c.ccy === 'BTC') || data.coins[0];
  if (!btc) return { preview: true, note: '数据暂缺' };
  return {
    preview: true,
    generatedAt: data.generatedAt,
    ccy: btc.ccy,
    topTraderPositionRatio: btc.topTraderPositionRatio,
    retailRatio: btc.retailRatio,
    smartBias: btc.smartBias,
    taker1h: btc.taker1h,
    upsell: '免费版仅 BTC 单币快照。完整版覆盖 BTC/ETH/SOL（或指定币种）的大户/散户多空分歧、主动买卖压力与持仓变化。付费调用 /v1/smartmoney。',
  };
}

/* ---------------- 2. 全市场爆仓雷达 ---------------- */

function liqItemUsd(d, spec) {
  const sz = num(d.sz) || 0, px = num(d.bkPx) || 0, ctVal = (spec && spec.ctVal) || 0;
  const usd = spec && spec.ctType === 'inverse' ? sz * ctVal : sz * ctVal * px;
  return +usd.toFixed(0);
}

function aggSide(items) {
  const longs = items.filter((x) => x.side === 'long');
  const shorts = items.filter((x) => x.side === 'short');
  const sum = (arr) => +arr.reduce((a, x) => a + x.usd, 0).toFixed(0);
  const big = (arr) => arr.length ? arr.reduce((a, x) => (x.usd > a.usd ? x : a)) : null;
  return {
    longCount: longs.length, shortCount: shorts.length,
    longUsd: sum(longs), shortUsd: sum(shorts),
    biggestLong: big(longs), biggestShort: big(shorts),
  };
}

async function liqScan(ulys) {
  const list = (ulys && ulys.length ? ulys : LIQ_ULYS).slice(0, 12);
  const instMap = await getInstrumentMap().catch(() => new Map());
  const cutoff = Date.now() - 24 * 3600_000;
  const all = [];
  const perInst = [];
  for (const uly of list) {
    try {
      const rows = await okxData(`/api/v5/public/liquidation-orders?instType=SWAP&uly=${uly}&state=filled`);
      const head = (rows && rows[0]) || {};
      const spec = instMap.get(head.instId || `${uly}-SWAP`) || null;
      const items = (head.details || [])
        .map((d) => ({ ts: +d.ts, side: d.posSide, sz: num(d.sz), px: num(d.bkPx), usd: liqItemUsd(d, spec) }))
        .filter((x) => x.ts >= cutoff && x.usd > 0)
        .sort((a, b) => b.ts - a.ts);
      const a = aggSide(items);
      perInst.push({ uly, instId: head.instId || `${uly}-SWAP`, ...a });
      for (const x of items) all.push({ ...x, uly });
    } catch (err) {
      perInst.push({ uly, error: String(err.message || err).slice(0, 80) });
    }
  }
  const total = aggSide(all);
  const top5 = [...all].sort((a, b) => b.usd - a.usd).slice(0, 5);
  const ratio = total.shortUsd > 0 ? +(total.longUsd / total.shortUsd).toFixed(2) : null;
  let verdict;
  if (!all.length) verdict = '近 24 小时扫描范围内无爆仓记录，杠杆情绪平稳。';
  else if (ratio != null && ratio >= 2) verdict = `多头踩踏：多头强平金额是空头的 ${ratio} 倍，市场正在清洗多头杠杆。`;
  else if (ratio != null && ratio <= 0.5) verdict = `空头挤压：空头强平金额是多头的 ${+(1 / ratio).toFixed(2)} 倍，逼空行情特征明显。`;
  else verdict = '多空强平相对均衡，暂无单边踩踏。';
  return {
    generatedAt: new Date().toISOString(),
    windowHours: 24,
    scannedUlys: list.length,
    total,
    ratioLongVsShortUsd: ratio,
    topLiquidations: top5,
    perInstrument: perInst.sort((a, b) => ((b.longUsd + b.shortUsd) || 0) - ((a.longUsd + a.shortUsd) || 0)),
    verdict,
    disclaimer: 'OKX 该接口为近期强平抽样，不代表全平台爆仓总量；数据为公开市场事实，不构成投资建议。',
  };
}

function fmtUsd(v) {
  if (v == null) return '-';
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(v);
}

function liqReport(data) {
  const t = data.total;
  const lines = [
    `# 全市场爆仓雷达（近 ${data.windowHours} 小时）`,
    `> ${data.generatedAt} · 数据源: OKX 强平公开数据 · 扫描 ${data.scannedUlys} 个主流永续`,
    '',
    `## 总览`,
    `- 多头爆仓: ${t.longCount} 笔 / $${fmtUsd(t.longUsd)}`,
    `- 空头爆仓: ${t.shortCount} 笔 / $${fmtUsd(t.shortUsd)}`,
    `- 多空强平金额比: ${data.ratioLongVsShortUsd ?? '-'}`,
    `- 判定: **${data.verdict}**`,
    '',
    `## 单笔最大爆仓 Top5`,
  ];
  for (const x of data.topLiquidations) {
    lines.push(`- ${x.uly}: ${x.side === 'long' ? '多单' : '空单'} $${fmtUsd(x.usd)}（${x.sz} 张 @ ${x.px}）`);
  }
  lines.push('', `## 分币种统计`);
  for (const p of data.perInstrument) {
    if (p.error) { lines.push(`- ${p.uly}: 数据获取失败`); continue; }
    lines.push(`- ${p.uly}: 多 $${fmtUsd(p.longUsd)}（${p.longCount} 笔）/ 空 $${fmtUsd(p.shortUsd)}（${p.shortCount} 笔）`);
  }
  lines.push('', '---', `*${data.disclaimer}*`);
  return lines.join('\n');
}

function liqPreview(data) {
  const t = data.total;
  return {
    preview: true,
    generatedAt: data.generatedAt,
    scannedNote: '免费版仅扫描 BTC（USDT+USD 永续）',
    longUsd: t.longUsd,
    shortUsd: t.shortUsd,
    verdict: data.verdict,
    upsell: '完整版覆盖 BTC/ETH/SOL/XRP/DOGE/LTC/ADA/OKB 等 10 个主流永续，含单笔 Top5 与分币种统计。付费调用 /v1/liquidation。',
  };
}

/* ---------------- 3. 持仓量异动监控 ---------------- */

function oiMomentum(histRows) {
  const s = series(histRows).map((r) => ({ ts: r[0], oi: num(r[1]), oiUsd: r[3] != null ? num(r[3]) : null }));
  if (!s.length) return null;
  const pick = (x) => (x.oiUsd != null ? x.oiUsd : x.oi);
  const nowOi = pick(s[s.length - 1]);
  const at = (back) => (s.length > back ? pick(s[s.length - 1 - back]) : null);
  const prev6 = at(6), prev24 = at(24);
  const pct = (a, b) => (a != null && b ? +(((a - b) / b) * 100).toFixed(2) : null);
  return { latestOi: nowOi, change6hPct: pct(nowOi, prev6), change24hPct: pct(nowOi, prev24) };
}

function oiAnomaly(oiChg24, oiChg6, priceChg24) {
  if (oiChg24 == null) return null;
  if (oiChg24 >= 8 && priceChg24 != null && priceChg24 < 2) return `持仓 24h +${oiChg24}% 而价格仅 ${priceChg24}%——增仓滞涨，多空分歧加大，警惕突破方向。`;
  if (oiChg24 >= 8 && priceChg24 != null && priceChg24 >= 3) return `持仓 24h +${oiChg24}% 且价格上涨 ${priceChg24}%——新资金入场推涨，趋势有增量支撑。`;
  if (oiChg24 <= -8) return `持仓 24h ${oiChg24}%——大幅减仓，获利了结或杠杆出清中。`;
  if (oiChg6 != null && Math.abs(oiChg6) >= 4) return `持仓 6h ${oiChg6 > 0 ? '+' : ''}${oiChg6}%——短线异动，关注后续方向。`;
  return null;
}

async function oiScan() {
  let totalOiUsd = null, marketCount = 0, top10 = null, degraded = false;
  try {
    const rows = await okxData('/api/v5/public/open-interest?instType=SWAP');
    if (rows && rows.length) {
      marketCount = rows.length;
      totalOiUsd = +rows.reduce((a, r) => a + (num(r.oiUsd) || 0), 0).toFixed(0);
      top10 = [...rows]
        .sort((a, b) => (num(b.oiUsd) || 0) - (num(a.oiUsd) || 0))
        .slice(0, 10)
        .map((r) => ({ instId: r.instId, oiUsd: +(num(r.oiUsd) || 0).toFixed(0), oiCcy: +(num(r.oiCcy) || 0).toFixed(2) }));
    }
  } catch (_) { degraded = true; }
  if (!top10) {
    degraded = true;
    top10 = [];
    for (const inst of OI_FALLBACK_INSTS) {
      try {
        const one = await okxData(`/api/v5/public/open-interest?instType=SWAP&instId=${inst}`);
        if (one && one[0]) top10.push({ instId: one[0].instId, oiUsd: +(num(one[0].oiUsd) || 0).toFixed(0), oiCcy: +(num(one[0].oiCcy) || 0).toFixed(2) });
      } catch (_) { /* skip */ }
    }
    top10.sort((a, b) => b.oiUsd - a.oiUsd);
    totalOiUsd = top10.reduce((a, r) => a + r.oiUsd, 0);
  }
  const coins = [];
  for (const c of SMART_COINS) {
    const instId = `${c}-USDT-SWAP`;
    try {
      const hist = await okxData(`/api/v5/rubik/stat/contracts/open-interest-history?instId=${instId}&bar=1H&limit=72`);
      const m = oiMomentum(hist);
      let price = null, priceChg24 = null;
      try {
        const t = await okxData(`/api/v5/market/ticker?instId=${c}-USDT`);
        if (t && t[0]) {
          price = num(t[0].last);
          priceChg24 = t[0].open24h ? +(((num(t[0].last) - num(t[0].open24h)) / num(t[0].open24h)) * 100).toFixed(2) : null;
        }
      } catch (_) { /* 价格缺省不影响 OI 主体 */ }
      const anomaly = oiAnomaly(m && m.change24hPct, m && m.change6hPct, priceChg24);
      coins.push({ ccy: c, instId, ...m, price, priceChg24hPct: priceChg24, anomaly });
    } catch (err) {
      coins.push({ ccy: c, instId, error: String(err.message || err).slice(0, 80) });
    }
  }
  const alerts = coins.filter((c) => c.anomaly);
  return {
    generatedAt: new Date().toISOString(),
    market: { totalOiUsd, instruments: marketCount, degraded },
    top10,
    coins,
    alerts,
    summary: { alertCount: alerts.length, hint: alerts.length ? `${alerts.length} 个币种出现持仓异动` : '主流币持仓平稳，无异动信号' },
    disclaimer: '持仓量为公开市场数据，异动判定为规则阈值输出，不构成投资建议。',
  };
}

function oiReport(data) {
  const lines = [
    `# 持仓量异动监控`,
    `> ${data.generatedAt} · 数据源: OKX 公开持仓统计`,
    '',
    `## 全市场`,
    `- 永续持仓总量: $${fmtUsd(data.market.totalOiUsd)}（${data.market.instruments || data.top10.length} 个合约${data.market.degraded ? '，降级采样' : ''}）`,
    `- ${data.summary.hint}`,
    '',
    `## 持仓量 Top10`,
  ];
  for (const r of data.top10) lines.push(`- ${r.instId}: $${fmtUsd(r.oiUsd)}`);
  lines.push('', `## 主流币持仓动能（小时线）`);
  for (const c of data.coins) {
    if (c.error) { lines.push(`- ${c.ccy}: 数据获取失败`); continue; }
    lines.push(`- ${c.ccy}: 持仓 $${fmtUsd(c.latestOi)} · 6h ${c.change6hPct ?? '-'}% · 24h ${c.change24hPct ?? '-'}%（价格 24h ${c.priceChg24hPct ?? '-'}%）`);
    if (c.anomaly) lines.push(`  - ⚠ ${c.anomaly}`);
  }
  lines.push('', '---', `*${data.disclaimer}*`);
  return lines.join('\n');
}

function oiPreview(data) {
  const btc = data.coins.find((c) => c.ccy === 'BTC') || data.coins[0];
  return {
    preview: true,
    generatedAt: data.generatedAt,
    totalOiUsd: data.market.totalOiUsd,
    btc: btc && !btc.error ? { latestOi: btc.latestOi, change6hPct: btc.change6hPct, change24hPct: btc.change24hPct } : null,
    alertCount: data.summary.alertCount,
    hint: data.summary.hint,
    upsell: '完整版含全市场 Top10 排行、ETH/SOL 动能与异动判定。付费调用 /v1/openinterest。',
  };
}

module.exports = {
  smartScan, smartReport, smartPreview,
  liqScan, liqReport, liqPreview,
  oiScan, oiReport, oiPreview,
};
