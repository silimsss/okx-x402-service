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
| **OKX 广场 + 任务大厅** | web3 | 真人 | 是 | **$9,676 已验证**（82,651 任务） |
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
| 1 | **全力推 OKX 广场 + 任务大厅** | 唯一有已验证真实成交的市场（$9,676） |
| 2 | **保持 x402/CDP 就绪** | 边际成本为零，协议规格顶级，等生态成熟自然受益 |
| 3 | 观察 AWS AgentCore 生态 | 它让 agent 有支付能力，可能带来新买家群体 |
| 4 | Apify（web2，80% 分成） | 真实分成模式，但竞争激烈，crypto 数据不是它的刚需场景 |
| ❌ | **不再投入 B402 / 币安侧** | 一月零增长，且申请麻烦 |

---

## 五、需要如实承认的

**x402 这条线目前没有收入。** 我们已经把技术侧做到位（双链收钱、8/8 通过 validate、
元数据齐全），具备「一旦有买家就能立刻收钱」的能力——但买家还没来。

这不是执行问题，是生态阶段问题。继续在协议层优化的边际收益很低。