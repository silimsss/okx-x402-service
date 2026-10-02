# 服务矩阵扩充调研（2026-09-30 实测）

## 一、Agent 广场竞争格局实测

**分类供给统计**（点击分类按钮逐个清点）：
- 「交易」类仅 5 个服务 | 「金融」类 21 个（含跨类目重复）
- 广场首页常驻 21 个，Agent ID 已发到 13,000+（大量注册未上架）

**金融类已占位的服务**（避免撞车）：
| 品类 | 已有玩家 | 定价 | 销量 |
|---|---|---|---|
| 情绪/贪婪指数方向 | MarketLens（覆盖资金费率+宏观，但偏研究报告） | — | — |
| 资金费率 | Asia Pulse（含资金费率状态）、TradeFlow Sonar（币安聪明钱） | 0.005U | 1 |
| 恐惧贪婪指数 | **无专门服务**（仅 MarketLens 一笔带过） | — | — |
| 代币安全/尽调 | ChainSentry、Sniffer | 0.05U | 5 |
| 波动率信号 | EntropicAPI（香农熵） | 0.02U | 1 |
| 钱包行为分析 | XLayer Wallet Activity | 0.05U | 2 |
| 市场时机 | Bit Monk（多周期指标） | 0.01U | 4 |

**关键洞察**：
1. 「恐惧贪婪指数 + 资金费率」组合**没有专门玩家**——MarketLens 太重（研究报告），Asia Pulse 只带一句状态
2. 定价锚点成熟：0.01~0.1U/次是主流，0.005U 是底价
3. 我们的优势：已有部署管道 + 收款管道 + Agent #14050 信誉体系，新服务边际成本≈0

## 二、数据源可行性验证

| 数据 | 来源 | 免鉴权 | 成本 |
|---|---|---|---|
| 恐惧贪婪指数 | alternative.me `/api/v3/fear-and-greed`（官方公开 API） | ✅ | 0 |
| 资金费率 | OKX `/api/v5/public/funding-rate`（公开行情） | ✅ | 0 |
| 资金费率历史 | OKX `/api/v5/public/funding-rate-history` | ✅ | 0 |
| 永续持仓量 | OKX `/api/v5/public/open-interest` | ✅ | 0 |
| 多币种行情 | OKX `/api/v5/market/tickers?instType=SPOT`（批量） | ✅ | 0 |

## 三、选品决策：3 个新服务（本次立项）

| # | 服务 | 定价 | 差异化 |
|---|---|---|---|
| 1 | **市场情绪仪表盘**（恐惧贪婪指数+7日历史+回归分析） | 0.02U/次 | 唯一专门玩家；免费版含当日值 |
| 2 | **资金费率雷达**（OKX 全永续资金费率扫描+套利方向提示） | 0.03U/次 | 覆盖全交易对批量扫描，Asia Pulse 只有个别币 |
| 3 | **组合速览**（情绪+费率+行情三合一给 Agent 决策上下文） | 0.08U/次 | 一次调用省三次，客单价最高 |

**后续候选**（二期）：持仓量异动监控、XLayer 链上活跃度、清算热力图。
**明确不做**：交易信号（合规红线）、meme 喊单（竞争激烈且 RIPTIDE 3.7 分口碑已翻车）。

---

## 四、全广场类目清点（2026-10-01 实测，www.okx.ai/zh-hans/agents）

类目结构：全部 / 交易 / 金融 / 软件服务 / 生活 / 艺术创作 / 其他

| 类目 | 服务数 | 销量 Top | 观察 |
|---|---|---|---|
| 交易 | 3 | 4~7（全是月订信号） | **只有信号订阅，无工具类玩家** |
| 金融 | 20 | TradeDesk 8.58K(0.1U)；Vivra 35；Asia Pulse 30；我们 9 服务已上架 | 我们的主场，已占最大洼地 |
| 软件服务 | 20 | Metiora 27(0.3U)；GroundTruth 25；RIPTIDE 12(3.7分翻车) | 安全/风控扎堆 8 个；格式转换/开发工具类空白 |
| 生活 | 12 | **健康生活 292(0.01U)全平台第二**；Sigma Node 40(1U 内容日报) | 中国实用工具能走量；玄学类扎堆但 0 销量 |
| 艺术创作 | 5 | Name to poetry 24(0.01U) | 近空白，确定性工具（社交卡片 SVG）有创意无人用 |
| 其他 | 3 | 全 0 | 忽略 |

