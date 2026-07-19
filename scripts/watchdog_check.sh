#!/usr/bin/env bash
# 자동화 헬스체크 — "실행됐어야 할 자동화가 실제 실행됐나"를 저녁에 1회 대사 (read-only).
# 설계: docs/plans/2026-07-19-자동화-watchdog.md
#
# 검사: ①푸시 체인 생존 ②오늘 발송 실적(run 로그의 result 에코) ③휴장 판정(GAS 에코 관측 —
#   자체 달력 없음) ④시트 파이프라인 신선도(portfolioMetrics dailyReturns 마지막 날짜)
#   ⑤리포트 파일 커밋(US/KR 평일, WEEK 일요일)
# 입력 env: GH_TOKEN(Actions) 또는 로컬 gh 로그인 / GAS_WEB_APP_URL·TG_WEBHOOK_SECRET(없으면 ④ skip)
#   / REPORTS_DIR(기본 docs/reports) / OUT_FILE(기본 /tmp/watchdog_msg.txt)
# 출력: OUT_FILE에 텔레그램용 메시지 + stdout 동일. exit 1 = 🔴 항목 존재.
set -u

REPO="${GITHUB_REPOSITORY:-ejunwon-lab/FD5to6}"
OUT_FILE="${OUT_FILE:-/tmp/watchdog_msg.txt}"
REPORTS_DIR="${REPORTS_DIR:-docs/reports}"

DATE_KST=$(TZ='Asia/Seoul' date +%Y-%m-%d)
DOW=$(TZ='Asia/Seoul' date +%u)    # 1=월 .. 7=일
DOW_KO=$(python3 -c "print('월화수목금토일'[${DOW}-1])")
# KST 자정의 UTC 표기 — gh의 createdAt(UTC)과 비교해 "오늘 KST" run만 고름 (macOS date -d 비호환 → python)
SINCE_UTC=$(python3 - <<'PYEOF'
from datetime import datetime, timedelta, timezone
kst = timezone(timedelta(hours=9))
mid = datetime.now(kst).replace(hour=0, minute=0, second=0, microsecond=0)
print(mid.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'))
PYEOF
)

LINES=()
RED=0
add() { LINES+=("$1"); case "$1" in 🔴*) RED=1 ;; esac; }

# ── ① 푸시 체인 생존 (24/7 체인이라 언제나 active run ≥1이 정상) ──────────────
alive=$(gh run list -R "$REPO" -w telegram-push.yml -L 20 --json status \
  --jq '[.[]|select(.status=="in_progress" or .status=="queued")]|length' 2>/dev/null) || alive=""
if [ -z "$alive" ]; then
  add "⚠️ 푸시 체인 확인 불가 (gh run list 실패)"
elif [ "$alive" -ge 1 ]; then
  add "✅ 푸시 체인 alive (active run ${alive}개)"
else
  add "🔴 푸시 체인 사망 — active run 0개 (다음 cron 재시드까지 푸시 공백)"
fi

# ── ②③ 오늘 발송 실적 + 휴장 판정 — completed run 로그의 GAS result 에코 집계 ──
ids=$(gh run list -R "$REPO" -w telegram-push.yml -s completed -L 30 --json databaseId,createdAt \
  --jq ".[]|select(.createdAt>=\"$SINCE_UTC\")|.databaseId" 2>/dev/null) || ids=""
sent=0; holiday=no; logs_ok=no
for id in $ids; do
  log=$(gh run view "$id" -R "$REPO" --log 2>/dev/null) || continue
  logs_ok=yes
  c=$(printf '%s' "$log" | grep -c '"result":"sent"')
  sent=$((sent + c))
  printf '%s' "$log" | grep -q 'skip-holiday' && holiday=yes
done

# 거래일 판정: 주말은 요일로, 평일 공휴일은 GAS 에코(skip-holiday) 관측으로 — 달력 중복 구현 안 함
trading=yes
[ "$DOW" -ge 6 ] && trading=no
[ "$holiday" = "yes" ] && trading=no

