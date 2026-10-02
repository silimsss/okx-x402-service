'use strict';
/**
 * x402 Bazaar 发现元数据（Coinbase Bazaar / agentic.market）
 *
 * 收录机制：路由在 402 的 PaymentRequired.extensions 里带 `bazaar` 声明，
 * 买家成功完成一次付费结算后，CDP facilitator 把该端点写入公开目录。
 * 无需注册或申请，全自动；`POST /platform/v2/x402/validate` 可免鉴权自检。
 *
 * 排序依据（30 天滚动窗口）：真实调用量 + 独立支付方数量 + 描述/output schema 完整度。
 * 所以每条路由都带 input schema 与 output example，agent 才能在付款前拼出合法请求。
 *
 * Wire 格式对齐 x402-foundation/x402 的 extensions/bazaar（见 http/resourceService.ts），
 * 零依赖实现。GET/HEAD/DELETE 走 QueryInput；我们全部是 GET。
 */

const JSON_SCHEMA = 'https://json-schema.org/draft/2020-12/schema';
const QUERY_METHODS = ['GET', 'HEAD', 'DELETE'];

/**
 * 声明一条 Bazaar discovery extension（QueryInput 版本）。
 *
 * @param {object} o
 * @param {string} o.method        HTTP 方法（GET/HEAD/DELETE）
 * @param {object} [o.input]       具体 query 参数示例，如 { ccy: 'BTC' }
 * @param {object} [o.inputSchema] query 参数 JSON Schema
 * @param {object} [o.pathParams]  具体 path 参数示例，如 { instId: 'BTC-USDT' }
 * @param {object} [o.pathParamsSchema]
 * @param {object} [o.output]      { example, schema }
 * @returns {{info: object, schema: object}}
 */
function declareDiscoveryExtension({ method, input, inputSchema, pathParams, pathParamsSchema, output }) {
  if (!QUERY_METHODS.includes(method)) {
    throw new Error(`Bazaar: 目前只实现了 QueryInput（${QUERY_METHODS.join('/')}），收到 ${method}`);
  }
  return {
    info: {
      input: {
        type: 'http',
        method,
        ...(input ? { queryParams: input } : {}),
        ...(pathParams ? { pathParams } : {}),
      },
      ...(output && output.example ? { output: { type: 'json', example: output.example } } : {}),
    },
    schema: {
      $schema: JSON_SCHEMA,
      type: 'object',
      properties: {
        input: {
          type: 'object',
          properties: {
            type: { type: 'string', const: 'http' },
            method: { type: 'string', enum: QUERY_METHODS },
            ...(inputSchema ? { queryParams: { type: 'object', ...inputSchema } } : {}),
            ...(pathParamsSchema ? { pathParams: { type: 'object', ...pathParamsSchema } } : {}),
          },
          required: ['type', 'method'],
          additionalProperties: false,
        },
        ...(output && output.example
          ? {
              output: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  example: { type: 'object', ...(output.schema || {}) },
                },
                required: ['type'],
              },
            }
          : {}),
      },
      required: ['input'],
    },
  };
}

// ---- 公共片段 ---------------------------------------------------------

const INST_ID_SCHEMA = {
  type: 'object',
  properties: {
    instId: {
      type: 'string',
      description: 'OKX USDT 现货交易对，如 BTC-USDT、ETH-USDT、SOL-USDT',
      pattern: '^[A-Z0-9]+-USDT$',
    },
  },
  required: ['instId'],
  additionalProperties: false,
};

const CCY_SCHEMA = {
  type: 'object',
  properties: {
    ccy: {
      type: 'string',
      description: '逗号分隔的币种列表，缺省为 BTC、ETH、SOL 等主流币',
      examples: ['BTC', 'BTC,ETH,SOL'],
    },
  },
  additionalProperties: false,
};

const SYMBOL_SCHEMA = {
  type: 'object',
  properties: {
    symbol: {
      type: 'string',
      description: '要对比的永续合约，缺省 BTC-USDT-SWAP。兼容 BTC-USDT-SWAP / BTCUSDT / BTC_USDT 等常见写法',
      examples: ['BTC-USDT-SWAP', 'BTCUSDT', 'ETH-USDT-SWAP'],
    },
  },
  additionalProperties: false,
};