**核心结论**：
1. 全广场仅约 60 个上架服务，平台极早期；销量前二 = TradeDesk（专业工具）+ 健康生活（高频实用），共同点都是"日常刚需工具"，不是猎奇
2. 交易类 3 个玩家全是月订信号 → **交易辅助工具（计算器类）空白**
3. Sigma Node 40 单 @1U 验证了内容日报的高客单价
4. 明确不碰：玄学（合规+低复购）、交易信号（红线）、X Layer 风控（已 3 家）

## 五、任务大厅实地调研（2026-10-01 首访，10-02 复访+机制核实）

### 5.0 ⚠️ 先读这一段：任务大厅不是“接单大厅”（10-02 实测修正）

之前写的「上架后任务自动路由给 ASP → BTC 简报类任务我们躺着接」是**错的**。

打开任意任务详情页（`/tasks/0_459718`、`/tasks/0_459263`）都能看到一栏 **「接单 ASP」**，
且发布时就已经锁定服务商：

```
BSC Token 风险尽调
接单 ASP : ChainSentry   ← 已绑定，不是待抢单
评分 5.00 · 好评率 100% · 总已售 6
使用的服务: 代币风险尽职调查  ·  按钮: [立即使用]
```

**真实机制**：

```
ASP 上架广场 → 买方（Agent）搜索浏览 → 选中某个服务 → 下单 → 任务大厅多一条流水记录
```

即：**任务不是“待领取的工单”，而是“已成交订单的公示流水”。** 没有抢单环节，
单子在发布前就已经给别人了。我们无法主动接单，只能被动等待被搜到。

### 5.1 平台数据（两次实测对比，规模感是虚的）

| | 10-01 | 10-02 | 变化 |
|---|---|---|---|
| 总成交额 | $9,676 | **$9,681** | **+$5** |
| 任务总数 | 82,651 | **83,323** | **+672** |
| 已完成 | 79,480 | 80,131 | +651 |
| 进行中 | 277 | 295 | +18 |

**672 个新任务只带来 5 美元成交**，平均 **$0.0074/任务**。
所以“82,651 个任务”是被刷单和免费任务稀释出来的数字，不能当成市场规模。

**单个服务的真实天花板（实测到的最高销量）**：

| 服务 | 单价 | 销量 | 折算 |
|---|---|---|---|
| Agent Arena 坦克策略顾问 | $0.01 | **228**（全厅最高） | ≈ $2.3 累计 |
| ChainSentry 代币风险尽调 | $0.05 | 6（评分 5.00 / 100% 好评） | $0.3 |

**这个平台的赚钱上限极低**——销量冠军折算下来也就两美元多。

### 5.2 刷单现象（仍然存在）

**关键发现：大量"自成交"刷单**
- Vivra：自发布 20 个 0.5U 美股分析任务（19 天前批量）自己完成
- WokSmith：自发 10 个 0.2U 菜谱任务，描述里连成品内容都写好了
- Name to poetry：自发 10 个 0.01U 首字母诗任务
- 萌宠定制：自发 5+ 个 0.5U 任务
- Pools Sentinel / Metagents：互发 10U/月 "ASP 情报收集订阅（研究用）"
→ 结论：任务大厅 GMV 水分大，真实第三方需求存在但占比小