if [ "$trading" = "yes" ]; then
  if [ "$logs_ok" = "no" ]; then
    add "🔴 텔레그램 푸시: 오늘 completed run 0건 — 체인·cron 모두 미발화 의심"
  elif [ "$sent" -ge 1 ]; then
    add "✅ 텔레그램 푸시 발송 ${sent}건"
  else
    add "🔴 텔레그램 푸시 발송 0건 — 거래일인데 sent 없음 (GAS result 확인 필요)"
  fi
else
  add "✅ 휴장/주말 — 푸시 발송 ${sent}건 (0건이 정상)"
  # 같은 날 skip-holiday와 sent가 공존 = GAS 휴장 판정이 장중에 오갔다는 뜻 (제헌절 부류 단서)
  [ "$sent" -ge 1 ] && add "🔴 휴장인데 발송 ${sent}건 — 휴장 오발송 의심"
fi

# ── ④ 시트 파이프라인 신선도 — 거래일이면 추이기록 마지막 거래일 행 == 오늘 ──────
if [ -n "${GAS_WEB_APP_URL:-}" ] && [ -n "${TG_WEBHOOK_SECRET:-}" ]; then
  # GAS 웹앱 POST: -X POST 금지(302 echo가 405) — --data + -L (errors.md 2026-06-06)
  payload=$(printf '{"action":"portfolioMetrics","secret":"%s"}' "$TG_WEBHOOK_SECRET")
  resp=$(curl -sS -L -m 60 "$GAS_WEB_APP_URL" -H 'Content-Type: application/json' --data "$payload" 2>/dev/null) || resp=""
  last=$(printf '%s' "$resp" | jq -r '.dailyReturns[-1].date // empty' 2>/dev/null) || last=""
  if [ -z "$last" ]; then
    add "⚠️ 시트 신선도 확인 불가 (portfolioMetrics 응답 이상)"
  elif [ "$trading" = "yes" ]; then
    if [ "$last" = "$DATE_KST" ]; then
      add "✅ 시트 갱신 최신 (추이기록 ${last})"
    else
      add "🔴 시트 갱신 stale — 추이기록 마지막 ${last}, 오늘(${DATE_KST}) 행 없음 (updateAllNew 미실행 의심)"
    fi
  else
    add "✅ 시트 마지막 거래일 행 ${last} (휴장 — 오늘 행 없음 정상)"
  fi
else
  add "⚠️ GAS env 미설정 — 시트 신선도 skip"
fi

# ── ⑤ 리포트 커밋 — 평일 US·KR, 일요일 WEEK (휴장도 직전거래일 폴백 생성이 정상) ──
if [ -d "$REPORTS_DIR" ]; then
  if [ "$DOW" -le 5 ]; then
    for p in US KR; do
      if [ -f "$REPORTS_DIR/${p}-${DATE_KST}.md" ]; then
        add "✅ ${p} 리포트 커밋됨"
      else
        add "🔴 ${p} 리포트 없음 — ${p}-${DATE_KST}.md 미생성"
      fi
    done
  elif [ "$DOW" -eq 7 ]; then
    if [ -f "$REPORTS_DIR/WEEK-${DATE_KST}.md" ]; then
      add "✅ 주간 리포트 커밋됨"
    else
      add "🔴 주간 리포트 없음 — WEEK-${DATE_KST}.md 미생성"
    fi
  fi
else
  add "⚠️ 리포트 repo 미체크아웃 (${REPORTS_DIR}) — 리포트 확인 skip"
fi

# ── 메시지 조립 (매일 heartbeat — 부재 자체가 watchdog 사망 신호) ────────────────
{
  echo "🩺 자동화 헬스체크 (${DATE_KST} ${DOW_KO})"
  for l in "${LINES[@]}"; do echo "$l"; done
} > "$OUT_FILE"
cat "$OUT_FILE"
exit "$RED"
