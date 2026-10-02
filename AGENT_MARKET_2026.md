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

---

## 七、SKILL.md 付费市场实测 — 结论是「死了」

上一节 6.6 提出的「转做 SKILL.md」建议，本节用公开API 验伪。**建议不成立，撤回。**

### 7.1 AgentPowers：全量 34 个技能的真实成交（2026-10-02 快照）

`api.agentpowers.ai/v1/skills?limit=100` **免鉴权**，直接返回 `download_count` /
`view_count` / `install_count` / `rating_count`。全量结果：

| 指标 | 免费技能（12 个） | 付费技能（22 个） |
|---|---|---|
| 下载 | **103** | **0** |
| 安装 | 29 | 0 |
| 浏览 | 249 | 1,184 |
| 评分 | — | **0** |

**下载量前 9 名全部是 $0 免费技能**（30/23/14/9/9/8/5/4/1），付费技能无一上榜。
浏览最高的付费技能（$5，125 次浏览）**仍是 0 下载**。全站 1,433 次浏览 →
**22 个付费技能、0 笔成交、0 条评价、$0 收入**。

**付费转化率 = 0 / 22。**

这不是「我们还没上架」的问题，是**这个市场不存在付费需求**。

### 7.2 两个必须先拆掉的陷阱

**陷阱一：落地页的收入数字是假的。** `agentpowers.ai/sellers` 上展示的
「Revenue $2,847 / Downloads 1,249 / 7 skills」与创作者
「Jane Developer @janedev、github.com/janedev、janedev.com、8.4k downloads」——
**全是虚构人物的演示数据**。它和真实 API 的 103 次总下载差了一个数量级。
这个平台的营销页会主动编造收益。

**陷阱二：$600–$20,000/月 是场外收入，不是平台收入。** skillhq / agensi 那几篇
「ClawHub 创作者月入 $600–$20,000」的真实机制是：**创作者用自己的受众另开炉灶**
（独立站、订阅、卖课），平台只提供品牌背书。技能市场本身一分钱不参与。

### 7.3 ClawHub：连收款功能都没有

Reddit 实测反馈：ClawHub 的热门技能**全部 MIT 免费**，且「市场本身不具备让开发者
赚钱的基础设施」。规模与安全数据：

- arXiv 论文（2604.13064）归一化采集 **26,502** 个技能
- 2026 年 2 月底 13,729 个注册技能，**安全清理后只剩 3,286**（清除 ~76%）
- Palo Alto Unit 42（2026-06）确认 ClawHub 存在持续、规避性的恶意技能

三个数字均来自公开论文与安全厂商报告，未经独立复核。

### 7.4 LarryBrain：不是市场，是推广返佣

模式与前两者根本不同：**创作者收入 = 50% × 自己推荐来的订阅者的 $29.99/月**。
官方页面自己给的例子是「10 referrals = $150/mo passive income」。

也就是说 LarryBrain 把「拉新」成本完全转嫁给创作者，平台只收订阅费。
**没有受众 = 零收入**，与 Coinbase Bazaar / OKX 广场的瓶颈完全相同。

### 7.5 三个平台的横向对比

| 平台 | 付费机制 | 分成 | 规模 | 实测成交 |
|---|---|---|---|---|
| AgentPowers | 单技能买断（最低 $5） | 85% | 34 个（22 付费） | **付费 0 笔** |
| ClawHub | **无付费机制** | — | 26,502 索引 | 不适用 |
| LarryBrain | 订阅推荐返佣 | 50% | 70+ 技能 | 无数据，需自带受众 |

### 7.6 元结论：这一整类市场都没有钱

把 x402 目录（22,004 服务 / $10）、技能市场（34 个付费 / $0）、OKX 任务大厅
（$0.0074/任务）放在一起，**三条不同的技术路线、同一个结果：零**。

区别只在于失败原因：

- Coinbase x402 目录：**协议没人用**（调用量不足）
- 技能市场：**付费意愿不存在**（看的人不少，0 人买）
- OKX 任务大厅：**发布即锁定**（机制上无法接单）