### 5.3 真实的、与我们服务直接匹配的任务
| 任务 | 价格 | 状态 | 与我们匹配度 |
|---|---|---|---|
| BTC市场研究简报（Saena Signal Ops 发） | 0.05U | 进行中 | ★★★ 与快报 Pro 几乎一样 |
| 市场信号追踪 ×2 | 0.5U | 已完成 | ★★ 部分匹配雷达服务 |
| BSC Token 深度尽调 | 0.1U | 进行中 | ✗ 需合约分析能力 |
| 聪明钱合约信号订阅 ×3 | 10U/月 | 已完成/进行中 | ★ 验证月订阅卖得动 |
| Blockchain trend report（Sigma Node 发） | 1U | 已完成 | ★ 内容简报高客单价 |

### 5.4 对我们的用途（10-02 修正）

1. 定位 = **需求验证器 + 评分信号**，**不是收入引擎**（日增成交仅 $5，销量冠军≈ $2.3）
2. **无法接单**。唯一有意义的动作是**尽快上架广场**，被搜到才有交易
3. 上架是被动等搜索流量——需接受“多数服务长期零成交”的现实
   （已在 Coinbase 22,004 个服务的目录上验证过同一规律）
4. 不碰：自成交刷单（烧钱 + 封号风险）、低价内卷
5. 观察指标：BTC 简报类任务重复出现 = 快报 Pro 需求验证信号
6. **真实机会不在任务大厅，而在广场搜索排名**——那才是买方下单前会看的地方

## 六、币安生态调研（2026-10-01）

**Agent OS 全家桶**（2026-08-20 上线）：MCP Server + 交易 API + Skills Hub + Agentic Wallet + x402 支付（B402，BNB Chain）

**两条变现路径，性质完全不同**：
1. Skills Hub（github.com/binance/binance-skills-hub）：接受第三方 PR 贡献，但技能 = 免费 SKILL.md 文件，**无收费机制** → 不是变现渠道，是获客渠道
2. B402 卖家侧（developers.binance.com → onchainpay-x402）：明确的 Seller 角色，HTTP 402 按次收费，USDT/USDC/USD1/U 直接到卖家地址（BSC），gas 由 B402 赞助，**无需注册审核**；B402 Bazaar = 付费端点公开目录，settle 时带 extensions.bazaar 元数据即自动收录（~30s）

**B402 Bazaar 现状（实测拉取全部 25 个端点）**：
- Nansen（聪明钱净流+地址画像）、CoinMarketCap（行情/DEX 搜索）已进场
- 独立开发者真实存在（vercel.app 托管的经济日历、ChainHelix 一人公司 8 个端点，含 $4/7天 订阅形态）
- 类目：预测市场概率、宏观日历、MEV、LLM 推理/图片/TTS、跨链报价、代币情报
- 无 OKX 永续衍生品数据类玩家（资金费率/持仓/爆仓雷达在币安系仍空白）
- 注意：Nansen 已占"smart money netflow"关键词

**与 OKX.AI 的对比**：B402 无身份/评分/任务大厅/审核，纯协议级收款；OKX.AI 有广场流量+信誉体系+Builder 返佣。B402 结算需卖家自备 BSC 可控钱包（现有 Agentic Wallet 密钥 TEE 托管不可导出，收款地址需新建）

**结论**：币安值得做，但定位 = 同一产品的第二结算通道，不是第二主战场。时机 = OKX.AI 首笔真实收入后。

## 七、x402 服务链上收益求证（2026-10-01 初测，10-02 修正归属）

**方法**：402 探测拿到收款地址 → Blockscout API 拉全部 ERC-20 转账 →
过滤 method 0xe3ee160e（EIP-3009 授权转账 = x402 结算特征）

> ⚠️ **10-02 修正**：本节原标题写作「B402 链上收益」，**这是错误的归属**。
> 下表的数字是真的，但它们**不是币安带来的收益**。复查实测（见下方）证明：
> 币安 Bazaar 是**跳链发现目录**，它不决定结算链——买家用哪个钱包付，钱就落在哪条链。
> 真正在 **BSC 上结算**的卖家只有 hyreagent 一个，而它销量≈0。

### 7.1 实测销量（~~原表格~~ **金额已作废，见 7.4**）

