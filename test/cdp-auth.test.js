'use strict';
/**
 * cdp-auth 单元测试（零依赖，node test/cdp-auth.test.js 直接跑）
 * 校验：生成的 JWT 结构、claims、签名可用公钥验证、错误密钥格式被拒
 */
const assert = require('assert');
const crypto = require('crypto');
const { generateJwt, createCdpAuthHeadersFactory, detectKeyFormat } = require('../src/cdp-auth');

const decode = (part) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

const KID = 'organizations/test-org/apiKeys/test-key';

// --- 现场生成一对测试密钥（每次运行随机，不落盘） ---
const ec = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const EC_PEM = ec.privateKey.export({ type: 'pkcs8', format: 'pem' });

const ed = crypto.generateKeyPairSync('ed25519');
const ED_B64 = Buffer.concat([
  ed.privateKey.export({ type: 'pkcs8', format: 'der' }).subarray(-32), // seed
  ed.publicKey.export({ type: 'spki', format: 'der' }).subarray(-32),  // pub
]).toString('base64');

const base = { apiKeyId: KID, host: 'api.cdp.coinbase.com', path: '/platform/v2/x402/verify' };
let failed = 0;
const t = (name, fn) => {
  try { fn(); console.log('  [PASS] ' + name); }
  catch (e) { failed++; console.log('  [FAIL] ' + name + ' -> ' + e.message); }
};

t('detectKeyFormat 识别 EC PEM', () => assert.strictEqual(detectKeyFormat(EC_PEM), 'EC'));
t('detectKeyFormat 识别 Ed25519 base64', () => assert.strictEqual(detectKeyFormat(ED_B64), 'Ed25519'));
t('detectKeyFormat 拒绝垃圾输入', () => assert.strictEqual(detectKeyFormat('nope'), null));
t('detectKeyFormat 拒绝 undefined', () => assert.strictEqual(detectKeyFormat(undefined), null));

for (const [label, secret, alg, verifyFn] of [
  ['EC (ES256)', EC_PEM, 'ES256', (data, sig) => crypto.verify('sha256', data, { key: ec.publicKey, dsaEncoding: 'ieee-p1363' }, sig)],
  ['Ed25519 (EdDSA)', ED_B64, 'EdDSA', (data, sig) => crypto.verify(null, data, ed.publicKey, sig)],
]) {
  t(`${label} header alg/kid/typ/nonce`, () => {
    const [h] = generateJwt({ ...base, apiKeySecret: secret, method: 'POST' }).split('.');
    const hdr = decode(h);
    assert.strictEqual(hdr.alg, alg);
    assert.strictEqual(hdr.kid, KID);
    assert.strictEqual(hdr.typ, 'JWT');
    assert.match(hdr.nonce, /^[0-9a-f]{32}$/);
  });

  t(`${label} payload claims 正确`, () => {
    const [, p] = generateJwt({ ...base, apiKeySecret: secret, method: 'POST' }).split('.');
    const pay = decode(p);
    assert.strictEqual(pay.sub, KID);
    assert.strictEqual(pay.iss, 'cdp');
    assert.deepStrictEqual(pay.uris, ['POST api.cdp.coinbase.com/platform/v2/x402/verify']);
    assert.strictEqual(pay.exp - pay.iat, 120);
    assert.ok(pay.nbf <= pay.iat);
  });

  t(`${label} 签名可被公钥验证`, () => {
    const token = generateJwt({ ...base, apiKeySecret: secret, method: 'POST' });
    const parts = token.split('.');
    const data = Buffer.from(`${parts[0]}.${parts[1]}`);
    const sig = Buffer.from(parts[2], 'base64url');
    assert.ok(verifyFn(data, sig), '签名校验失败');
  });
}

t('非法密钥格式抛错', () => {
  assert.throws(() => generateJwt({ ...base, apiKeySecret: 'garbage', method: 'POST' }), /格式无效/);
});

t('环境变量里被转义的 \\n 能还原成 PEM', () => {
  const escaped = EC_PEM.replace(/\n/g, '\\n');
  assert.ok(generateJwt({ ...base, apiKeySecret: escaped, method: 'POST' }).split('.').length === 3);
});

t('createAuthHeadersFactory 返回 verify/settle/supported 三个端点', async () => {
  const f = createCdpAuthHeadersFactory({
    apiKeyId: KID, apiKeySecret: EC_PEM, baseUrl: 'https://api.cdp.coinbase.com/platform/v2/x402',
  });
  const h = await f();
  assert.deepStrictEqual(Object.keys(h).sort(), ['settle', 'supported', 'verify']);
  for (const [op, key] of [['verify', 'POST'], ['settle', 'POST'], ['supported', 'GET']]) {
    const bearer = h[op].Authorization;
    assert.ok(bearer.startsWith('Bearer '), `${op} 缺 Authorization`);
    const pay = decode(bearer.slice(7).split('.')[1]);
    assert.deepStrictEqual(pay.uris, [`${key} api.cdp.coinbase.com/platform/v2/x402/${op}`], `${op} uris 不对`);
  }
});

t('baseUrl 尾部斜杠不影响 path', async () => {
  const f = createCdpAuthHeadersFactory({
    apiKeyId: KID, apiKeySecret: EC_PEM, baseUrl: 'https://api.cdp.coinbase.com/platform/v2/x402/',
  });
  const h = await f();
  const pay = decode(h.settle.Authorization.slice(7).split('.')[1]);
  assert.deepStrictEqual(pay.uris, ['POST api.cdp.coinbase.com/platform/v2/x402/settle']);
});

setTimeout(() => {
  console.log(failed ? `\ncdp-auth 测试失败 ${failed} 项` : '\ncdp-auth 全部通过');
  process.exit(failed ? 1 : 0);
}, 300);