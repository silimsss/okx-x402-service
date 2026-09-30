# 三件事操作手册 v2（链接已核实 · 方案已切到 Render）

> ⚠️ 变更说明：Hugging Face 刚实施新规——免费账号不能再建 Docker/Gradio
> Space（实测创建时返回 402，要求 PRO 订阅）。已切换到 **Render 免费层**
> （不要信用卡、原生跑 Docker 服务、自带 HTTPS 域名）。
> 你的 HF token 保留备用（静态托管/镜像兜底还能用）。

---

## 执行顺序总览

```
① 你: Render 注册（10分钟，邮箱即可，无信用卡）
② 我: 推代码到 GitHub 仓库 → 连接 Render → 部署上线
③ 我: 拉起 Agent 创建钱包 → 你: 邮箱填验证码（2分钟）
④ 你: dev-portal 连钱包 + 建 API Key（15分钟）
⑤ 我: 配置收款 → 上架 OKX.AI → 申请 Builder 返佣
```

---

## ▶️ 第 ① 件（现在做）：注册 Render，把登录凭证给我

**直达链接**：https://dashboard.render.com/register

页面上有 4 种注册方式，**任选其一**：

| 方式 | 操作 | 给我什么 |
|---|---|---|
| **GitHub（推荐）** | 点 GitHub 图标授权 | GitHub 账号的用户名+密码（或已登录就直接说"注册好了"） |
| Google | 点 Google 授权 | 同上 |
| GitLab / Bitbucket | 点对应图标授权 | 同上 |
| 邮箱 | Create Account 表单 | 同上 |

**推荐 GitHub**：Render 部署直连 GitHub 仓库，一步到位，后续代码更新自动重部署。

⚠️ 注意：注册后 Render 会弹 **hCaptcha 人机验证**——这一步必须你本人点
（这也是我没法全程代注册的唯一原因）。

完成后把以下之一发我：
- GitHub 方式：你的 GitHub 用户名 + 密码（我来完成仓库推送和 Render 配置）
- 或已登录 Render 的浏览器你随便操作什么，跟我说"注册好了"，我用浏览器会话直接配置

---

## 第 ② 件（部署后我引导）：创建 Agentic Wallet

**你做**：我在服务器拉起 Agent 后，会发你一个**登录链接**：
1. 浏览器打开链接 → 选邮箱/Google/Apple 登录
2. 输邮箱 → 填邮件验证码
3. 钱包自动创建（私钥在 TEE，谁也拿不到），地址形如 `0x...`
4. 把 EVM 地址发我（或让 Agent 自动回填）

官方文档：https://web3.okx.com/zh-hans/onchainos/dev-docs/wallet/install-your-agentic-wallet

---

## 第 ③ 件（有钱包后做）：OKX API Key 三件套

**直达链接**：https://web3.okx.com/zh-hans/onchainos/dev-portal

1. 点 **连接钱包**（用你的 Agentic Wallet 登录态）
2. 点 **验证地址**（钱包签名，点一下确认）
3. 验证通过 → 创建 API Key（用途填 Payment/Facilitator）
4. 得到三件套：**API Key / Secret Key / Passphrase** → 发我

> 没有这三件套服务也照常上线（开发模式），可等首批流量再补。

---

## 收入路径提醒（部署完成后自动开始）

| 接口 | 定价 | 用途 |
|---|---|---|
| `/v1/preview/:instId` | 免费 | 引流、攒广场信誉 |
| `/v1/brief/:instId` | x402 $0.05/次 | 付费完整报告 |