const DISCLAIMER = {
  type: 'string',
  description: '免责声明：本接口为自动生成的市场信息，不构成投资建议',
};

// 每个端点的发现元数据。description 写在路由配置里（402 的 resource.description），
// 这里只放输入/输出结构。
const ROUTE_META = {
  'GET /v1/brief/:instId': {
    method: 'GET',
    pathParams: { instId: 'BTC-USDT' },
    pathParamsSchema: INST_ID_SCHEMA,
    output: {
      schema: {
        properties: {
          fact: {
            type: 'object',
            properties: {
              instId: { type: 'string' },
              asOf: { type: 'string', description: 'ISO8601 行情时间戳' },
              price: { type: 'number' },
              vol24hUsd: { type: 'number' },
              change: { type: 'object', properties: { '24h': { type: 'number' }, '7d': { type: 'number' }, '30d': { type: 'number' } } },
              indicators: {
                type: 'object',
                properties: {
                  rsi14: { type: 'number' },
                  trend: { type: 'string' },
                  annualizedVolPct: { type: 'number' },
                  high20d: { type: 'number' },
                  low20d: { type: 'number' },
                },
              },
            },
          },
          analysis: { type: 'object', properties: { regime: { type: 'string' }, keyLevels: { type: 'object' }, bias: { type: 'string' }, disclaimer: { type: 'string' } } },
          report: { type: 'string', description: '中文 Markdown 报告全文' },
        },
      },
      example: {
        fact: {
          instId: 'BTC-USDT', asOf: '2026-10-02T02:20:39.076Z', price: 63882.3, vol24hUsd: 123456789,
          change: { '24h': -0.18, '7d': -0.4, '30d': -1.18 },
          indicators: { rsi14: 44.2, trend: '震荡', annualizedVolPct: 52.4, high20d: 67740.4, low20d: 63488.7 },
        },
        analysis: { regime: '中性', keyLevels: { resistance: 67740.4, support: 63488.7 }, bias: '区间震荡，等待方向选择。', disclaimer: '不构成投资建议。' },
        report: '# BTC-USDT 市场快报\n> 数据源: OKX\n\n## 一、事实数据\n- 现价: **63882.3** USDT\n…',
      },
    },
  },

  'GET /v1/sentiment': {
    method: 'GET',
    output: {
      schema: {
        properties: {
          fact: {
            type: 'object',
            properties: {
              index: { type: 'number', description: '恐惧贪婪指数 0-100' },
              label: { type: 'string' },
              labelZh: { type: 'string' },
              yesterday: { type: 'number' },
              lastWeek: { type: 'number' },
              week: { type: 'array', items: { type: 'object', properties: { date: { type: 'string' }, value: { type: 'number' }, label: { type: 'string' } } } },
              stats: { type: 'object', properties: { avg7: { type: 'number' }, min7: { type: 'number' }, max7: { type: 'number' }, delta7: { type: 'number' } } },
            },
          },
          analysis: { type: 'object', properties: { bias: { type: 'string' }, note: { type: 'string' } } },
          report: { type: 'string' },
        },
      },
      example: {
        fact: { index: 72, label: 'Greed', labelZh: '贪婪', yesterday: 74, lastWeek: 71, week: [{ date: '2026-10-02', value: 72, label: 'Greed' }], stats: { avg7: 72.4, min7: 70, max7: 74, delta7: 1 } },
        analysis: { bias: '贪婪区，乐观情绪主导；注意拥挤交易与回调风险。', note: '7日均值 72.4（区间 70~74）。' },
        report: '# 市场情绪仪表盘（恐惧贪婪指数）\n**72 / 100 — 贪婪**\n…',
      },
    },
  },

  'GET /v1/funding': {
    method: 'GET',
    output: {
      schema: {
        properties: {
          items: { type: 'array', items: { type: 'object', properties: { instId: { type: 'string' }, fundingRate: { type: 'number' }, annualizedPct: { type: 'number' }, vol24hUsd: { type: 'number' } } } },
          summary: { type: 'object', properties: { count: { type: 'number' }, avgFundingRate: { type: 'number' }, avgAnnualizedPct: { type: 'number' }, positiveCount: { type: 'number' }, negativeCount: { type: 'number' }, sentimentHint: { type: 'string' } } },
          report: { type: 'string', description: '中文 Markdown 全市场费率榜' },
        },
      },
      example: {
        items: [{ instId: 'BTC-USDT-SWAP', fundingRate: 0.00005, annualizedPct: 5.5, vol24hUsd: 9000000 }, { instId: 'ETH-USDT-SWAP', fundingRate: -0.00009, annualizedPct: -9.9, vol24hUsd: 8000000 }],
        summary: { count: 9, avgFundingRate: 0.000023, avgAnnualizedPct: 2.5, positiveCount: 5, negativeCount: 4, sentimentHint: '费率中性' },
        report: '# OKX 永续合约资金费率雷达\n…',
      },
    },
  },

  'GET /v1/funding/:instId': {
    method: 'GET',
    pathParams: { instId: 'BTC-USDT' },
    pathParamsSchema: INST_ID_SCHEMA,
    output: {
      schema: { properties: { items: { type: 'array' }, summary: { type: 'object' } } },
      example: { items: [{ instId: 'BTC-USDT-SWAP', fundingRate: 0.00005, annualizedPct: 5.5, vol24hUsd: 9000000 }], summary: { count: 1, avgAnnualizedPct: 5.5, sentimentHint: '费率温和偏多' } },
    },
  },

  'GET /v1/combo/:instId': {
    method: 'GET',
    pathParams: { instId: 'BTC-USDT' },
    pathParamsSchema: INST_ID_SCHEMA,
    output: {
      schema: {
        properties: {
          asOf: { type: 'string' }, instId: { type: 'string' }, price: { type: 'number' },
          change24hPct: { type: 'number' }, vol24hUsd: { type: 'number' },
          sentiment: { type: 'object' }, funding: { type: 'object' }, context: { type: 'object' },
          disclaimer: { type: 'string' },
        },
      },
      example: {
        asOf: '2026-10-02T02:20:39.076Z', instId: 'BTC-USDT', price: 63882.3, change24hPct: -0.18, vol24hUsd: 123456789,
        sentiment: { index: 72, labelZh: '贪婪' }, funding: { fundingRate: 0.00005, annualizedPct: 5.5 },
        context: { trend: '震荡', rsi14: 44.2 }, disclaimer: '不构成投资建议。',
      },
    },
  },

  'GET /v1/smartmoney': {
    method: 'GET',
    input: { ccy: 'BTC' },
    inputSchema: CCY_SCHEMA,
    output: {
      schema: {
        properties: {
          coins: { type: 'array', items: { type: 'object' } },
          summary: { type: 'object', properties: { longShortRatio: { type: 'number' }, topTraderPositionRatio: { type: 'number' } } },
          report: { type: 'string', description: '中文 Markdown 聪明钱持仓报告' },
          disclaimer: { type: 'string' },
        },
      },
      example: {
        coins: [{ ccy: 'BTC', topTraderLongShortRatio: 1.85, topAccountLongShortRatio: 1.42, retailLongShortRatio: 0.91 }],
        summary: { longShortRatio: 1.85, topTraderPositionRatio: 58.2 },
        report: '# 聪明钱持仓雷达\n…', disclaimer: '不构成投资建议。',
      },
    },
  },

  'GET /v1/liquidation': {
    method: 'GET',
    output: {
      schema: {
        properties: {
          windowHours: { type: 'number' }, scannedUlys: { type: 'array' },
          total: { type: 'object', properties: { longUsd: { type: 'number' }, shortUsd: { type: 'number' } } },
          ratioLongVsShortUsd: { type: 'number' },
          topLiquidations: { type: 'array', items: { type: 'object', properties: { instId: { type: 'string' }, side: { type: 'string' }, usd: { type: 'number' } } } },
          perInstrument: { type: 'array' }, verdict: { type: 'string' }, report: { type: 'string' },
        },
      },
      example: {
        windowHours: 24, total: { longUsd: 12500000, shortUsd: 8300000 }, ratioLongVsShortUsd: 1.51,
        topLiquidations: [{ instId: 'BTC-USDT-SWAP', side: 'long', usd: 4200000 }],
        verdict: '多头爆仓更集中，短期存在反抽动能', report: '# OKX 爆仓雷达（24h）\n…',
      },
    },
  },

  'GET /v1/openinterest': {
    method: 'GET',
    output: {
      schema: {
        properties: {
          market: { type: 'object', properties: { totalUsd: { type: 'number' }, change24hPct: { type: 'number' } } },
          top10: { type: 'array', items: { type: 'object' } },
          coins: { type: 'array', items: { type: 'object' } },
          alerts: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' }, report: { type: 'string' },
        },
      },
      example: {
        market: { totalUsd: 21500000000, change24hPct: 3.2 },
        top10: [{ instId: 'BTC-USDT-SWAP', oiUsd: 8200000000, change24hPct: 4.1 }],
        alerts: ['BTC-USDT-SWAP 持仓 24h 增长 8.4%'],
        summary: '持仓扩张中，资金持续流入', report: '# OKX 持仓量监控\n…',
      },
    },
  },

  'GET /v1/crossvenue': {
    method: 'GET',
    input: { symbol: 'BTC-USDT-SWAP' },
    inputSchema: SYMBOL_SCHEMA,
    output: {
      schema: {
        properties: {
          asOf: { type: 'string' },
          symbol: { type: 'string' },
          venues: { type: 'array', items: { type: 'object' } },
          summary: {
            type: 'object',
            properties: {
              okCount: { type: 'number' }, totalCount: { type: 'number' },
              referenceVenue: { type: 'string', description: "'okx' 表示以 OKX 为基准，'mean' 表示 OKX 取数失败已退化为四所均值" },
              cheapest: { type: 'string' }, dearest: { type: 'string' },
              ratioAbs: { type: 'number', description: '最贵与最便宜所的费率倍数差（按绝对值计算）' },
              annualizedGapPct: { type: 'number', description: '两者年化费率相差的百分点' },
            },
          },
          caveat: { type: 'string' },
          report: { type: 'string' },
        },
      },
      example: {
        asOf: '2026-10-02T02:20:39.076Z', symbol: 'BTC-USDT',
        venues: [
          { venue: 'okx', label: 'OKX', ok: true, fundingRate: 0.0000167, annualizedPct: 1.83, markPrice: 86081 },
          { venue: 'binance', label: 'Binance', ok: true, fundingRate: 0.0001, annualizedPct: 10.95, markPrice: 86081.2 },
          { venue: 'gate', label: 'Gate', ok: true, fundingRate: 0.000014, annualizedPct: 1.53, markPrice: 86075 },
          { venue: 'bybit', label: 'Bybit', ok: true, fundingRate: 0.00005, annualizedPct: 5.48, markPrice: 86077.1 },
        ],
        summary: { okCount: 4, totalCount: 4, referenceVenue: 'okx', cheapest: 'Gate', dearest: 'Binance', ratioAbs: 7.1, annualizedGapPct: 9.42 },
        caveat: '年化为按每 8 小时一次的等比换算，仅用于横向比较。',
        report: '# 跨交易所资金费率对比 · BTC-USDT\n…',
      },
    },
  },
};

/**
 * 给路由配置挂上 Bazaar 发现元数据。
 * 已挂过的跳过；不认识的路由不动（保持向后兼容）。
 *
 * @param {Record<string, object>} routes
 * @returns {Record<string, object>} 同一个对象
 */
function attachBazaarExtensions(routes) {
  for (const [key, cfg] of Object.entries(routes)) {
    const meta = ROUTE_META[key];
    if (!meta || !cfg) continue;
    if (cfg.extensions && cfg.extensions.bazaar) continue;
    cfg.extensions = { ...(cfg.extensions || {}), bazaar: declareDiscoveryExtension(meta) };
  }
  return routes;
}

module.exports = { declareDiscoveryExtension, attachBazaarExtensions, ROUTE_META };