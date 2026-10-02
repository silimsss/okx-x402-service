# Agent 变现平台全景调研（2026-10-02 实测）

结论先行：**x402 协议规格极高但当前无流量；真正收到钱的只有 OKX 任务大厅和 web2 刚需服务。**

---

## 一、x402 协议的真实地位（比预期高很多）

**已进 Linux Foundation**，2026-04-02 成立，40+ 会员：

| 类别 | 成员 |
|---|---|
| 支付 | Visa、Mastercard、Stripe、American Express、Adyen、Fiserv、Circle、Kakao Pay |
| 云/搜索 | AWS、Google、Microsoft、Cloudflare |
| 加密 | Coinbase、Ripple、Monad |
| 运维 | 币安支付 |

**Amazon Bedrock AgentCore Payments**（与 Coinbase + Stripe 共建）
- 2026-05-07 Preview → **2026-08-18 GA**
- 用 x402 + USDC，200ms 结算，支持 Coinbase 钱包或 Stripe Privy 钱包
- 文档明确把「**agent 付费获取付费墙后的实时市场数据**」列为用例

→ 协议长期前景极好；但**分发仍靠 Coinbase Bazaar**，AWS 提供的是买方能力，不是卖家目录。

---

## 二、各平台实测对比

| 平台 | 类型 | 分发渠道 | 给开发者分钱？ | 实测真实收入 |
|---|---|---|---|---|
| **OKX 广场 + 任务大厅** | web3 | 真人 | 是 | $9,681 总成交，**日增仅 $5**；销量冠军≈$2.3 |
| Coinbase Bazaar | web3 | agentic.market / API / MCP | 免上架 | crypto 类 30 天池 **≈$10** |
| B402 Bazaar（币安） | web3 | 币安 App | 免上架 | 25 个端点，一月零增长 |
| MCP 目录（Glama / Smithery） | web2 | Claude / ChatGPT | **否，零分成** | 平台赚，开发者不赚 |
| Apify / MCPize / MCP Marketplace | web2 | web | **是（80–85%）** | 有真实 Stripe 分账 |
| Tavily / Exa / Firecrawl | web2 | 开发者直连 | 是 | **Tavily 约 100 万开发者，已被 Nebius 收购** |

---

## 三、三个关键判断

### 1. 交易所在做「买方」，只有 Coinbase 在做「卖方市场」

Bybit（2026-02 接入 x402 支付）、Bitget（Agent Hub + MCP）、
Hyperliquid / Jupiter / dYdX —— **全都是让 agent 能花钱、能交易，没有一个是让开发者卖服务的**。
卖家分发目录只有 Coinbase Bazaar 和 B402 两个。

### 2. 「为 agent 建的目录」通病：平台赚，开发者不赚

MCP 生态的公开评价是：**"Free code. Paid hosting. Zero payout."**
而 Tavily（月活百万开发者、被大厂收购）走的是**开发者直连 + 传统收费**。

→ 差别不在协议，在于**有没有人真的需要这个能力**。

### 3. Agent 付费的是「刚需能力」，不是「又一个数据 API」

| 赛道 | 需求强度 |
|---|---|
| 搜索（Tavily / Exa / Brave） | Brave 月查询 **20 亿+**；Tavily 百万开发者 |
| 爬取 / 浏览器（Firecrawl / Browserbase） | 真实付费 |
| crypto 行情（我们所在） | 30 天全池 $10 |

crypto 行情是**锦上添花**，搜索是**刚需**。这就是差距。

---

## 四、策略建议（按优先级）

| 优先级 | 动作 | 理由 |
|---|---|---|
| 1 | **全力推 OKX 广场** | 唯一有真人买卖的市场。任务大厅不是接单大厅——发布时已锁定 ASP，只能被动等被搜到 |
| 2 | **保持 x402/CDP 就绪** | 边际成本为零，协议规格顶级，等生态成熟自然受益 |
| 3 | 观察 AWS AgentCore 生态 | 它让 agent 有支付能力，可能带来新买家群体 |
| 4 | Apify（web2，80% 分成） | 真实分成模式，但竞争激烈，crypto 数据不是它的刚需场景 |
| ❌ | **不再投入 B402 / 币安侧** | 一月零增长，且申请麻烦 |

---

## 五、需要如实承认的

**x402 这条线目前没有收入。** 我们已经把技术侧做到位（双链收钱、8/8 通过 validate、
元数据齐全），具备「一旦有买家就能立刻收钱」的能力——但买家还没来。

这不是执行问题，是生态阶段问题。继续在协议层优化的边际收益很低。

---

## 六、Kraken（海妖）复查 — 2026-10-02

实地核实：blog.kraken.com、kraken.com/kraken-cli、kraken.com/affiliate、
kraken.com/institutions/embed、kraken.tech/latest-releases、
github.com/krakenfx/kraken-cli `skills/INDEX.md`。

### 6.1 结论先行

