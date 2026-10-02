#!/usr/bin/env bash
# 多链结算通道离线回归测试（本地，全程 mock，不依赖外网）
#
# 模式1 仅 OKX 通道        ：无 BASE_PAY_TO                        -> 8453=off，402 只列 eip155:196
# 模式2 Base 开关开/CDP挂 ：BASE_PAY_TO 已设，CDP 指向不可达         -> 探测超时降级，OKX 通道不受影响
# 模式3 双 facilitator 正常 ：OKX + CDP 都指向 mock                 -> 8453=usdc，402 同时列出两链
# 模式4 facilitator 全挂   ：两个都不可达                            -> x402:error，付费路由 503（不放行），进程存活
# 模式5 无 OKX_API_KEY     ：开发模式                                -> x402=dev-mode，付费路由放行
set -u
export PATH="/c/Program Files/nodejs:$APPDATA/npm:$PATH"
cd "$(dirname "$0")/.."

APP_PORT=${APP_PORT:-4402}
MOCK_OKX_FAC=${MOCK_OKX_FAC:-4390}
MOCK_CDP_FAC=${MOCK_CDP_FAC:-4391}
MOCK_MARKET=${MOCK_MARKET:-4312}
LOG=/tmp/smoke-multichain.log
BAD_PORT=9   # 指向不存在的端口，模拟 facilitator/上游不可达

pass=0; fail=0
ok()   { echo "  [PASS] $1"; pass=$((pass+1)); }
bad()  { echo "  [FAIL] $1"; fail=$((fail+1)); }

start_app() { local log="$1"; shift; env "$@" node src/server.js > "$log" 2>&1 & APP_PID=$!; }

wait_health() { # $1=秒数 -> 打印 health body
  local n=$1 body=""
  for _ in $(seq 1 "$n"); do
    sleep 1
    kill -0 "$APP_PID" 2>/dev/null || break
    body=$(curl -s -m 3 "http://localhost:$APP_PORT/health" 2>/dev/null)
    [ -n "$body" ] && break
  done
  printf '%s' "$body"
}

stop_app() { kill "$APP_PID" 2>/dev/null; wait "$APP_PID" 2>/dev/null; sleep 1; }

jget() { printf '%s' "$1" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);const p=process.argv[1].split(".").reduce((a,k)=>a&&a[k],j);console.log(p===undefined?"":p)}catch(e){console.log("")}})' "$2"; }

code() { curl -s -m 12 -o /dev/null -w "%{http_code}" "$1"; }
TMP=test/.tmp; mkdir -p "$TMP"   # 放项目内：Windows 下 node 不认 MSYS 的 /tmp 路径
J402="$TMP/402.json"
H402="$TMP/402.headers"
payto=0x1111111111111111111111111111111111111111
BASE="http://localhost:$APP_PORT"
MKT="OKX_BASE=http://localhost:$MOCK_MARKET"

# ---- mock 进程 ----
MOCK_OKX_PORT=$MOCK_MARKET node test/mock-okx-v2.js > /tmp/mock-market.log 2>&1 & MKT_PID=$!
FAC_PORT=$MOCK_OKX_FAC MOCK_NETWORKS=eip155:196  node test/mock-facilitator.js > /tmp/mock-fac-okx.log 2>&1 & FAC1=$!
FAC_PORT=$MOCK_CDP_FAC MOCK_NETWORKS=eip155:8453 node test/mock-facilitator.js > /tmp/mock-fac-cdp.log 2>&1 & FAC2=$!
trap 'kill $MKT_PID $FAC1 $FAC2 2>/dev/null' EXIT
sleep 2
# mock 没起来就直接报错，否则后面全是看不懂的 502
for f in /tmp/mock-market.log /tmp/mock-fac-okx.log /tmp/mock-fac-cdp.log; do
  grep -qE "listening|mock OKX v2 on" "$f" || { echo "mock 未就绪: $f"; cat "$f"; exit 1; }
done

# ============ 模式1 ============
: > "$LOG"
start_app "$LOG" PORT=$APP_PORT "$MKT" OKX_API_KEY=k OKX_SECRET_KEY=s OKX_PASSPHRASE=p \
  OKX_FACILITATOR_URL=http://localhost:$MOCK_OKX_FAC
H=$(wait_health 10)
echo "模式1 仅 OKX 通道"
[ "$(jget "$H" x402)" = "enabled" ] && ok "x402=enabled" || bad "x402=$(jget "$H" x402)"
[ "$(jget "$H" 'channels.eip155:8453')" = "off" ] && ok "8453=off" || bad "8453=$(jget "$H" 'channels.eip155:8453')"
C=$(code "$BASE/v1/brief/BTC-USDT"); [ "$C" = "402" ] && ok "/v1/brief=402" || bad "/v1/brief=$C"
curl -s -m 6 -D "$H402" -o "$J402" "$BASE/v1/brief/BTC-USDT"
N=$(ACCEPTS_COUNT_ONLY=1 node test/check-accepts.js "$J402" "$H402" "")
[ "$N" = "1" ] && ok "accepts 只列 1 条" || bad "accepts=$N 条"
C=$(code "$BASE/public/sentiment"); [ "$C" = "200" ] && ok "/public/sentiment=200" || bad "/public/sentiment=$C"
stop_app