**真正的共性不是技术，是「没有人真的需要这个能力」。**

这三份数据共同推翻了 6.6 节的转向建议。Kraken 免费技能带来的竞争压力是**真的**
（3/7 端点被覆盖），但应对方式不是「换个格式去技能市场卖」——那里也是零。

**修正后的结论：** 唯一被验证过能卖出 8.58K 单的东西，是TradeDesk 那种
「交付邀请链接 + 开通指引」的**订阅漏斗**，而不是任何形式的 API/技能出售。

---

## 八、悬赏平台复查 — TryBounty / TaskBounty / AgentBounty / Bountix

方向终于对了：前七轮找的都是「agent 买服务（买方）」，而这几个是
**「agent 干活拿钱（卖方）」**。这是我们一直在找的市场形态。

### 8.1 四家定性

| 平台 | 定性 | 关键证据 |
|---|---|---|
| **TryBounty** | ✅ **真实可交易** | 排行榜有真实周收益；真实挂牌带美元金额；运营主体为注册公司 |
| Bountix | ⚠️ 包装成agent 平台的**人类劳务市场** | 钱包入口指向死锚点；分类全是人工标注工作 |
| AgentBounty | ❌ **虚构演示站** | 首页 342 个悬赏 / 实际 12 个；支付数据停在 2026 年 2 月 |
| TaskBounty | ❌ **空市场** | 开放任务页「No matching tasks yet」 |

### 8.2 TryBounty：唯一值得行动的

**运营主体：The AI Experimental Lab, LLC**（美国新泽西州 9 Edinburg Circle，
条款更新 2026-09-15）。收款走 **Stripe**。有完整 agent 侧 FAQ：准入条件、
Agent Card、领单流程、最低赏金、收款方式、API 文档与 SDK。

**已验证的真实数据（非自述）：**

| 指标 | 值 | 来源 |
|---|---|---|
| 本周第一名收益 | **$195**（LightX，评分 4.5） | /leaderboard |
| 第二 / 第三 / 第四 | $165 / $105 / $90 | 同上 |
| 真实成交赏金单价 | $5.75 – $80.50，均值 ≈ $26 | /explore 挂牌明细 |
| 平台自述 | 2K+ 任务、200+ agent、$60K+ 已验证收益 | 首页（未独立验证） |

完整可用链路：发单 Details → Review → Fund，托管 + 预言机验收，失败退款，
97.5% 无争议完成。

**但要看清需求在哪：** 实际挂牌的 100 单全部是**视频 / 内容 / 设计 / 剪辑 / Logo**。
分类里确实有「Research & Competitive Intelligence」，但**未见到任何加密、金融、
数据分析类悬赏**。

### 8.3 三个不成立的

**AgentBounty（agentbounty.org）——数据是编的：**

- 首页称「342 Active Bounties」，实际 `/bounties` 页只有 **12 个**（差 28 倍）
- 月度支付：2025-12 $275,200 → 2026-01 $312,800 → 2026-02 $248,500 → **然后无数据**
  距今已连续 **7 个月零记录**，而「活跃」悬赏的截止日全部是 2026 年 2–3 月
- 前15 名 hunter 合计 $976,100 > 最近三个月总支付 $836,500，**内部逻辑不可能**
- 胜率 78/72/69/65…44 与悬赏数 47/39/34…14 同步严格递减，是生成数据的规律

**Bountix（bountix.ai）——包装成 agent 平台的人类劳务：**

- 声称 301,000+ agent，但唯一「LIVE BOUNTY」是 Appen 的 $65-95/hr 代码评估**工程师岗**
- 分类全为 Red Teaming / LLM Evaluation / SFT / 幻觉审计 = 人工标注工作
- 所有「Connect Wallet」均指向 `index.html#connect-wallet` **死锚点**，无真实支付
- 页面存在乱码字符

**TaskBounty（task-bounty.com）——市场是空的：**

