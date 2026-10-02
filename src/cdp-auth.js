'use strict';
/**
 * Coinbase CDP facilitator 鉴权（自实现，零额外依赖）
 *
 * CDP REST API 用 API Key ID + Secret 签发 ES256/EdDSA JWT，每个请求的
 * `uris` claim 必须绑定 `METHOD host+path`，所以要对 verify/settle/supported
 * 三个端点分别签一次。
 *
 * 规范对齐 @coinbase/cdp-sdk 的 auth/utils/jwt.ts：
 *   header  = { alg, kid: apiKeyId, typ: 'JWT', nonce: hex(16B) }
 *   payload = { sub: apiKeyId, iss: 'cdp', uris: ['GET host/path'], iat, nbf, exp }
 *
 * 环境变量：
 *   CDP_API_KEY_ID      例 organizations/<org>/apiKeys/<key>
 *   CDP_API_KEY_SECRET  EC PEM（-----BEGIN EC PRIVATE KEY-----）或 Ed25519 base64
 */

const crypto = require('crypto');

const DEFAULT_TTL_SECONDS = 120;

// Ed25519 PKCS#8 前缀（固定 12 字节）+ 32 字节 seed
const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 判断 secret 是 EC PEM 还是 Ed25519 base64 */
function detectKeyFormat(secret) {
  if (typeof secret !== 'string' || !secret.trim()) return null;
  const s = secret.trim();
  if (s.includes('-----BEGIN')) return 'EC';
  try {
    if (Buffer.from(s, 'base64').length === 64) return 'Ed25519';
  } catch { /* ignore */ }
  return null;
}

/** Ed25519 base64 secret -> KeyObject */
function ed25519KeyFromBase64(secret) {
  const raw = Buffer.from(secret.trim(), 'base64');
  if (raw.length !== 64) throw new Error(`CDP_API_KEY_SECRET: Ed25519 密钥应为 64 字节，实际 ${raw.length}`);
  const der = Buffer.concat([ED25519_PKCS8_PREFIX, raw.subarray(0, 32)]);
  return crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
}

function ecKeyFromPem(pem) {
  const pemText = pem.includes('\\n') ? pem.replace(/\\n/g, '\n') : pem; // 环境变量里换行常被转义
  return crypto.createPrivateKey(pemText);
}

/**
 * 生成一个 CDP JWT。
 * @param {object} o
 * @param {string} o.apiKeyId
 * @param {string} o.apiKeySecret
 * @param {string} o.method  GET | POST
 * @param {string} o.host    api.cdp.coinbase.com
 * @param {string} o.path    /platform/v2/x402/verify
 * @param {number} [o.ttl]
 * @returns {string} JWT
 */
function generateJwt({ apiKeyId, apiKeySecret, method, host, path, ttl = DEFAULT_TTL_SECONDS }) {
  const format = detectKeyFormat(apiKeySecret);
  if (!format) throw new Error('CDP_API_KEY_SECRET 格式无效：需要 EC PEM 或 Ed25519 base64');

  const now = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString('hex');
  const header = { alg: format === 'EC' ? 'ES256' : 'EdDSA', kid: apiKeyId, typ: 'JWT', nonce };
  const payload = {
    sub: apiKeyId,
    iss: 'cdp',
    uris: [`${method} ${host}${path}`],
    iat: now,
    nbf: now,
    exp: now + ttl,
  };

  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const key = format === 'EC' ? ecKeyFromPem(apiKeySecret) : ed25519KeyFromBase64(apiKeySecret);
  const sig = format === 'EC'
    ? crypto.sign('sha256', Buffer.from(signingInput), { key, dsaEncoding: 'ieee-p1363' })
    : crypto.sign(null, Buffer.from(signingInput), key);
  return `${signingInput}.${b64url(sig)}`;
}

/**
 * 生成 HTTPFacilitatorClient 需要的 createAuthHeaders 回调。
 * SDK 的约定：回调返回 { verify, settle, supported } 各自的头对象。
 *
 * @param {{apiKeyId?: string, apiKeySecret?: string, baseUrl: string}} opts
 * @returns {() => Promise<Record<string, Record<string,string>>>}
 */
function createCdpAuthHeadersFactory({ apiKeyId, apiKeySecret, baseUrl }) {
  const url = new URL(baseUrl);
  const basePath = url.pathname.replace(/\/$/, '');
  const correlation = 'sdkLanguage=javascript,source=crypto-market-pulse';

  const headerFor = (op, method) => ({
    Authorization: `Bearer ${generateJwt({
      apiKeyId, apiKeySecret, method, host: url.host, path: `${basePath}/${op}`,
    })}`,
    'Correlation-Context': correlation,
  });

  return async () => ({
    verify: headerFor('verify', 'POST'),
    settle: headerFor('settle', 'POST'),
    supported: headerFor('supported', 'GET'),
  });
}

module.exports = { generateJwt, createCdpAuthHeadersFactory, detectKeyFormat };