'use strict';
/**
 * 本地 mock x402 facilitator —— 用于多链结算通道的离线回归测试。
 *
 * 同时模拟两个通道：
 *   - OKX 通道：路径 /api/v6/pay/x402/{supported,verify,settle}，响应裹在 {code,data,msg}
 *   - 标准通道（CDP/B402）：路径 /{supported,verify,settle}，响应就是 {kinds:[...]} / {isValid:true}
 *
 * 支持的网络由环境变量 MOCK_NETWORKS 指定（逗号分隔的 CAIP-2），默认两条都开。
 * 用法：
 *   node test/mock-facilitator.js &                              # 默认 4390
 *   FAC_PORT=4391 MOCK_NETWORKS=eip155:8453 node test/mock-facilitator.js &
 */
const http = require('http');

// 注意：不要读 PORT —— npm 会把自己的 IPC 端口注入 PORT
const PORT = Number(process.env.FAC_PORT || 4390);
const NETWORKS = (process.env.MOCK_NETWORKS || 'eip155:196,eip155:8453')
  .split(',').map((s) => s.trim()).filter(Boolean);

const ASSETS = {
  'eip155:196': { address: '0x779ded0c9e1022225f8e0630b35a9b54be713736', name: 'USD₮0', version: '1' },
  'eip155:8453': { address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', name: 'USDC', version: '2' },
};

const kinds = NETWORKS.map((network) => {
  const a = ASSETS[network] || ASSETS['eip155:8453'];
  return {
    x402Version: 2,
    scheme: 'exact',
    network,
    asset: a.address,
    facilitator: 'mock',
    extra: { name: a.name, version: a.version },
  };
});

const server = http.createServer((req, res) => {
  const url = (req.url || '').split('?')[0];
  const send = (obj, code = 200) => {
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(JSON.stringify(obj));
  };

  if (url.endsWith('/supported')) {
    const payload = { kinds };
    // OKX 通道要求 {code,data,msg} 信封（SDK 取 data）；标准通道直接返回
    return send(url.includes('/api/v6/') ? { code: '0', msg: 'ok', data: payload } : payload);
  }
  if (url.endsWith('/verify')) return send({ isValid: true, payer: '0x' + '1'.repeat(40) });
  if (url.endsWith('/settle')) {
    return send({ success: true, transaction: '0x' + 'a'.repeat(64), network: NETWORKS[0], payer: '0x' + '1'.repeat(40) });
  }
  if (url.endsWith('/settle/status')) return send({ status: 'settled' });

  send({ error: 'not_found', path: url }, 404);
});

server.listen(PORT, () => {
  console.log(`[mock-facilitator] listening on http://localhost:${PORT} | networks=${NETWORKS.join(',')}`);
});