- `/browse` 开放任务：**「No matching tasks yet」**
- 真实生意在页脚：AI App 安全扫描、Deep Review、Repo & CI Hardening，
  对标 Devin / Copilot agent / Factory AI。agent 市场只是空壳功能

### 8.4 对我们的实际意义

TryBounty 是七轮调研里**第一个形态正确且真实付钱**的平台。但要注意它与我们
现有业务的错位：

- 它的模型是「**领任务 → 交付成果 → 收钱**」，我们需要真的去干活（写研究报告、
  交付名单），而不是卖一个 API 调用
- 收款走 **Stripe**（需要银行账户），不是 USDC——现有 x402 收款基础设施用不上
- 头部 agent 本周 $195，是全职接活的收入量级
- 需求集中在视频内容，**未见加密金融类**

**结论：值得注册，但不能当成现有 API 的变现渠道。** 它是接活的渠道，
需要一套完全不同的能力（交付物生成 + 履约）。

### 8.5 技术可行性：已核实，但被收款卡死

`docs.trybounty.ai`（更新至 2026-10-01）是真材实料的开发者平台，不是空壳：

| 项目 | 结论 |
|---|---|
| 接入方式 | TypeScript SDK（推荐）/ **MCP**（Streamable HTTP）/ Flue / Raw HTTP API |
| 拉单 | `GET /v1/agent/bounties`，建议 30 秒轮询 |
| 事件 | `bounty.available`；webhook 非必选（轮询即可，无需公网地址） |
| 收益字段 | `payout_cents` = agent 实收；`amount_cents` = 买家全包（含平台费，已废弃） |
| 生命周期 | 发现 → 评估 → claim → 私信 → 提交 → 验收反馈，每个 (AgentID, BountyID) 独立上下文 |
| 加入成本 | **零**：无押金、无订阅、无 API 费、无平台抽成 |

现成的 [okx-x402-service](okx-x402-service) 完全能当底座：Express 服务、Render 托管、
密钥管理、MCP 兼容、公网 HTTPS 全部现成。**技术上可行。**

**但有一个不可绕过的硬闸门：**

> 收款必须完成 Stripe Connect。目前开通国家仅**比利时、巴西、保加利亚、加拿大、
> 德国、意大利、墨西哥、波兰、瑞士、美国**。
>
> 且文档明确：**“Once the Agent Card and Stripe Connect are ready, Bounty can
> release Bounties to the Agent.”**

**没有 Stripe Connect，平台不会派单。** 这不是「以后补」的问题。

官方留了口子（`support@trybounty.ai` 可申请新增国家），但截至 2026-10 未开通中国。

### 8.6 最终结论：因收款不可达而放弃

2026-10-02 决策：**不投入**。

原因不是平台不好——它是七轮调研里唯一真实付钱、且形态正确的 agent 任务市场。
原因是我们**收不到钱**。在合规前提下无法解决，且不接受以虚假身份开设境外
Stripe 账户（违反 KYC）。

叠加 8.2 提到的需求错配（可见悬赏集中在视频内容，无加密金融类），即便通道打通，
前期投入也缺乏明确的回报路径。

**保留记录**：若日后官方开通中国区 Stripe Connect，或出现加密金融类悬赏集中发布，
本节可直接作为技术方案的起点，无需重新调研。

---

## 九、撸毛（空投）赛道复查 — 数据驱动的死亡确认

### 9.1 方法说明

X（Twitter）对未登录访问强制跳转登录墙，Nitter 镜像已全部失效。
本次改用两条可行路径：`site:x.com` 定向检索拿到真实推文摘要，以及直接访问
可公开打开的 X 长文与引用帖。文中所有数字均来自可点开的原始页面。

### 9.2 收益已经崩塌（有量化数据）

X 长文《Airdrop farming is 100% cooked》（@info_insightful, 2026-03-17）：

> “HL printed 5-6 figs (7-8 figs for power users) for the same perp dex farming
> efforts that **today will get you $50-60 instead, or $500-$2k in the better/best cases**.”

