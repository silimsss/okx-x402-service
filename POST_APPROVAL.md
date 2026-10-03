# 审核通过后执行清单（POST-APPROVAL RUNBOOK）

Agent #14050「Crypto Market Pulse」
钱包: 0xe716aac67216948dad46fa4d610cc297e13d03f8
审核状态查询（随时可跑）:
```
"$HOME/.local/bin/onchainos.exe" agent get-my-agents --role asp
```

## 当前状态（2026-10-03 重新提交）

- 服务总数 **7 个**，`approvalStatus: 3` / `Listing under review` /
  `approvalRemark: 改资料触发重新审批`（提交时写入的原文）
- 本次 `agent update` 做了两件事：
  1. 新增 5 个服务（跨所费率对比 / 聪明钱 / 情绪 / 持仓量 / 月订），txHash
     `0x72417883…f8e6`
  2. 更新 Agent 卡片简介（原文见 `agent-description.txt`），txHash
     `0x4b2e827c…6a59`
- 审核期约 24h；审核期间**已存在的服务仍可用 ID 直连**，不影响线上调用
- 增量清单已执行完毕（`service-additions.json` 全部是 `operation: create`）
  ⚠️ **不要重复发送** —— 再发一次会重复上架一批同名服务

## 服务全景（7 个）

| # | 服务 | 服务 ID | 类型 | 定价 | 端点 |
|---|------|---------|------|------|------|
| 1 | 加密行情快报 Pro | 41320 | A2MCP | 0.05U/次 | `/v1/brief/:instId` |
| 2 | 行情速览免费版 | 41321 | A2MCP | 免费 | `/v1/preview/:instId` |
| 3 | 跨交易所资金费率对比 | 41442 | A2MCP | 0.04U/次 | `/v1/crossvenue` |
| 4 | 聪明钱仓位雷达 | 41443 | A2MCP | 0.03U/次 | `/v1/smartmoney` |
| 5 | 市场情绪仪表盘 | 41444 | A2MCP | 0.02U/次 | `/v1/sentiment` |
| 6 | 持仓量异动监控 | 41445 | A2MCP | 0.02U/次 | `/v1/openinterest` |
| 7 | 市场全景简报月订 | 41446 | A2A | 12U/月（72h 免费试用） | 会话交付 |

已从目录撤下的三个服务（`/v1/funding`、`/v1/combo`、`/v1/liquidation`）**不再上架**，
路由仍在线上可直接调用（免费版 `/public/funding`、`/public/combo`、
`/public/liquidation` 可继续用于引流），只是不作为商品出售。

## 收到"审核通过"邮件后，按顺序执行：

### 1. 确认上架状态
```
"$HOME/.local/bin/onchainos.exe" agent get-my-agents --role asp
```
Status 应从 not listed → listed，卡片简介应为新版（7 服务版）。

### 2. 服务就用平台侧探活
```
"$HOME/.local/bin/onchainos.exe" agent a2mcp-probe
```
逐个确认 6 个 A2MCP 端点能被平台正常调用（付费的应返回 402 挑战）。

### 3. 确认收款链路（首次真实收入后）
```
"$HOME/.local/bin/onchainos.exe" wallet balance
```
x402 结算直达该钱包，USDT（USD₮0, X Layer）。

### 4. 冷启动（可选，届时让我做）
- X 推文文案（模板思路已备好）
- 任务大厅匹配「行情/数据简报」类任务用 A2A 或免费交付接单，换首批真实评价

## 24 小时常驻（已解决免费档休眠）

Render 免费档 15 分钟无入站请求即休眠。现由 GitHub Actions 定时补流量：

- 文件：`.github/workflows/keepalive.yml`
- 频率：每 5 分钟（最小粒度）GET `/health`，任何入站请求都会重置 Render 闲置计时器
- 成本：公开仓库跑 Actions 不消耗计费分钟数，¥0
- 计费：免费档 750 小时/月，单服务 31 天上限 744 小时，**刚好卡在额度内**
- 手动补一次：仓库 → Actions → keepalive → Run workflow
- 已知边界：GitHub 定时任务可能延迟数分钟（所以用 5 分钟而非 14 分钟）；
  仓库连续 60 天无提交会被自动停用定时任务，推任意 commit 即恢复
- 若发现仍然被休眠（连续错过两次 ping），备选方案是外部免费 cron
  （cron-job.org / UptimeRobot，各 5 分钟档，需要注册账号）——告诉我，我来配

## 日常监控命令
```
# 服务健康（含渠道与端点清单）
curl https://crypto-market-pulse.onrender.com/health
# 免费接口抽查（应 200）
curl https://crypto-market-pulse.onrender.com/v1/preview/BTC-USDT
curl https://crypto-market-pulse.onrender.com/public/crossvenue
curl https://crypto-market-pulse.onrender.com/public/sentiment
curl https://crypto-market-pulse.onrender.com/public/smartmoney
curl https://crypto-market-pulse.onrender.com/public/openinterest
# 付费接口抽查（应 402）
curl -o /dev/null -w "%{http_code}" https://crypto-market-pulse.onrender.com/v1/brief/BTC-USDT
curl -o /dev/null -w "%{http_code}" https://crypto-market-pulse.onrender.com/v1/crossvenue
curl -o /dev/null -w "%{http_code}" https://crypto-market-pulse.onrender.com/v1/smartmoney
curl -o /dev/null -w "%{http_code}" https://crypto-market-pulse.onrender.com/v1/sentiment
curl -o /dev/null -w "%{http_code}" https://crypto-market-pulse.onrender.com/v1/openinterest
```
2026-10-03 实测：付费 4 个端点全部 402，免费 4 个全部 200，`/health` 0.85s。

## A2A / 订阅相关
- 月订服务（41446）走 A2A 议价/订阅线，订阅管理 CLI：subscribe-detail /
  subscribe-cost / start-autorenew / subscribe-cancel（需要时让我跑）
- 本次提交时平台提示 `okx-a2a doctor` 报告不可用（本地构建问题，不影响提交）；
  真出现通信失败时再处理：`okx-a2a doctor --fix`

## 已知事项
- ~~Render 免费实例 15 分钟休眠~~ → 已由 keepalive workflow 解决（见上）
- Builder Code 到邮箱后发我，我来集成返佣管道（35% 手续费返佣，USDT 小时级到账）
- 连交易所/第三方行情源均为公开接口，单家故障时服务内已做降级
