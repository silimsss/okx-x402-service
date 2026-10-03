'use strict';
/**
 * 自保活定时器离线测试（全程假 fetch，不依赖外网）
 *
 * 断言重点不是「函数能跑」，而是：
 *   - 本地开发（没有公网 URL）绝不自己 ping 自己
 *   - RENDER_EXTERNAL_URL / SELF_URL 末尾带斜杠时不会拼出 //health
 *   - 单次失败只记账，不抛出、不停表、不叠加并发请求
 *   - stop() 之后真的不再 ping（否则测试会挂住进程）
 */

const assert = require('assert');
const { startSelfPing, baseUrlFromEnv, DEFAULT_INTERVAL_MS } = require('../src/keepalive');

let pass = 0, fail = 0;
function ok(name) { console.log(`  [PASS] ${name}`); pass++; }
function bad(name, e) { console.log(`  [FAIL] ${name} -> ${e.message}`); fail++; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  console.log('[test] keepalive 自保活（假 fetch）\n');

  // 1. 没有公网 URL 时不启动
  try {
    let called = 0;
    const k = startSelfPing({ url: '', env: {}, intervalMs: 20, fetchImpl: async () => { called++; return { ok: true, status: 200 }; } });
    await sleep(60);
    assert.strictEqual(k.stats.enabled, false);
    assert.strictEqual(k.stats.disabledReason, 'no-public-url');
    assert.strictEqual(called, 0);
    k.stop();
    ok('无公网 URL（本地开发）不启动，也不发请求');
  } catch (e) { bad('无公网 URL 不启动', e); }

  // 2. KEEPALIVE_SELF_PING=0 可关闭
  try {
    let called = 0;
    const k = startSelfPing({ env: { RENDER_EXTERNAL_URL: 'https://example.test', KEEPALIVE_SELF_PING: '0' }, intervalMs: 20, fetchImpl: async () => { called++; return { ok: true, status: 200 }; } });
    await sleep(60);
    assert.strictEqual(k.stats.enabled, false);
    assert.strictEqual(k.stats.disabledReason, 'disabled-by-env');
    assert.strictEqual(called, 0);
    k.stop();
    ok('KEEPALIVE_SELF_PING=0 可硬关闭');
  } catch (e) { bad('KEEPALIVE_SELF_PING=0 可硬关闭', e); }

  // 3. 环境变量识别 + 末尾斜杠不拼出双斜杠
  try {
    assert.strictEqual(baseUrlFromEnv({ RENDER_EXTERNAL_URL: 'https://a.test' }), 'https://a.test');
    assert.strictEqual(baseUrlFromEnv({ SELF_URL: 'https://b.test', RENDER_EXTERNAL_URL: 'https://a.test' }), 'https://b.test');
    assert.strictEqual(baseUrlFromEnv({}), '');

    const seen = [];
    const k = startSelfPing({
      env: { RENDER_EXTERNAL_URL: 'https://a.test/' },
      intervalMs: 25,
      log: () => {},
      fetchImpl: async (u) => { seen.push(u); return { ok: true, status: 200 }; },
    });
    await sleep(90);
    k.stop();
    assert.ok(seen.length >= 2, `应至少 ping 2 次，实际 ${seen.length}`);
    assert.ok(seen.every((u) => u === 'https://a.test/health'), `URL 应拼成 https://a.test/health，实际 ${seen[0]}`);
    assert.strictEqual(k.stats.lastStatus, 200);
    assert.strictEqual(k.stats.lastError, null);
    assert.strictEqual(k.stats.failures, 0);
    ok(`定时器按周期 ping（${seen.length} 次），斜杠被规范化`);
  } catch (e) { bad('URL 规范化与周期 ping', e); }

  // 4. 失败只记账：不抛出、不中断、统计可观测
  try {
    const logs = [];
    const k = startSelfPing({
      url: 'https://a.test',
      intervalMs: 25,
      log: (...a) => logs.push(a.join(' ')),
      fetchImpl: async () => { throw new Error('boom'); },
    });
    await sleep(90);
    k.stop();
    assert.ok(k.stats.count >= 2, `失败也应计入 count，实际 ${k.stats.count}`);
    assert.strictEqual(k.stats.failures, k.stats.count);
    assert.strictEqual(k.stats.lastError, 'boom');
    assert.ok(logs.length >= 1, '失败应打日志');
    ok('单次失败只记账不抛出，count/failures/lastError 可观测');
  } catch (e) { bad('失败只记账不抛出', e); }

  // 5. HTTP 非 2xx 算失败但不崩
  try {
    const k = startSelfPing({ url: 'https://a.test', intervalMs: 25, log: () => {}, fetchImpl: async () => ({ ok: false, status: 502 }) });
    await sleep(60);
    k.stop();
    assert.strictEqual(k.stats.lastStatus, 502);
    assert.strictEqual(k.stats.lastError, 'http 502');
    assert.strictEqual(k.stats.failures, k.stats.count);
    ok('非 2xx 记为失败但进程不受影响');
  } catch (e) { bad('非 2xx 记为失败', e); }

  // 6. 慢请求不叠加：上一轮没回来时不再发新的
  try {
    let inflight = 0, maxInflight = 0;
    const k = startSelfPing({
      url: 'https://a.test',
      intervalMs: 20,
      log: () => {},
      fetchImpl: () => { inflight++; maxInflight = Math.max(maxInflight, inflight); return sleep(80).then(() => { inflight--; return { ok: true, status: 200 }; }); },
    });
    await sleep(120);
    k.stop();
    assert.strictEqual(maxInflight, 1, `并发应恒为 1，实际 ${maxInflight}`);
    ok('慢请求期间不叠加并发（冷启动场景）');
  } catch (e) { bad('慢请求不叠加并发', e); }

  // 7. stop() 之后不再 ping
  try {
    let called = 0;
    const k = startSelfPing({ url: 'https://a.test', intervalMs: 20, log: () => {}, fetchImpl: async () => { called++; return { ok: true, status: 200 }; } });
    await sleep(50);
    k.stop();
    const after = called;
    await sleep(80);
    assert.strictEqual(called, after, 'stop() 之后仍在 ping');
    ok('stop() 后彻底停表');
  } catch (e) { bad('stop() 后彻底停表', e); }

  // 8. 默认周期必须小于 Render 休眠阈值（15 分钟），否则保活无意义
  try {
    assert.ok(DEFAULT_INTERVAL_MS < 15 * 60 * 1000, `默认周期 ${DEFAULT_INTERVAL_MS}ms 必须 < 15min`);
    ok('默认周期 < Render 15 分钟休眠阈值');
  } catch (e) { bad('默认周期校验', e); }

  console.log(`\n[keepalive] ${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})();