Hyperliquid 当年单个地址拿过 **100 万美元**（@CC2Ventures, 2024-11-29）。
同样的动作量，今天值 **$50–60**，好情况 $500–2k。**衰减 100 倍以上。**

中文信源同向（@DeBox_CN, 2026-08）：每天 **4-8 小时**投入在任务与养号上，
“单号收益缩水到几百甚至**几十美元**”。新浪财经（2026-04-09）《Web3空投已死》。

个人侧样本（@0xCryptolord）：“早期空投币里 20 个，**19 个价值 $0**，只有 1 个值 $300+。”

### 9.3 决定性数据：撸毛者不是我们的客户

Arrakis Finance 用 Hyperliquid 交易所自己签发的订单标签（time-in-force、builder code、
fill flag、hold time）做了**确定性分类**（非统计推测），样本：

- 周期：2026-03-10 ~ 03-31 共 21 天
- Trade.xyz 四个 HIP-3 市场：**79,622 个钱包 / 519.5 亿美元**总成交

| 分类 | 钱包数占比 | 成交占比 |
|---|---|---|
| **Airdrop Farmer** | **44.07%**（35,091 个） | **0.77%**（4 亿美元） |
| Market Maker | <0.5% | **63%** |

原文：“Nearly half of all active wallets produced **under one percent** of total volume.”
且 99.3%（34,859 个）的撸毛钱包集中在 `xyz:CL` 一个市场，行为是
**“small back-to-back trades in both directions, registering volume without taking
on price risk”**。

**结论：撸毛者占近一半的钱包，却只贡献不到 1% 的成交，且是双向刷单、不是为了
行情判断。** 他们不需要资金费率对比、不需要聪明钱流向、不需要跨所价差。

而同一份研究里，**做市商 63% 的成交**、**套利机器人**——**这两类才是我们跨交易所
端点的真实买家人群**。

### 9.4 女巫墙已经合拢

撸毛赛道当前的主要矛盾不是收益低，而是**被系统性排除**：

- Base 推出 **Base Verify Onchain** 做女巫抗性；Fairscale 在 Solana 上做声誉分发基础设施
- @info_insightful：“项目方自己女巫自己的空投是最优解——你完全知道标准和时间表，
  很难不手痒”（Openmind 实例，@Naeven_）
- @NeowaveIO：Backpack 空投误伤真实用户的案例分析
- 热门项已被刷烂：Monad / Starknet / zkSync 被 @TeamAirdrops 列入
  “2026 年不值得讨论”名单

### 9.5 他们到底在为什么付费

现有付费产品全部**不是行情数据**，而是任务管理：

| 产品 | 实际做什么 |
|---|---|
| Teneo Beacon | 任务计时器、资格检查、活动窗口 |
| Engages.io | 社区活跃度追踪 |
| @marinonchain | “撸了 5 年，从没找到一个不只是列活动清单的tracker，只好自己做” |
| Polysights（@stacy_muur） | 市场 AI 摘要，但“**只有月交易 $10K+ 才值回票价**” |

**最后一条最关键**：连最头部的内容创作者都判断，撸毛者达不到付费工具的门槛交易量。
而且撸毛者为了省钱而多账户、多链操作，**恰恰是最不愿意为工具付费的人群**。

### 9.6 结论

**1. 撸毛作为赚钱赛道已经死亡**，不是我们能力不够，是单位时间收益跌了两个数量级，
且被女巫系统系统性排除。

**2. 撸毛者不是我们的客户。** 44% 钱包 / 0.77% 成交 + 双向刷单行为，
决定了他们不会为任何交易数据付费。

**3. 这条调研反而验证了跨交易所端点的方向。** 同一份 Arrakis 数据里，
真正贡献 63% 成交的做市商与套利机器人，才是需要跨所费率价差的那群人——
这印证了 6.5 节的判断：**做市与套利是结构性的真实需求，与撸毛热度无关。**