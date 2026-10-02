'use strict';
/**
 * 多链 x402 结算通道
 *
 * 现状（2026-10）：
 *  - OKX 通道（eip155:196 X Layer, USD₮0）：已运行，OKXFacilitatorClient + OKX API Key
 *  - Base 通道（eip155:8453, USDC）：本模块新增。走 Coinbase CDP 托管 facilitator
 *    （需免费 CDP API Key；每月前 1000 笔链上交易免费，超出 $0.001/笔。
 *    真实付费 Agent 流量集中在 Base 侧，见 MATRIX_RESEARCH.md §7）
 *  - 币安 B402（BSC）：结算接口为商户申请制（clientId+RSA+IP 白名单），资格未下，
 *    保留 BSC_PAY_TO 占位，资格到手后再接入
 *
 * 设计原则：
 *  - 不改变 OKX 通道任何现有行为（X402_ENABLED/OKX_API_KEY 逻辑不动）
 *  - Base 通道仅在环境变量 BASE_PAY_TO 存在时启用（显式开关）
 *  - 每 10 分钟探测 CDP facilitator /supported，失败自动摘除该网络（402 里就不再出现）
 *  - 付款方向买家提供所有可用网络选项，买家自选其一支付
 */

const { HTTPFacilitatorClient } = require('@okxweb3/x402-core/server');

// 探测超时上限（毫秒）：CDP 不可达时不能挂住进程启动
const PROBE_TIMEOUT_MS = Number(process.env.BASE_PROBE_TIMEOUT_MS || 8000);