**Kraken 没有「让开发者卖服务」的市场。** 它做的是反方向的另一件事：把执行能力
（CLI + MCP + 59 个技能）免费发给 agent，让 agent 能下单。Krwaken 自己赚钱的方式是
**赚交易量的钱**，不是赚 API 调用的钱。

这和此前记录的 Bybit / Bitget / 币安是**同一个模式**：全是让 agent 能花钱（买方），
没有一个是让开发者卖服务（卖方市场）。三家之后是第四家，样本已经足够。

### 6.2 对比表

| 平台 | 分发渠道 | 是否给开发者分钱 | 30 天真实收入池 | 接入门槛 |
|---|---|---|---|---|
| **Kraken CLI** | CLI + 原生 MCP + 59 个 SKILL.md | ❌ 全部 MIT 免费开源 | 0（不是卖方市场） | 一条 curl 命令 |
| **Kraken Embed** | 机构白标（银行/PSP） | 最高 50% 终身佣金 | 未公开 | 需公司资质 + 月交易量，个人不可及 |
| **Kraken Affiliate** | 内容/ KOL 引流 | ✅ 最高 50%（Prop 25%） | **$65M / 自 2023，800+ 伙伴** | 表单审核，5 个工作日 |
| Kraken Marketplace | — | — | — | ⚠️ 是**能源板块**（公用事业计费），与加密无关 |

### 6.3 两个必须记住的坑

**坑一：kraken.tech 不是加密交易所。** 它是 Kraken Technologies —— 能源/公用事业
的计费 SaaS（Product Studio、Bill Editor、Kraken Embed 电表版）。搜索"Kraken
Marketplace / AI Access layer"会命中这里，容易误判成交易所的 agent 生态。

**坑二：联盟 6500 万美元不是给「开发者」的。** 它按**被推荐人的交易量**分成。
我们没有交易者受众，只有 API 调用者 —— 变现模型对不上。

### 6.4 真正的威胁：Kraken 免费送走了我们的核心卖点

`skills/INDEX.md`（59 个技能，MIT 许可）逐条比对我们的 7 个付费端点：

| 我们的端点 | 定价 | Kraken 免费等价物 | 覆盖 |
|---|---|---|---|
| `/v1/brief` | $0.05 | `recipe-morning-market-brief` | ❌ 正面命中 |
| `/v1/funding` | $0.03 | `recipe-funding-rate-scan`、`kraken-funding-carry` | ❌ 正面命中 |
| `/v1/liquidation` | $0.02 | `kraken-liquidation-guard` | ❌ 正面命中 |
| `/v1/openinterest` | $0.02 | 仅本所 OI，跨交易所缺失 | ⚠️ 部分 |
| `/v1/combo` | $0.08 | 多技能组合即可复现 | ⚠️ 部分 |
| `/v1/sentiment` | $0.02 | 无 | ✅ 空白 |
| `/v1/smartmoney` | $0.03 | 无 | ✅ 空白 |

官方宣传语第一条就是 "build me a **morning market brief** for BTC, ETH, and SOL"。
**7 个付费端点里有 3 个被头部交易所免费开源正面覆盖**，且品牌背书远强于我们。

### 6.5 但这里有一条结构性缝隙

Kraken 的技能**只能看见 Kraken 自己**。所有 59 个技能都建立在自家订单簿、
自家资金费率、自家强平流之上。这是交易所的结构性利益冲突：

> 一家头部交易所永远不会给 agent 一个「跨交易所对比杠杆」或「聪明钱正在流向哪」
> 的工具 —— 那会暴露并攻击自己的持仓和市场地位。

**这不是能力问题，是利益问题。** 因此 Kraken 永远不会补上：

- 跨交易所中立对比（谁在逼仓、谁的盘口更薄）
- 聪明钱流向 / 链上异动
- 多交易所聚合的情绪指数

**这三项恰好是我们能建、且 Kraken 永远不会建的东西。**

### 6.6 战略转向：从「卖 HTTP 端点」到「卖 SKILL.md」

Kraken 的分发格式比 x402 更贴近现实：**免费 SKILL.md + 付费后端**。
它的 50 个技能包证明 agent 消费的是技能文件，不是 402 响应头。

市场已经存在且有真实分成：

| 平台 | 创作者分成 |
|---|---|
| AgentPowers | 85% |
| LarryBrain | 订阅额的 50% |
| ClawHub（平台自述头部） | 号称 $600–$20,000/月 |

⚠️ 这些分成比例来自各平台自述，未经独立验证 —— 按本文件第六节的标准，
应视为待验证数据，**不能和 Coinbase `$10/30天` 实测池同等对待**。

**行动含义：** 我们已在 Render 上跑着一套能收 USDC 的服务。把其中**不可被 Kraken
替代**的三项（跨交易所中性 / 聪明钱 / 多所情绪）封装成 SKILL.md，在上述技能市场
上架，用技能做漏斗、用 x402 端点做收款。这比在 OKX 广场卖 0.5U 的晨报更有前景——
因为晨报已经有人免费送了。