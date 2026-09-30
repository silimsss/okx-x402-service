# 免费部署方案（零编程版）—— 不买 VPS 也上线

## 三种免费方案对比

| 方案 | 费用 | 我能代办的程度 | 前提 |
|---|---|---|---|
| ⭐ **Hugging Face Space**（推荐） | 免费 | **90% 我来做**（有 token 就能全远程推送部署） | 你注册一个 HF 账号 |
| Oracle Cloud 永久免费层 | 免费（要卡验证） | 50%（你建好实例后我来部署） | 你注册 Oracle 账号 + 一张信用卡 |
| Google Cloud Run 免费额度 | 免费 | 50%（同上） | 你注册 GCP + 信用卡 |

**推荐 Hugging Face**：不要求信用卡、注册只要邮箱、Space 常驻不休眠、
还自带 `xxx.hf.space` 公网域名（OKX.AI 上架直接填它）。

## 你要做的（10 分钟）

1. 打开 https://huggingface.co/join 用邮箱注册（0 门槛，不用实名）
2. 点头像 → Settings → Access Tokens → **New token**：
   - 类型选 **Write**
   - 名字随便填（如 `deploy`）
3. **把 token 发给我**（hf_xxx 开头的一串）

## 之后全部我来（自动执行）

1. 创建你的 Space 仓库（`crypto-market-pulse`，Docker 类型）
2. 推送服务代码 + 部署配置
3. 等待平台构建（3~5 分钟）
4. 验证公网地址：`https://你的用户名-crypto-market-pulse.hf.space/health`
5. 把两个 endpoint 写进上架信息，进入 ASP 注册流程

## 已备好的部署物料

- [deploy/hf-space/README.md](deploy/hf-space/README.md) — Space 元数据（Docker 类型、端口 4000）
- [deploy/hf-space/app.py](deploy/hf-space/app.py) — 入口：监听 HF 要求的 7860，反代到 Node 服务的 4000，含健康探活
- Space 构建时会自动执行 Dockerfile（已含 Node 22 + 依赖安装）

## 注意事项

- HF 免费层是 CPU 基本款，跑这个服务绰绰有余（内存 <100MB）
- 免费层 48 小时无访问可能重启，我们的 60 秒缓存和 10 秒超时已做兼容；上架后广场 Agent 的定期调用本身就能保活
- 收款仍需 OKX API Key 三件套（手册第 2 步），没配置前服务以开发模式跑——**先上架免费预览接口攒信誉，再补收款配置**，两步可以分开
- Token 权限用完可随时在 HF 后台吊销；更稳妥的做法是部署完成后你换新 token