| 卖家 | 定价 | 链上实测 | 日均 | 折算 |
|---|---|---|---|---|
| macropulse（宏观日历，独立开发者，vercel 免费档） | $0.01 | 200 笔 / $12.45（9.23–10.01，9 天） | ~22 笔 | **~$1.4/天 ≈ $40/月** |
| Nansen（聪明钱数据，企业） | $0.05+ | 236+ 笔 / $470+（9.29–10.01，3 天） | ~80 笔 | **~$150/天**（且加速中） |
| hyreagent（BSC/USD1，**唯一真在 BSC 结算的卖家**） | $0.01 | 111 笔总交易，最后转出 85 天前，余额 $0.08 | ≈0 | **≈ $0** |

### 7.2 10-02 复查：数字到底属于哪个生态

直接拉 B402 Bazaar 目录，看它登记的收款链：

| 卖家 | Bazaar 登记的链 | Bazaar 登记的收款地址 |
|---|---|---|
| macropulse | eip155:56 (BSC) · USD1 · $0.1 | `0x50ab…2fc` |
| hyreagent | eip155:56 (BSC) · USD1 | `0xb599…e9b7` |
| Nansen | eip155:56 (BSC) · USDT · $0.05 | `0x93053f…F13f` |

再拉 Nansen 自己的 402（实测拿到完整报价），它同时接受 **7 种支付方式**：

```
Base Sepolia(测试网) USDC | X Layer USD₮0 | BSC USDT | BSC WLFI | BSC USDT(permit2) | Solana USDC
```

实测 Nansen 在 **Base 主网（8453）只有 50 笔尘埃交易（5e-14 USDC），无真实收入**——
它的报价里根本没有 Base 主网，只有 Base Sepolia 测试网。

**结论**：
1. 「币安 B402 生态的收益」这个说法**不成立**。B402 是跨链目录，**币安提供的是曝光，不是支付通道**。
2. 表里 $40/月 和 $150/天 的钱，来自这些服务**自己开放的链**（Base / X Layer / Solana / BSC 混合），
   币安 Bazaar 只是在这些服务旁边放了一块招牌。
3. 唯一能代表「币安自己生态」的数据点是 hyreagent：**≈ $0**。
4. 附带发现：Nansen 接受 **X Layer**（OKX 的链）——OKX 生态的 x402 需求是真实存在的，
   而这正是我们主通道之一。
5. Nansen 在 BSC 上的具体份额**未能验证**（bscscan / routescan / blockscout BSC 的免密钥 API
   在本环境全部不可用），待定。但可以确定**不是全部来自 BSC**。

### 7.4 10-02 二次复查：原表格金额不可信，作废

Blockscout 的 `/token-transfers` 返回的地址字段**自带字面引号**（`to.hash` = `"0x…"`），
此前统计用全等比较判断收支方向，导致**每一笔都判成「不涉及该地址」**。
也就是说 7.1 里的“200 笔 / $12.45”和“236 笔 / $470”**方向判反、无法复现，应作废**。

改用 token-balances（不依赖地址比较）后拿到的硬数据：

| 地址 | Base 链 USDC 余额 | 说明 |
|---|---|---|
| macropulse `0x50ab…2fc` | **77.47** | 个人开发者（Vercel 免费档），不太频繁提现，量级 ≈ 数十至百刀 |
| Nansen `0x93053f…F13f` | **6,509.75** | 企业级地址，且是收款中转账户，余额≠利润 |

**但方向已经可以确证（这才是本节真正重要的结论）**：

直接拉两个卖家自己的 402 报价（不依赖任何第三方统计）：

```
macropulse  402 -> { x402Version:1, accepts:[{ scheme:"exact", network:"base",
                     maxAmountRequired:"100000",            // $0.01
                     payTo:"0x50ab…2fc", extra:{name:"USD Coin",version:"2"} }] }

Nansen      402 -> 7 种支付方式：
                     Base Sepolia(测试网) / X Layer USD₮0 / BSC USDT / BSC WLFI /
                     BSC USDT(permit2) / Solana USDC —— 其中 extensions.bazaar 元数据完整
```

**所以钱是从这里赚到的**：

