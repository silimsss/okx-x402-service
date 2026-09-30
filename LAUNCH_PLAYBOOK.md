# 上线手册（零编程版）—— Crypto Market Pulse

> 服务代码已开发并测试完毕。你只需要按顺序做下面 7 步，
> 每步要么是"点鼠标"，要么是"复制粘贴我准备好的话"。
> 预计总耗时：1~2 小时（多为等待审核）。

---

## 第 0 步：准备一台"能上网的服务器"（必须）

代码需要访问 `www.okx.com` 拉行情，当前这台内网机器跑不了。

**选一个（按省事程度排序）：**
1. ⭐ 推荐：任何海外 VPS（RackNerd/Vultr/阿里云国际，$5/月起，选 Ubuntu 22.04）
2. 免费方案：Oracle Cloud 永久免费层 / Fly.io 免费额度
3. 家里常开的电脑也行（需端口转发，不推荐新手）

**服务器买好后，把这句话发给我：**
> "服务器开好了，IP 是 xxx，SSH 密码是 xxx，帮我部署"

后续部署命令全部由我执行，你不用碰终端。

---

## 第 1 步：注册 Agentic Wallet（收款钱包）

1. 浏览器打开 https://www.okx.ai/zh-hans/tutorial/asp
2. 点"安装 Onchain OS"部分的引导（或直接在服务器装好后由 Agent 引导）
3. 准备一个**邮箱**（建议 Gmail），按页面提示完成登录
4. 记下你的**钱包地址**（0x 开头）

> 把钱包地址发给我，我帮你写进配置。

---

## 第 2 步：申请 OKX 开发者 API Key

1. 打开 OKX 开发者管理平台（OKX 官网 → 开发者 → API 管理）
2. 创建 API Key，用途选 "Payment/Facilitator"
3. 得到三件套：`API Key`、`Secret Key`、`Passphrase`

> ⚠️ 三个值只发给我（或你自己填进服务器上的 `.env`），不要发给别人。
> 没有这三件套服务也能跑，但只是"开发模式"，收不了真钱。

---

## 第 3 步：部署（我来做）

给我 SSH 后我执行：
```bash
git clone <本项目> && cd okx-x402-service
npm install --omit=dev
cp .env.example .env   # 填入钱包地址 + API Key
npm install @okxweb3/x402-express @okxweb3/x402-core @okxweb3/x402-evm
npm i -g pm2 && pm2 start src/server.js --name pulse && pm2 save
```
然后验证 `https://你的域名或IP/health` 返回 ok。

---

## 第 4 步：注册 ASP（A2MCP 类型）

在你的服务器上装有 Claude Code / OpenClaw / Codex 任一编码 Agent 后，
**把这两句话依次发给它**（官方教程原文）：

第一句（安装）：
> npx -y @okxweb3/onchainos-installer install

第二句（注册）：
> 帮我使用 Onchain OS 的 OKX Agent Identity 在 OKX.AI 注册一个 A2MCP 类型的 ASP

Agent 会引导你完成注册并绑定 Agentic Wallet。

---

## 第 5 步：上架到 OKX.AI

对 Agent 说：
> 帮我使用 Onchain OS 在 OKX.AI 上架我的 ASP

上架信息照抄：
- **名称**: Crypto Market Pulse · 加密行情快报
- **描述**: 实时 BTC/ETH/SOL 市场快报：现价、24h/7d/30d 涨跌、RSI(14)、趋势判定、20日关键支撑阻力、年化波动率，输出结构化 JSON + 中文 Markdown 报告。数据源 OKX 官方行情。
- **免费 endpoint**: `https://你的域名/v1/preview/BTC-USDT`
- **付费 endpoint**: `https://你的域名/v1/brief/BTC-USDT`（x402, $0.05/次）

24 小时内审核，结果发到你注册邮箱。

---

## 第 6 步：申请 AI Builder（第二收入管道）

1. 打开 https://www.okx.com/zh-hans-sg/agent-tradekit/builder
2. 点"立即申请"，提交：
   - 项目名: Crypto Market Pulse
   - 描述: AI Agent 行情快报与信号服务，将集成 OKX 交易能力
3. 1 个工作日内拿 **Builder Code**（= 35% 手续费返佣资格）
4. 拿到 Code 后告诉我，我帮你把它集成进服务的交易引导模块

---

## 第 7 步：冷启动增长（前两周）

- ✅ 免费预览接口先挂出去，积累"已售 + 好评"（广场排序权重）
- ✅ 给服务加 3~5 个交易对变体（BTC/ETH/SOL/OKB/DOGE）
- ✅ 在 X 上发 2~3 条演示推文（可以@OKX 中文官方蹭曝光）
- ✅ 观察任务大厅，有匹配的"行情简报"任务就用 A2A 承接
- ✅ 数据：日均 100 次付费调用 = 5U/天 ≈ 150U/月；接上 Builder 返佣后上不封顶

---

## 时间线与预期收益（保守估计）

| 阶段 | 时间 | 动作 | 月收入预期 |
|---|---|---|---|
| 冷启动 | 第 1-2 周 | 免费引流 + 首批付费 | $0-10 |
| 爬坡 | 第 3-8 周 | 提价至 $0.1、加币种、攒口碑 | $20-80 |
| 稳定 | 第 3 月起 | 订阅制 + Builder 返佣 + 黑客松 | $100+ |

> 上限取决于广场排序与复购，头部同类服务（缠论指标）已售 8,580 次。

## 风险与红线

- 不做交易信号类内容（避免投资建议合规风险），只输出**事实+区间**的信息服务
- 收款为 X Layer 链上 USDT，大陆用户注意出金合规
- API Key 泄露 = 收款被人替换，仅存服务器 `.env`，不要进 git