/** 给任意 Promise 加硬超时，避免探测/初始化请求无响应时阻塞启动 */
function withTimeout(promise, ms, label) {
  let timer;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} 探测超时 (${ms}ms)`)), ms);
    if (typeof timer.unref === 'function') timer.unref();
  });
  return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
}

// x402 CAIP-2 网络标识
const NETWORKS = {
  OKX_XLAYER: 'eip155:196',
  BASE: 'eip155:8453',
  BSC: 'eip155:56',
};

// 各链稳定币合约（均为 6 位小数）
const ASSETS = {
  [NETWORKS.BASE]: { usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
  [NETWORKS.BSC]: { usdt: '0x55d398326f99059fF775485246999027B3197955', usd1: '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d' },
};

// Base 侧默认 facilitator：Coinbase CDP 托管版（需免费 CDP API Key；每月前 1000 笔免费）
const CDP_FACILITATOR_URL = process.env.CDP_FACILITATOR_URL || 'https://api.cdp.coinbase.com/platform/v2/x402';

/** Base 通道是否启用（显式开关：配置了 BASE_PAY_TO 即视为启用） */
function baseEnabled() {
  return !!process.env.BASE_PAY_TO;
}

/** 是否拿到了 CDP API Key（有则走 JWT 鉴权，无则尝试免密钥 facilitator） */
function cdpAuthenticated() {
  return !!(process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET);
}

/** 构造 Base 通道的 facilitator client（仅当启用时返回实例） */
function buildBaseFacilitator() {
  if (!baseEnabled()) return null;
  try {
    const opts = { url: CDP_FACILITATOR_URL };
    if (cdpAuthenticated()) {
      // CDP 托管 facilitator 需要 API Key：每个端点签一个绑定 method+path 的 ES256 JWT
      const { createCdpAuthHeadersFactory } = require('./cdp-auth');
      opts.createAuthHeaders = createCdpAuthHeadersFactory({
        apiKeyId: process.env.CDP_API_KEY_ID,
        apiKeySecret: process.env.CDP_API_KEY_SECRET,
        baseUrl: CDP_FACILITATOR_URL,
      });
    }
    // 未配置 API Key 时仍允许指向任意免密钥 facilitator（CDP 自身需要鉴权）
    return new HTTPFacilitatorClient(opts);
  } catch (err) {
    console.error('[multichain] Base facilitator 初始化失败:', err.message);
    return null;
  }
}

/** USDC / USD₮0 均为 6 位小数 */
const TOKEN_DECIMALS = 6;

/**
 * 把人类价格（"$0.05" / "0.05" / 0.05）精确换算为 6 位小数的最小单位整数（字符串）。
 * 用字符串运算而非浮点乘，避免 0.08*1e6=80000.00000000001 之类的误差。
 *
 * @param {string|number} price
 * @returns {string} 如 "50000"
 */
function toTokenAmount(price) {
  const raw = String(price).trim().replace(/^\$/, '');
  const m = /^([0-9]+)(?:\.([0-9]*))?$/.exec(raw);
  if (!m) throw new Error(`无法解析价格: ${price}`);
  const frac = (m[2] || '').padEnd(TOKEN_DECIMALS, '0').slice(0, TOKEN_DECIMALS);
  return (BigInt(m[1]) * 10n ** BigInt(TOKEN_DECIMALS) + BigInt(frac || '0')).toString();
}

/**
 * 追加路由级多链支付选项到 x402 路由配置。
 *
 * Base 插到 accepts[0]（而不是末尾）：Coinbase Bazaar 的 validate 只检查
 * accepts[0]，且 CDP facilitator 只支持 Base/Solana/Polygon/Arbitrum/World，
 * 不支持 X Layer——Base 排首位才能被收录。X Layer 紧随其后，买家钱包不支持
 * Base 时仍能付款。两链同价。
 *
 * 注意：Base 的 price 必须直接给 AssetAmount（{amount,asset,extra}），不能沿用
 * "$0.05" 字符串——因为 SDK 的 ExactEvmScheme 内置默认资产表只有 X Layer/OKX，
 * Base 走字符串会抛 `No default asset configured for network eip155:8453`。
 *
 * @param {Record<string, {accepts: object[]}>} routes 现有路由配置（会被原位修改）
 */
function augmentRoutesWithBase(routes) {
  if (!baseEnabled()) return routes;
  const usdc = ASSETS[NETWORKS.BASE].usdc;
  for (const key of Object.keys(routes)) {
    const cfg = routes[key];
    if (!cfg || !Array.isArray(cfg.accepts) || !cfg.accepts.length) continue;
    if (cfg.accepts.some((a) => a.network === NETWORKS.BASE)) continue; // 已加过
    const first = cfg.accepts[0];
    const amount = typeof first.price === 'object' && first.price
      ? String(first.price.amount)
      : toTokenAmount(first.price);
    cfg.accepts.unshift({
      scheme: 'exact',
      network: NETWORKS.BASE,
      payTo: process.env.BASE_PAY_TO,
      price: { amount, asset: usdc, extra: { name: 'USDC', version: '2' } },
      description: first.description,
      mimeType: first.mimeType || 'application/json',
    });
  }
  return routes;
}

/** 健康探测：确认 CDP facilitator 对 eip155:8453/exact 的支持情况（结果缓存 10 分钟） */
let supportedCache = { at: 0, ok: null };
async function baseSupported() {
  const now = Date.now();
  if (supportedCache.ok !== null && now - supportedCache.at < 600_000) return supportedCache.ok;
  try {
    const fac = buildBaseFacilitator();
    if (!fac) { supportedCache = { at: now, ok: false }; return false; }
    const sup = await withTimeout(fac.getSupported(), PROBE_TIMEOUT_MS, 'CDP supported');
    const ok = Array.isArray(sup.kinds) && sup.kinds.some((k) => k.network === NETWORKS.BASE && k.scheme === 'exact');
    supportedCache = { at: now, ok };
    return ok;
  } catch (err) {
    console.warn('[multichain] CDP supported 探测失败:', err.message);
    supportedCache = { at: now, ok: false };
    return false;
  }
}

module.exports = {
  NETWORKS,
  ASSETS,
  baseEnabled,
  cdpAuthenticated,
  buildBaseFacilitator,
  toTokenAmount,
  withTimeout,
  augmentRoutesWithBase,
  baseSupported,
};