1. **结算链 = 卖家自己声明的链**。macropulse 只写死 `base`，它的收入**只能**来自 Base 网络。
   币安 B402 Bazaar 只是把它收进了目录（登记的也是 BSC 地址），但买家用 Base 钱包付，钱就落在 Base。
2. **付费方不是平台派单，是 AI Agent 自己付**。x402 的机制是 Agent 扫描目录 → 发现端点 →
   用钱包里的 USDC 自动签名付款 → 无人参与。**不存在“平台派任务给卖家”这个环节**。
3. Nansen 证明了**多链并行的现实**：一个企业卖家同时收 BSC / X Layer / Solana，
   而它同样挂了 bazaar 元数据——**它服务的是整个 x402 目录生态，不是某个交易所**。

> 💡 方法论修正：以后求证 x402 销量，**优先用 `token-balances` 看余额 + 直接拉端点 402 看 `network`**，
> 不要用 `token-transfers` 的地址比较算收支（字段带引号）。余额会低估（可能提现过），
> 但比方向判反的数字可靠。

### 7.3 仍然成立的关键洞察

1. x402 销量的**方向与归属**完全可链上求证（直接拉端点 402 看 network + payTo）
2. 真实付费需求存在；微支付为主（$0.01 定价是独立开发者的标准选择）
3. B402 卖家零 gas 成本（币安赞助），收款钱包可以完全冷
4. macropulse 的 Base 地址余额 **77 USDC** 证明个人开发者在 Base 上确实能收到钱，
   但**具体月收无法确定**（不知道提现频率），不再沿用“$40/月”这个估算

## 八、多链结算落地（2026-10-02）

### 8.1 结论先行：先做 Base，BSC 缓

| 通道 | 状态 | 接入成本 |
|---|---|---|
| X Layer（`eip155:196`, USD₮0） | **已上线**，走 OKXFacilitatorClient | 已有 OKX API Key |
| Base（`eip155:8453`, USDC） | **代码已完成，待填 CDP Key** | 免费注册 CDP 拿 API Key |
| BSC（`eip155:56`, USD1） | 缓 | `/papi/v2/b402/verify\|settle` 是商户申请制（clientId + RSA + IP 白名单） |

理由：§7 已证真实付费流量集中在 Base；BSC 侧实测销量≈0 且拿不到商户资格。

### 8.2 SDK 机制逆向（@okxweb3/x402-core v0.1）

1. **一个 resource server 可挂多个 facilitator**：`new x402ResourceServer([okxFacilitator, cdpFacilitator])`，
   启动时逐个 `getSupported()` 建立 `network+scheme -> facilitator` 映射，前面的优先级更高。
2. **路由级 `accepts` 是数组** = 原生多链。一条路由配两个 `accepts`（不同 `network`/`asset`/`payTo`），
   402 的 `PAYMENT-REQUIRED` 头里就会同时列出两条链，买家任选其一。
3. **同一个 EVM 地址在两条链通用** → `0xe716…03f8` 同时收 X Layer 的 USD₮0 和 Base 的 USDC，不需要新钱包。
4. **坑：`ExactEvmScheme` 的默认资产表只认 X Layer**。`DEFAULT_STABLECOINS` 里只有
   `eip155:196` 和 `eip155:1952`，Base 走 `"$0.05"` 字符串会抛
   `No default asset configured for network eip155:8453`。
   解法：`parsePrice` 支持直接给 AssetAmount 对象，所以 Base 的 `price` 必须写成
   `{amount:"50000", asset:"0x833589fCD6…", extra:{name:"USDC",version:"2"}}`。
5. **坑：`paymentMiddleware()` 的初始化是惰性的**，失败会变成未捕获拒绝直接打死进程。
   改为显式 `await new x402HTTPResourceServer(rs, routes).initialize()`（带超时），
   失败则只让付费路由返 503，`/health` 仍可观测。
6. **Express 注册顺序**：中间件必须先于业务路由注册。异步装配要先把
   `express.Router()` 占位挂到最前面，再往里 `use()`。
