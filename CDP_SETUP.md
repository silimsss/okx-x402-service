# 开通 Base 收款通道（照着做，不用懂技术）

一句话：Coinbase 官方目录里挂着 **23,000+** 个 x402 服务，是币安 B402 目录（25 个）的近千倍。
但那个目录**只收 Base 链**的付款——我们现在只有 X Layer，所以进不去。这份文档带你把它打开。

全程约 5 分钟，**不花钱**（每月前 1000 笔交易免费，超出才 $0.001/笔）。

---

## 你要拿的东西

两串字符，Coinbase 发的：

| 名字 | 长相 | 放哪 |
| --- | --- | --- |
| **API Key ID** | `organizations/xxxx-…/apiKeys/xxxx-…` | Render 变量 `CDP_API_KEY_ID` |
| **API Key Secret** | `-----BEGIN EC PRIVATE KEY-----` 开头的长文本 | Render 变量 `CDP_API_KEY_SECRET` |

> ⚠️ **Secret 只显示一次**，关掉页面就再也看不到了，页面会让你下载一个 JSON 文件，先存好。
> 🔒 **这两串绝不要发到聊天里、微信里、任何地方。** 只粘到 Render 的输入框里。

---

## 第 1 步：注册 Coinbase Developer Platform

1. 浏览器打开 <https://portal.cdp.coinbase.com/>
2. 点右上角 **Sign in** / **Get started**
3. 用邮箱注册并验证（建议用你已验证过 OKX 账号的那个邮箱 silimsss@gmail.com）
4. 按提示填资料。CDP 账号是免费的，不绑银行卡也能用到「每月 1000 笔免费」的额度

## 第 2 步：创建 API Key

1. 登录后直接进这个页面：<https://portal.cdp.coinbase.com/projects/api-keys>
2. 选 **Secret API Keys** 标签（不要选 Wallet Keys、也不要用 "Secret" 以外的类型）
3. 点 **Create API key**
4. 名字随便填，比如 `crypto-market-pulse`
5. 权限保持默认即可（CDP facilitator 只需要验签与结算）
6. 点创建 → 页面会显示 **ID** 和 **Secret**，同时弹出一个下载按钮

**把下载下来的 JSON 文件存好**，长这样：

```json
{
  "id": "organizations/xxxx-xxxx-xxxx/xxxx/apiKeys/xxxx-xxxx-xxxx",
  "secret": "-----BEGIN EC PRIVATE KEY-----\nMHcCAQ...\n-----END EC PRIVATE KEY-----\n"
}
```

## 第 3 步：填进 Render

1. 打开 Render 控制台 → 你的服务 **crypto-market-pulse**
2. 左侧 **Environment** → **Add Environment Variable**，填 3 个：

| Key | Value |
| --- | --- |
| `BASE_PAY_TO` | `0xe716aac67216948dad46fa4d610cc297e13d03f8` |
| `CDP_API_KEY_ID` | 第 2 步的 **ID**（`organizations/…` 那一串） |
| `CDP_API_KEY_SECRET` | 第 2 步的 **Secret**（`-----BEGIN EC PRIVATE KEY-----` 开头） |

> `BASE_PAY_TO` 填的是你现有的收款地址。**同一个 EVM 地址在 X Layer 和 Base 上都通用**，
> 所以不用新建钱包、也不用导入私钥，钱都会到同一个地方。
>
> 粘 Secret 时如果换行被压成一行没关系，程序会自动还原。

3. 点 **Save Changes**，Render 会自动重新部署（约 2–3 分钟）

---

## 第 4 步：确认成功

浏览器打开 <https://crypto-market-pulse.onrender.com/health>，看到这样就对了：

```json
{
  "x402": "enabled",
  "channels": {
    "eip155:196": "usdt0",
    "eip155:8453": "usdc",          ← 关键：这里必须是 usdc
    "eip155:56": "pending-merchant-onboarding"
  }
}
```

### 如果显示不对

| 你看到 | 什么意思 | 怎么办 |
| --- | --- | --- |
| `"eip155:8453": "off:not-configured"` | `BASE_PAY_TO` 没填上 | 回第 3 步检查 Key 有没有拼错 |
| `"eip155:8453": "off:probe-failed"` 且有 `baseProbeError` | 连不上 Coinbase 或 Key 不对 | 看下面 |
| `"eip155:196": "off"` | OKX 通道也挂了，检查 OKX 三件套 | 看 Render 日志 |

`baseProbeError` 的常见内容：

- `fetch failed` → Render 到 Coinbase 的网络问题，等几分钟自动重试
- `CDP supported 探测超时` → 同上，多半是 Coinbase 临时拥堵
- `Facilitator supported failed (401)` → **Key 不对**，回第 2 步重做
- `CDP facilitator 响应正常但未列出 eip155:8453/exact` → 换个 Key，或联系 Coinbase

**注意：Base 通道挂掉不会影响 X Layer 收款**，两个通道是独立的。

---

## 第 5 步：验证能被 Coinbase 目录收录

在项目目录下运行（需要能连外网）：

```bash
node tools/validate-bazaar.js
```

8 个端点全部显示 `valid=true` 就彻底通了。之后只要有**任意一个买家成功付过一次款**，
Coinbase 会自动把这个服务写进公开目录，不用再做任何申请。

---

## 顺带一提：换掉 Render 免费版

Coinbase 对上架目录有硬性要求：**30 天可用性 ≥ 99%**，而且持续失败会被自动下架。

Render 免费版空闲 15 分钟就休眠、冷启动还要 1–2 分钟，可用性远达不到 99%。
想真正吃到这个目录的流量，Base 通道开好后建议升级到常驻实例（Render Starter 约 $7/月）。

在那之前，服务本身是正常的，只是拿不到目录的自然流量——先靠 OKX 广场和任务大厅跑通首笔收入。

---

## 相关文件

- [src/multichain.js](src/multichain.js) — 通道开关、资产配置、路由扩展
- [src/cdp-auth.js](src/cdp-auth.js) — Coinbase 的 JWT 鉴权（ES256/EdDSA，无需装官方 SDK）
- [src/bazaar.js](src/bazaar.js) — 目录发现元数据
- [tools/validate-bazaar.js](tools/validate-bazaar.js) — 收录自检工具
- [.env.example](.env.example) — 所有环境变量说明
