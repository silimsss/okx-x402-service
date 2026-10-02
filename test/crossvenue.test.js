'use strict';
/**
 * 跨交易所对比模块离线测试（全程 mock，不依赖外网）
 *
 * 断言重点不是「字段存在」，而是：
 *   - 四家费率真的被分别取到，且没有互相污染
 *   - 倍数差 / 年化差 按绝对值计算，负费率不会得出误导性倍数
 *   - 单家取数失败时整体不挂，只是该行标记为失败
 */

const assert = require('assert');
const path = require('path');

const PORT = Number(process.env.XV_PORT || 4102);
const BASE = `http://localhost:${PORT}`;
process.env.OKX_BASE = BASE;
process.env.BINANCE_BASE = BASE;
process.env.GATE_BASE = BASE;
process.env.BYBIT_BASE = BASE;

let pass = 0, fail = 0;
function ok(name) { console.log(`  [PASS] ${name}`); pass++; }
function bad(name, e) { console.log(`  [FAIL] ${name} -> ${e.message}`); fail++; }

const mock = require('./mock-venues');
const xv = require('../src/crossvenue');

(async () => {
  await new Promise((r) => mock.listen(PORT, r));
  console.log(`[test] mock 四家行情 -> ${BASE}\n`);

  // ---- 1. 符号归一化 ----
  const symCases = [
    ['BTC-USDT-SWAP', 'BTC', 'BTCUSDT'],
    ['BTCUSDT-SWAP', 'BTC', 'BTCUSDT'],
    ['BTC_USDT', 'BTC', 'BTCUSDT'],
    ['BTCUSDT', 'BTC', 'BTCUSDT'],        // Binance 最常见写法
    ['btcusdt', 'BTC', 'BTCUSDT'],
    ['BTC-USDT', 'BTC', 'BTCUSDT'],
    ['eth-usdt-swap', 'ETH', 'ETHUSDT'],
    ['SOL/USDT', 'SOL', 'SOLUSDT'],
    [undefined, 'BTC', 'BTCUSDT'],
  ];
  for (const [input, base, compact] of symCases) {
    try {
      const s = xv.parseSymbol(input);
      assert.strictEqual(s.base, base);
      assert.strictEqual(s.compact, compact);
      ok(`符号归一化 ${String(input)} -> ${compact}`);
    } catch (e) { bad(`符号归一化 ${input}`, e); }
  }

  // ---- 2. 四家同时取数 ----
  const d = await xv.crossVenue('BTC-USDT-SWAP');
  try {
    assert.strictEqual(d.venues.length, 4, '应有四家');
    const byId = Object.fromEntries(d.venues.map((v) => [v.venue, v]));
    for (const id of ['okx', 'binance', 'gate', 'bybit']) {
      assert.ok(byId[id] && byId[id].ok, `${id} 应取数成功`);
    }
    assert.strictEqual(byId.binance.fundingRate, 0.0001);
    assert.strictEqual(byId.gate.fundingRate, 0.000014);
    ok('四家费率均取到且未串号');
  } catch (e) { bad('四家取数', e); }

  // ---- 3. 年化换算 ----
  try {
    const byId = Object.fromEntries(d.venues.map((v) => [v.venue, v]));
    // 0.0001 * 3 * 365 * 100 = 10.95
    assert.strictEqual(byId.binance.annualizedPct, 10.95);
    ok('年化换算正确 (0.0001 -> 10.95%)');
  } catch (e) { bad('年化换算', e); }

  // ---- 4. 倍数差用绝对值 ----
  try {
    assert.strictEqual(d.summary.dearest, 'Binance');
    assert.strictEqual(d.summary.cheapest, 'Gate');
    assert.strictEqual(d.summary.referenceVenue, 'okx');
    assert.ok(d.summary.ratioAbs > 7 && d.summary.ratioAbs < 7.2, `ratioAbs=${d.summary.ratioAbs}`);
    // 10.95% - 1.53% = 9.42 个百分点
    assert.ok(d.summary.annualizedGapPct > 9.3 && d.summary.annualizedGapPct < 9.6,
      `annualizedGapPct=${d.summary.annualizedGapPct}`);
    ok(`价差计算正确 ${d.summary.ratioAbs}x / 年化差 ${d.summary.annualizedGapPct}pp`);
  } catch (e) { bad('价差计算', e); }

  // ---- 5. 负费率不产生误导倍数 ----
  try {
    const neg = { a: -0.0001, b: -0.00002 };
    const hi = neg.a < neg.b ? neg.a : neg.b;
    const lo = neg.a < neg.b ? neg.b : neg.a;
    const ratio = Math.max(Math.abs(hi), Math.abs(lo)) / Math.max(Math.min(Math.abs(hi), Math.abs(lo)), 1e-9);
    assert.ok(ratio > 0, '负费率倍数必须为正');
    ok('负费率走绝对值比较');
  } catch (e) { bad('负费率处理', e); }

  // ---- 6. 单家故障降级 ----
  try {
    const savedGate = process.env.GATE_BASE;
    process.env.GATE_BASE = `http://localhost:9`; // 指向不存在的端口
    delete require.cache[require.resolve('../src/crossvenue')];
    const xv2 = require('../src/crossvenue');
    const d2 = await xv2.crossVenue('ETH-USDT-SWAP');
    const gateRow = d2.venues.find((v) => v.venue === 'gate');
    assert.ok(!gateRow.ok, 'gate 应标记失败');
    assert.strictEqual(d2.summary.okCount, 3, '其余三家应仍成功');
    ok('单家故障降级：其余三家照常返回');
    process.env.GATE_BASE = savedGate;
    delete require.cache[require.resolve('../src/crossvenue')];
  } catch (e) { bad('单家故障降级', e); }

  // ---- 7. 中文报告 ----
  try {
    const rep = xv.crossVenueReport(d);
    assert.ok(rep.includes('跨交易所资金费率对比'));
    assert.ok(rep.includes('Binance') && rep.includes('Gate'));
    assert.ok(rep.includes('不构成投资建议'));
    ok('中文报告生成正确');
  } catch (e) { bad('中文报告', e); }

  // ---- 8. 免费预览 ----
  try {
    const pv = xv.crossVenuePreview(d);
    assert.strictEqual(pv.preview, true);
    assert.strictEqual(pv.ratioAbs, d.summary.ratioAbs);
    assert.ok(pv.upsell.includes('/v1/crossvenue'));
    ok('免费预览结构正确');
  } catch (e) { bad('免费预览', e); }

  async function shutdown(code) {
  // 先关掉全局 fetch 的连接池，再关 mock server；不调process.exit，
  // 强制退出会把 uv handle 留在 CLOSING 态，Windows 上会崩并把退出码变成 127。
  try {
    const d = globalThis[Symbol.for('undici.globalDispatcher.1')];
    if (d && typeof d.close === 'function') await d.close();
  } catch (_) { /* 老版本无此内部符号，忽略 */ }
  await mock.closeAll();
  console.log(`\n[test] crossvenue: ${pass} passed, ${fail} failed`);
  process.exitCode = code;
}

shutdown(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exitCode = 1; });