7. **CDP 鉴权**：`HTTPFacilitatorClient({createAuthHeaders})` 的回调**不收参数**，但返回值
   必须是 `{verify, settle, supported}` 三键对象（SDK 内部用 path 去取）。CDP 要求每个端点
   签一个 `uris:["METHOD host/path"]` 绑定的 ES256/EdDSA JWT（`src/cdp-auth.js` 自实现，
   对齐 @coinbase/cdp-sdk 的 jwt.ts，零额外依赖）。
8. **CDP 需要 API Key**：实测 `/platform/v2/x402/supported` 无鉴权返回 `401 Unauthorized`
   （`docs.cdp.coinbase.com/x402/seller/facilitator` 也写明用 key id + secret）。
   费用：每月前 1000 笔链上交易免费，超出 $0.001/笔。

### 8.3 实测产物

402 响应头（双通道实际内容，`PAYMENT-REQUIRED` base64 解出来）：

```json
{ "x402Version": 2, "accepts": [
  { "scheme":"exact","network":"eip155:196","amount":"50000",
    "asset":"0x779ded0c9e1022225f8e0630b35a9b54be713736","payTo":"0xe716…03f8",
    "extra":{"name":"USD₮0","version":"1"} },
  { "scheme":"exact","network":"eip155:8453","amount":"50000",
    "asset":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","payTo":"0xe716…03f8",
    "extra":{"name":"USDC","version":"2"} } ] }
```

注意：x402 **v2 把 requirements 放在 `PAYMENT-REQUIRED` 响应头，body 是空 `{}`**；
§7 的“402 响应体里 accepts[0]”实际也应从该头解析。

离线回归 `test/smoke-multichain.sh`（5 模式 / 21 断言，全程 mock facilitator）：
仅 OKX / CDP 不可达降级 / 双通道正常 / facilitator 全挂（进程存活 + 付费 503）/ 开发模式。

### 8.4 目录真实收入实测（2026-10-02，最重要的一节）

Coinbase 目录的搜索接口是**免鉴权**的，且直接返回每个资源的 `quality` 字段
（`l30DaysTotalCalls` 30 天调用量、`l30DaysUniquePayers` 独立支付方数）。
按 `calls × price` 算出**整个赛道的 30 天收入池**：

| 赛道 | 资源数 | 30 天收入池 | 头部服务 |
|---|---|---|---|
| crypto price | 16 | **$0.79** | crypto.apitoll.cloud 199 次 × $0.001 = $0.20（52 人） |
| crypto market briefing | 4 | **$0.53** | kronossignals.com 3 次 × $0.1 = $0.30（3 人） |
| funding rate | 16 | **$2.25** | agent402.tools 988 次 × $0.002 = $1.98（5 人） |
| open interest | 20 | **$0.39** | api.agentstools.dev 4 次 × $0.01 = $0.04（3 人） |
| liquidation | 15 | **$2.21** | liq.lonestaroracle.xyz 16 次 × $0.1 = $1.60（1 人） |
| fear greed | 20 | **$3.25** | api.kadec0.xyz 36 次 × $0.05 = $1.80（2 人） |
| trading signal | 14 | **$0.71** | trading-perps.vercel.app 1 次 × $0.25（1 人） |

**crypto 类七个赛道加起来，30 天收入池合计约 $10。** 且大量“头部”只有 1–3 个付费用户
（很可能是开发者自己测试）。

**扩展到整个生态**（判断是“只有 crypto 不活跃”还是“全生态都不活跃”）：

| 赛道 | 30 天收入池 | 头部 |
|---|---|---|
| weather | $0.40 | 39 次 × $0.005（7 人） |
| news | $1.78 | 111 次 × $0.01（3 人） |
| tweet | $2.84 | 448 次 × $0.0025（13 人） |
| search | $0.49 | 11 次 × $0.042（2 人） |
| translate | $0.82 | 19 次 × $0.01（3 人） |
| stock price | $0.66 | 102 次 × $0.003（10 人） |
| sentiment analysis | $101.58 | 10 次 × **$10** = $100（5 人）—— 全表唯一异常值 |

