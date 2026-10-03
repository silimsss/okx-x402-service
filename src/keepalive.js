'use strict';
/**
 * 免费档常驻保活：进程内「自我 ping」
 *
 * 为什么需要：Render 免费实例 15 分钟收不到入站请求就休眠，买家下一个请求要等
 * ~13 秒冷启动（对外表现就是「服务挂了」）。免费档一个月 750 小时，单服务 31 天
 * 上限 744 小时 —— 24/7 常驻恰好卡在额度内。
 *
 * 分层机制（两层缺一不可）：
 *   1. 主管道（本文件）：进程每 10 分钟请求一次自己的公网 URL，走 Render 边缘代理，
 *      属于真实入站流量，能不断重置闲置计时器。只要进程活着，实例就不会休眠。
 *   2. 兜底（.github/workflows/keepalive.yml）：实例真休眠后进程已被杀掉，本文件的
 *      定时器不复存在，只能由外部请求唤醒 —— GitHub Actions 每 5 分钟 ping 一次。
 *      GitHub 的 cron 是「尽力而为」，实测会延迟甚至整轮漏跑，所以它只当兜底，
 *      不能当主力（这也是本文件必须存在的原因）。
 *
 * 关闭方式：KEEPALIVE_SELF_PING=0；或设置 SELF_URL 覆盖目标地址。
 */

const DEFAULT_INTERVAL_MS = 10 * 60 * 1000; // 10 分钟 < Render 的 15 分钟休眠阈值
const PING_TIMEOUT_MS = 60 * 1000;         // 冷启动本身就要 ~13 秒，给足余量

/** Render 自动注入 RENDER_EXTERNAL_URL；本地用 SELF_URL 覆盖 */
function baseUrlFromEnv(env = process.env) {
  return env.SELF_URL || env.RENDER_EXTERNAL_URL || '';
}

/**
 * 启动自保活定时器。任何失败都不抛出、不影响业务路由。
 * @returns {{stats:object, ping:Function, stop:Function}}
 */
function startSelfPing(opts = {}) {
  const env = opts.env || process.env;
  const url = opts.url !== undefined ? opts.url : baseUrlFromEnv(env);
  const intervalMs = Number(opts.intervalMs || env.KEEPALIVE_INTERVAL_MS || DEFAULT_INTERVAL_MS);
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  const log = opts.log || ((...a) => console.log(...a));

  const stats = {
    enabled: false,
    url: null,
    intervalMs,
    count: 0,
    failures: 0,
    lastAt: null,
    lastStatus: null,
    lastError: null,
  };

  // 本地开发（没有公网 URL）、显式关闭、或运行时没有 fetch 时，静默不启动
  if (env.KEEPALIVE_SELF_PING === '0') { stats.disabledReason = 'disabled-by-env'; return { stats, ping: async () => {}, stop() {} }; }
  if (!url) { stats.disabledReason = 'no-public-url'; return { stats, ping: async () => {}, stop() {} }; }
  if (typeof fetchImpl !== 'function') { stats.disabledReason = 'no-fetch'; return { stats, ping: async () => {}, stop() {} }; }

  const target = url.replace(/\/+$/, '') + '/health';
  stats.enabled = true;
  stats.url = target;

  let stopped = false;
  let running = false; // 防止上一轮还没回来又叠加一轮

  const ping = async () => {
    if (stopped || running) return;
    running = true;
    try {
      const res = await fetchImpl(target, { signal: AbortSignal.timeout(PING_TIMEOUT_MS) });
      stats.count++;
      stats.lastAt = new Date().toISOString();
      stats.lastStatus = res.status;
      stats.lastError = res.ok ? null : `http ${res.status}`;
      if (!res.ok) stats.failures++;
    } catch (err) {
      stats.count++;
      stats.failures++;
      stats.lastAt = new Date().toISOString();
      stats.lastError = err.message;
      // 保活失败绝不影响业务：只记一行日志
      log('[keepalive] self-ping failed:', err.message);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(ping, intervalMs);
  if (typeof timer.unref === 'function') timer.unref(); // 不让定时器拖住进程退出

  const stop = () => { stopped = true; clearInterval(timer); };

  return { stats, ping, stop };
}

module.exports = { startSelfPing, baseUrlFromEnv, DEFAULT_INTERVAL_MS, PING_TIMEOUT_MS };
