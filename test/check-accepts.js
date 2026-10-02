'use strict';
/**
 * 校验 402 的多链 accepts：应同时提供 X Layer 与 Base 两条通道，且
 *   - Base 项 asset = Base 主网 USDC 合约
 *   - Base 项 payTo = BASE_PAY_TO
 *   - 两链 amount 相同（同价）
 *   - Base extra = {name:USDC, version:2}（EIP-3009 / EIP-712 domain）
 *
 * x402 v2 把 payment requirements 放在 `PAYMENT-REQUIRED` 响应头（base64 JSON），
 * body 通常是 `{}`；这里两种来源都支持。
 * 用法: node test/check-accepts.js <body.json> <header.txt> <expectedPayTo>
 */
const fs = require('fs');
const path = require('path');

const [bodyFile, headerFile, expectedPayTo] = process.argv.slice(2);
const USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const USDT0_XLAYER = '0x779ded0c9e1022225f8e0630b35a9b54be713736';

function read(p) { try { return fs.readFileSync(path.resolve(p), 'utf8'); } catch { return null; } }

let reqs = null;
const hdr = headerFile ? read(headerFile) : null;
if (hdr) {
  const m = /^PAYMENT-REQUIRED:\s*(\S+)/im.exec(hdr);
  if (m) {
    try { reqs = JSON.parse(Buffer.from(m[1], 'base64').toString('utf8')); } catch { /* ignore */ }
  }
}
if (!reqs) {
  const body = read(bodyFile);
  if (body) {
    try {
      const j = JSON.parse(body);
      reqs = Array.isArray(j.accepts) ? j : (j.error && j.x402Version ? j : null);
    } catch { /* ignore */ }
  }
}

if (process.env.ACCEPTS_COUNT_ONLY) {
  const n = reqs && Array.isArray(reqs.accepts) ? reqs.accepts.length : 0;
  console.log(n);
  process.exit(n ? 0 : 1);
}

if (!reqs || !Array.isArray(reqs.accepts)) {
  console.log('  [FAIL] 未能从 PAYMENT-REQUIRED 头或 body 解析出 accepts');
  process.exit(1);
}

const a = reqs.accepts;
const nets = a.map((x) => x.network);
console.log('  accepts:', nets.join(' | '));
console.log('  amount :', a.map((x) => `${x.network}=${x.amount}`).join('  '));

const base = a.find((x) => x.network === 'eip155:8453');
const xlayer = a.find((x) => x.network === 'eip155:196');
const bz = reqs.extensions && reqs.extensions.bazaar;
const checks = [
  ['402 同时提供两链', nets.length === 2 && !!base && !!xlayer],
  ['X Layer asset = USD₮0', xlayer && String(xlayer.asset).toLowerCase() === USDT0_XLAYER],
  ['Base asset = USDC 主网合约', base && String(base.asset).toLowerCase() === USDC_BASE],
  ['Base payTo = BASE_PAY_TO', base && expectedPayTo && String(base.payTo).toLowerCase() === expectedPayTo],
  ['两链金额一致（同价）', base && xlayer && base.amount === xlayer.amount],
  ['Base extra = {name:USDC, version:2}', base && base.extra && base.extra.name === 'USDC' && base.extra.version === '2'],
  ['两链均为 exact scheme', a.every((x) => x.scheme === 'exact')],
  ['Base 位于 accepts[0]（Bazaar validate 只看首位）', nets[0] === 'eip155:8453'],
  ['extensions.bazaar 结构完整（info/schema）', !!(bz && bz.info && bz.info.input && bz.info.input.method === 'GET'
    && bz.info.input.type === 'http' && bz.schema && bz.schema.$schema && bz.schema.properties
    && bz.schema.properties.input && bz.schema.properties.input.properties)],
  ['extensions.bazaar 带 output.example（影响目录排名）', !!(bz && bz.info && bz.info.output && bz.info.output.example)],
];
const badCount = checks.filter(([, v]) => !v).length;
checks.forEach(([name, v]) => console.log((v ? '  [PASS] ' : '  [FAIL] ') + name));
process.exit(badCount ? 1 : 0);