**结论（推翻第七节的乐观判断）**：

1. **目录共 22,004 个服务，但绝大多数 30 天零调用。** 被动等目录曝光拿不到收入。
2. **这是生态阶段问题，不是我们的问题。** x402 的买家是 Agent，但目前愿意为 API 付 USDC 的
   Agent 极少，全生态活跃付费流量都极低。
3. 我们已经把技术侧做到位（Base + X Layer 双通道、8/8 通过 validate、Bazaar 元数据齐全），
   具备“**一旦有买家就能立刻收钱**”的能力，但**买家从哪来是另一道题**。
4. **OKX.AI 广场是目前唯一有真人买卖的市场**（任务大厅是它的成交公示栏，
   总成交 $9,681 / 83,323 任务，**日增仅 $5**，销量冠军折算 $2.3），
   而非 x402 目录。战略优先级应据此调整。

> 💡 复查工具：`https://api.cdp.coinbase.com/platform/v2/x402/discovery/search?query=...&limit=20`
> （免鉴权）返回 `resources[].quality`，可随时复验任何赛道的真实收入池。

### 8.5 Coinbase x402 Bazaar（重要，优先级高于 B402）

官方文档：`docs.cdp.coinbase.com/x402/buyer/discover-services`、`/x402/seller/get-discovered`

| 维度 | Coinbase Bazaar | 币安 B402 Bazaar |
|---|---|---|
| 目录规模 | **23,000+ 资源** | 25 个端点 |
| 收录方式 | 路由在 402 里带 `extensions.bazaar`，买家付一次款后自动索引 | settle 时带 `extensions.bazaar` |
| 申请/注册 | 不需要，全自动 | 不需要 |
| 分发面 | CDP API、**Bazaar MCP**、Amazon Bedrock AgentCore、**agentic.market** 网站 | 币安 App 内 |
| 排序依据 | 30 天滚动：真实调用量 + 独立支付方数 + 描述/output schema 完整度 | 未公开 |
| 费用 | 前 1000 笔链上交易/月免费，超出 $0.001/笔 | 币安赞助 |

**关键结论：只用 X Layer 永远进不了 Coinbase Bazaar。** 用免鉴权 validate 端点实测
`POST https://api.cdp.coinbase.com/platform/v2/x402/validate`（无需 API Key）：

```
✘ accepts[0].network  eip155:196 → "not supported"
     expected: a facilitator-supported network (Base, Solana, Polygon, Arbitrum, World)
✘ accepts[0].asset    0x779ded0c… → "is not USDC"
✘ has_bazaar_extension → "No bazaar extension in top-level extensions object"
simulation: { outcome: "rejected", rejectionReason: "no bazaar discovery extension found" }
```

即 **Base 通道不是可选项，而是打开 23,000 资源市场的唯一钥匙**；且 validate 只看
`accepts[0]`，所以 Base 必须排在首位（X Layer 排第二，买家钱包不支持时仍能付）。

**Bazaar wire 格式**（对齐 `x402-foundation/x402/extensions/bazaar`，零依赖实现于
`src/bazaar.js`）：

```js
extensions: { bazaar: {
  info: { input: { type: 'http', method: 'GET', pathParams: {...}, queryParams: {...} },
          output: { type: 'json', example: {...} } },
  schema: { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object',
             properties: { input: {...}, output: {...} }, required: ['input'] },
}}
```

**策展（curation）门槛**：主网真实收款 + **30 天可用性 ≥99%**（平台实测，持续失败会自动
下架）+ 完整输入 schema + “告诉 agent 何时用这个端点”的描述 + 每次定价/支持网络/错误响应。

> ⚠️ **Render 免费版会破坏这条**：免费实例 15 分钟无请求就休眠，冷启动 1–2 分钟，
> 可用性远达不到 99%，等于进了 Bazaar 也会被判下架。要进 Bazaar 得上常驻实例。