# ============ 模式2 ============
: > "$LOG"
start_app "$LOG" PORT=$APP_PORT "$MKT" OKX_API_KEY=k OKX_SECRET_KEY=s OKX_PASSPHRASE=p \
  OKX_FACILITATOR_URL=http://localhost:$MOCK_OKX_FAC \
  BASE_PAY_TO=$payto BASE_PROBE_TIMEOUT_MS=2500 CDP_FACILITATOR_URL=http://localhost:$BAD_PORT
H=$(wait_health 20)
echo "模式2 Base 开关开 / CDP 不可达（应降级）"
[ "$(jget "$H" x402)" = "enabled" ] && ok "OKX 通道未受影响 x402=enabled" || bad "x402=$(jget "$H" x402)"
[ "$(jget "$H" 'channels.eip155:8453')" = "off" ] && ok "8453=off" || bad "8453=$(jget "$H" 'channels.eip155:8453')"
C=$(code "$BASE/v1/brief/BTC-USDT"); [ "$C" = "402" ] && ok "/v1/brief=402" || bad "/v1/brief=$C"
grep -q "CDP facilitator 探测未通过" "$LOG" && ok "有降级日志" || bad "缺降级日志"
stop_app

# ============ 模式3 ============
: > "$LOG"
start_app "$LOG" PORT=$APP_PORT "$MKT" OKX_API_KEY=k OKX_SECRET_KEY=s OKX_PASSPHRASE=p \
  OKX_FACILITATOR_URL=http://localhost:$MOCK_OKX_FAC \
  BASE_PAY_TO=$payto CDP_FACILITATOR_URL=http://localhost:$MOCK_CDP_FAC
H=$(wait_health 15)
echo "模式3 OKX + Base 双通道"
[ "$(jget "$H" 'channels.eip155:8453')" = "usdc" ] && ok "8453=usdc" || bad "8453=$(jget "$H" 'channels.eip155:8453')"
[ "$(jget "$H" 'channels.eip155:196')" = "usdt0" ] && ok "196=usdt0" || bad "196=$(jget "$H" 'channels.eip155:196')"
C=$(code "$BASE/v1/brief/BTC-USDT"); [ "$C" = "402" ] && ok "/v1/brief=402" || bad "/v1/brief=$C"
curl -s -m 6 -D "$H402" -o "$J402" "$BASE/v1/brief/BTC-USDT"
node test/check-accepts.js "$J402" "$H402" "$payto" || fail=$((fail+1))
C=$(code "$BASE/public/smartmoney"); [ "$C" = "200" ] && ok "/public/smartmoney=200" || bad "/public/smartmoney=$C"
C=$(code "$BASE/v1/preview/BTC-USDT"); [ "$C" = "200" ] && ok "/v1/preview=200(免费)" || bad "/v1/preview=$C"
stop_app

# ============ 模式4 ============
: > "$LOG"
start_app "$LOG" PORT=$APP_PORT "$MKT" OKX_API_KEY=k \
  OKX_FACILITATOR_URL=http://localhost:$BAD_PORT X402_INIT_TIMEOUT_MS=3000
H=$(wait_health 15)
echo "模式4 facilitator 全不可达（应 x402=error 且付费 503）"
[ "$(jget "$H" x402)" = "error" ] && ok "x402=error" || bad "x402=$(jget "$H" x402)"
kill -0 $APP_PID 2>/dev/null && ok "进程存活（不再被未捕获拒绝打死）" || bad "进程已崩溃"
C=$(code "$BASE/v1/brief/BTC-USDT"); [ "$C" = "503" ] && ok "付费路由 503（不放行）" || bad "付费路由=$C"
C=$(code "$BASE/v1/preview/BTC-USDT"); [ "$C" = "200" ] && ok "免费预览仍可用" || bad "/v1/preview=$C"
C=$(code "$BASE/public/sentiment"); [ "$C" = "200" ] && ok "/public/* 仍可用" || bad "/public/sentiment=$C"
stop_app

# ============ 模式5 ============
: > "$LOG"
start_app "$LOG" PORT=$APP_PORT "$MKT"
H=$(wait_health 8)
echo "模式5 无 OKX_API_KEY（开发模式）"
[ "$(jget "$H" x402)" = "dev-mode" ] && ok "x402=dev-mode" || bad "x402=$(jget "$H" x402)"
C=$(code "$BASE/v1/brief/BTC-USDT"); [ "$C" = "200" ] && ok "付费路由放行 200" || bad "/v1/brief=$C"
stop_app

echo
echo "===== 结果: PASS=$pass FAIL=$fail ====="
rm -rf "$TMP"