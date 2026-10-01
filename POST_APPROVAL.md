# 审核通过后执行清单（POST-APPROVAL RUNBOOK）

Agent #14050「Crypto Market Pulse」
钱包: 0xe716aac67216948dad46fa4d610cc297e13d03f8
审核状态查询（随时可跑）:
```
"$HOME/.local/bin/onchainos.exe" agent get-my-agents --role asp
```

## 服务全景（审核通过 + 增量更新后共 9 个）

| # | 服务 | 类型 | 定价 | 状态 |
|---|------|------|------|------|
| 1 | 加密行情快报 Pro | A2MCP | 0.05U/次 | 已提交审核中 |
| 2 | 行情速览免费版 | A2MCP | 0 | 已提交审核中 |
| 3 | 市场情绪仪表盘 | A2MCP | 0.02U/次 | 待增量上架 |
| 4 | 资金费率雷达 | A2MCP | 0.03U/次 | 待增量上架 |
| 5 | 三合一市场速览 | A2MCP | 0.08U/次 | 待增量上架 |
| 6 | 聪明钱仓位雷达 | A2MCP | 0.03U/次 | 待增量上架 |
| 7 | 全市场爆仓雷达 | A2MCP | 0.02U/次 | 待增量上架 |
| 8 | 持仓量异动监控 | A2MCP | 0.02U/次 | 待增量上架 |
| 9 | 市场全景简报月订 | A2A | 12U/月（72h 免费试用） | 待增量上架 |

## 收到"审核通过"邮件后，按顺序执行：

### 0. 先查重（重要！update 是增量语义，重复 create 会被拒或产生重复服务）
```
"$HOME/.local/bin/onchainos.exe" agent service-list --agent-id 14050 --page-size 20
```
- 对照 service-additions.json，把已经存在的服务从增量清单里删掉
- ⚠️ 不要拿 service-all.json 直接 update —— 它是 9 服务完整目录（含已存在的
  快报 Pro 和免费版），直接发会重复 create。**增量上架只用 service-additions.json**

### 1. 增量上架 7 个新服务
```
export PATH="/c/Program Files/nodejs:$APPDATA/npm:$PATH"
"$HOME/.local/bin/onchainos.exe" agent update --agent-id 14050 \
  --service "$(cat okx-x402-service/service-additions.json)"
```
- 内容：情绪 0.02 / 费率 0.03 / 三合一 0.08 / 聪明钱 0.03 / 爆仓 0.02 /
  持仓量 0.02 / A2A 月订 12U·月（fee 传空串 + subscription + freeTrial 72）
- 注意：update 会再次触发审核（同样 ~24h），期间已有服务仍可用 ID 直连

### 2. 确认上架结果
```
"$HOME/.local/bin/onchainos.exe" agent get-my-agents --role asp
```
Status 应逐步从 not listed → listed；9 个服务应全部出现。

### 3. 确认收款链路（首次真实收入后）
```
"$HOME/.local/bin/onchainos.exe" wallet balance
```
x402 结算直达该钱包，USDT（USD₮0, X Layer）。

### 4. 冷启动（可选，届时让我做）
- 3 条 X 推文文案（模板思路已备好）
- 任务大厅匹配「行情简报」类任务用 A2A 接单

## 日常监控命令
```
# 服务健康
curl https://crypto-market-pulse.onrender.com/health
# 免费接口抽查（应 200）
curl https://crypto-market-pulse.onrender.com/public/sentiment
curl https://crypto-market-pulse.onrender.com/public/funding
curl https://crypto-market-pulse.onrender.com/public/smartmoney
curl https://crypto-market-pulse.onrender.com/public/liquidation
curl https://crypto-market-pulse.onrender.com/public/openinterest
# 付费接口抽查（应 402）
curl -o /dev/null -w "%{http_code}" https://crypto-market-pulse.onrender.com/v1/brief/BTC-USDT
curl -o /dev/null -w "%{http_code}" https://crypto-market-pulse.onrender.com/v1/smartmoney
curl -o /dev/null -w "%{http_code}" https://crypto-market-pulse.onrender.com/v1/liquidation
curl -o /dev/null -w "%{http_code}" https://crypto-market-pulse.onrender.com/v1/openinterest
```

## A2A / 订阅相关
- 月订服务走 A2A 议价/订阅线，订阅管理 CLI：subscribe-detail / subscribe-cost /
  start-autorenew / subscribe-cancel（需要时让我跑）
- 平台侧直连探活可用：`onchainos.exe agent a2mcp-probe`（上架后验证一次）

## 已知事项
- Render 免费实例 15 分钟无流量会休眠，首请求唤醒慢 ~50s；
  广场 Agent 调用即保活。如休眠影响体验，可后续升 $7/月。
- Builder Code 到邮箱后发我，我来集成返佣管道（35% 手续费返佣，USDT 小时级到账）。
- 爆仓数据为 OKX 强平抽样接口，报告内已注明"不代表全平台爆仓总量"。