**已落地**：`src/bazaar.js` 声明元数据；`tools/validate-bazaar.js` 批量自检 8 个端点；
`tools/dump-samples.js` 从 mock 行情抓真实响应作为 `output.example`。

### 8.7 落地完成情况（2026-10-02）

用户在 Render 填入 `BASE_PAY_TO` / `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` 后：

```
/health -> { x402: "enabled",
             channels: { "eip155:196": "usdt0", "eip155:8453": "usdc" },
             baseProbeError: null }
```

**自实现的 CDP JWT 被 Coinbase 真实接受**（首版实现零返工）。402 实测：

```
resource.url: https://crypto-market-pulse.onrender.com/v1/sentiment   ← trust proxy 修复后已是 https
accepts[0]: eip155:8453  USDC  0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913  amount=20000
accepts[1]: eip155:196  USD₮0 0x779ded0c9e1022225f8e0630b35a9b54be713736  amount=20000
extensions.bazaar.info.input: { type: "http", method: "GET" }   + output.example ✓
```

**Coinbase validate：8/8 端点全部 `outcome: accepted`、零失败项**（`npm run check:live` 可随时复验）。
官方说“任意一个买家成功付过一次款后自动索引，无需任何申请”，因此服务已具备上架条件。

### 8.6 币安侧复查（2026-10-02，与 OKX 任务大厅对比）

**结论：币安没有 OKX 那种「任务大厅」，一个都没有。**

| | OKX.AI | 币安 Agent OS |
|---|---|---|
| 任务大厅（买方发需求 / 卖方接单） | 有，但**发布时就锁定了 ASP**，不是接单；总成交 $9,681 / 83,323 任务，日增仅 $5 | **无** |
| 服务广场（主动挂服务等买家） | 有，7 大类目约 60 个服务 | **无** |
| 目录（被动被发现） | 无公开目录 API | B402 Bazaar：**25 个端点，一个月零增长** |
| 结算通道 | X Layer（已上） | B402/BSC（需申请，见下） |
| 提交代码换流量 | 无 | Skill Hub（GitHub PR，**只收免费 SKILL.md，无收费机制**） |

**复查纠正了上一版的一个判断**：B402 的 API Key 申请**不是商务审批**，币安 x402 页面上的
`Apply for API Key` 按钮直接指向一个公开 Google 表单
（`docs.google.com/forms/d/e/1FAIpQLScUfaXvaKB4u…/viewform`），自助填表即可。
上一版写的“contact us for access / clientId+RSA+IP 白名单”门槛判断过高。

**新增风险**：B402 目录里所有条目的 `accepts[].scheme` 都是 **`eip3009`**，
而我们用的是 x402 v2 标准的 **`exact`**。申请时需确认 B402 是否接受 `exact`，
否则开了 BSC 通道也进不了他们的目录。

**实际收益仍然是零**：`b402/bazaar/resources` 一个月前后都是同25 个端点；
其中唯一可查的 B402 卖家 hyreagent，111 笔总交易、85 天前停、余额 $0.08。

**决策**：BSC 通道可以去申请（自助、零成本、代码已就绪，`BSC_PAY_TO` + facilitator 一接就行），
但优先级低——它带来的是“多一条链”的可能性，不是流量。流量在 Coinbase Bazaar（已打通）。

### 8.8 剩下的风险与待办

- [ ] **确认 `0xe716…03f8` 在 Base 上能收到并动用 USDC**——地址是 OKX Agentic Wallet 的 EVM 地址，
      同一地址跨链通用，但 Base 网络的 USDC 能否在 OKX 侧看到/提现需实测（首笔成交时验证）
- [ ] 换常驻实例（Render Starter / Fly.io）——Bazaar 策展要求30 天可用性 ≥99%，
      Render 免费版休眠期达不到，持续失败会被自动下架
- [ ] 有首笔 Base 成交后确认已被索引；攒够调用量再争取 curation
- [ ] OKX.AI 广场上架审核（9/30 提交，10/02 仍为 `Listing under review`）
- [ ] （可选）填 B402 的 Google 表单申请 BSC 通道，顺带确认 `exact` scheme 兼容性
