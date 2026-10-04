#!/usr/bin/env bash
# 자동화 헬스체크 — "실행됐어야 할 자동화가 실제 실행됐나"를 저녁에 1회 대사 (read-only).
# 설계: docs/plans/2026-07-19-자동화-watchdog.md · 대상일 개념: docs/plans/2026-10-04-watchdog-자정넘김-KR선생성.md
#
# 검사: ①푸시 체인 생존 ②대상일 발송 실적(run 로그의 result 에코) ③휴장 판정(GAS 에코 관측 —
#   자체 달력 없음) ④시트 파이프라인 신선도(portfolioMetrics dailyReturns에 대상일 행)
#   ⑤리포트 파일 커밋 + 커밋 시각(US/KR 평일, WEEK 일요일)
# 대상일: 실행 시점이 KST 20시 이전이면 전일 — GH cron이 자정 넘겨 지연 발화해도 "끝난 하루"를
#   검사한다 (실행 시점 날짜를 쓰면 막 시작된 날을 검사해 전 항목 오탐, errors.md 2026-10-04).
# 입력 env: GH_TOKEN(Actions) 또는 로컬 gh 로그인 / GAS_WEB_APP_URL·TG_WEBHOOK_SECRET(없으면 ④ skip)
#   / REPORTS_DIR(기본 docs/reports) / OUT_FILE(기본 /tmp/watchdog_msg.txt)
#   / WATCHDOG_DATE(YYYY-MM-DD, 대상일 강제 — 과거일 재현·테스트용)
# 출력: OUT_FILE에 텔레그램용 메시지 + stdout 동일. exit 1 = 🔴 항목 존재.
# `--print-target [UTC ISO]`: 그 시각(기본 now)의 대상일만 출력 — watchdog.yml dedup이 같은 규칙을 공유.
set -u

target_date() {
  python3 - "${1:-}" <<'PYEOF'
import sys
from datetime import datetime, timedelta, timezone
kst = timezone(timedelta(hours=9))
a = sys.argv[1] if len(sys.argv) > 1 else ''
t = datetime.strptime(a, '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=timezone.utc) if a else datetime.now(timezone.utc)
k = t.astimezone(kst)
if k.hour < 20:
    k -= timedelta(days=1)
print(k.strftime('%Y-%m-%d'))
PYEOF
}
if [ "${1:-}" = "--print-target" ]; then target_date "${2:-}"; exit $?; fi

REPO="${GITHUB_REPOSITORY:-ejunwon-lab/FD5to6}"
OUT_FILE="${OUT_FILE:-/tmp/watchdog_msg.txt}"
REPORTS_DIR="${REPORTS_DIR:-docs/reports}"

NOW_DATE_KST=$(TZ='Asia/Seoul' date +%Y-%m-%d)
DATE_KST="${WATCHDOG_DATE:-$(target_date)}"
# 대상일의 요일(1=월..7=일) + KST 하루 경계의 UTC 표기 — gh의 createdAt(UTC)과 비교 (macOS date -d 비호환 → python)
META=$(python3 - "$DATE_KST" <<'PYEOF'
import sys
from datetime import datetime, timedelta, timezone
kst = timezone(timedelta(hours=9))
d = datetime.strptime(sys.argv[1], '%Y-%m-%d').replace(tzinfo=kst)
f = '%Y-%m-%dT%H:%M:%SZ'
print(d.isoweekday(), d.astimezone(timezone.utc).strftime(f), (d + timedelta(days=1)).astimezone(timezone.utc).strftime(f))
PYEOF
) || META=""
if [ -z "$META" ]; then echo "대상일 형식 오류: '${DATE_KST}' (YYYY-MM-DD)" >&2; exit 2; fi
# shellcheck disable=SC2086
set -- $META
DOW=$1; SINCE_UTC=$2; UNTIL_UTC=$3
DOW_KO=$(python3 -c "print('월화수목금토일'[${DOW}-1])")

LINES=()
RED=0
add() { LINES+=("$1"); case "$1" in 🔴*) RED=1 ;; esac; }

# ── ① 푸시 체인 생존 (24/7 체인이라 언제나 active run ≥1이 정상 — 대상일 무관, 현재 시점) ──
alive=$(gh run list -R "$REPO" -w telegram-push.yml -L 20 --json status \
  --jq '[.[]|select(.status=="in_progress" or .status=="queued")]|length' 2>/dev/null) || alive=""
if [ -z "$alive" ]; then
  add "⚠️ 푸시 체인 확인 불가 (gh run list 실패)"
elif [ "$alive" -ge 1 ]; then
  add "✅ 푸시 체인 alive (active run ${alive}개)"
else
  add "🔴 푸시 체인 사망 — active run 0개 (다음 cron 재시드까지 푸시 공백)"
fi

# ── ②③ 대상일 발송 실적 + 휴장 판정 — completed run 로그의 GAS result 에코 집계 ──
ids=$(gh run list -R "$REPO" -w telegram-push.yml -s completed -L 100 --json databaseId,createdAt \
  --jq ".[]|select(.createdAt>=\"$SINCE_UTC\" and .createdAt<\"$UNTIL_UTC\")|.databaseId" 2>/dev/null) || ids=""
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
    add "🔴 텔레그램 푸시: ${DATE_KST} completed run 0건 — 체인·cron 모두 미발화 의심"
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

# ── ④ 시트 파이프라인 신선도 — 거래일이면 추이기록에 대상일 행 존재 ──────────────
if [ -n "${GAS_WEB_APP_URL:-}" ] && [ -n "${TG_WEBHOOK_SECRET:-}" ]; then
  # GAS 웹앱 POST: -X POST 금지(302 echo가 405) — --data + -L (errors.md 2026-06-06)
  payload=$(printf '{"action":"portfolioMetrics","secret":"%s"}' "$TG_WEBHOOK_SECRET")
  resp=$(curl -sS -L -m 60 "$GAS_WEB_APP_URL" -H 'Content-Type: application/json' --data "$payload" 2>/dev/null) || resp=""
  last=$(printf '%s' "$resp" | jq -r '.dailyReturns[-1].date // empty' 2>/dev/null) || last=""
  # 지연 실행 시 이미 다음 거래일 행이 붙었을 수 있어 "마지막 == 대상일"이 아니라 "대상일 행 존재"로 판정
  has=$(printf '%s' "$resp" | jq -r --arg d "$DATE_KST" 'if ([.dailyReturns[]?.date]|index($d)) == null then "no" else "yes" end' 2>/dev/null) || has=""
  if [ -z "$last" ]; then
    add "⚠️ 시트 신선도 확인 불가 (portfolioMetrics 응답 이상)"
  elif [ "$trading" = "yes" ]; then
    if [ "$has" = "yes" ]; then
      add "✅ 시트 갱신 확인 (추이기록 ${DATE_KST} 행 존재)"
    else
      add "🔴 시트 갱신 stale — 추이기록 마지막 ${last}, ${DATE_KST} 행 없음 (updateAllNew 미실행 의심)"
    fi
  else
    add "✅ 시트 마지막 거래일 행 ${last} (휴장 — ${DATE_KST} 행 없음 정상)"
  fi
else
  add "⚠️ GAS env 미설정 — 시트 신선도 skip"
fi

# ── ⑤ 리포트 커밋 — 평일 US·KR, 일요일 WEEK (휴장도 직전거래일 폴백 생성이 정상) ──
# 존재만 보면 "지연 cron이 자정 넘겨 전일 데이터로 선생성한 파일"을 통과시킨다(errors.md 2026-10-04)
# → 마지막 커밋 시각이 대상일 당일·최소 시각 이후인지까지 본다. 이력 필요(checkout fetch-depth: 0).
check_report() {   # $1=접두(US|KR|WEEK) $2=표시명 $3=최소 시각(KST 시)
  local f="${1}-${DATE_KST}.md" ct cdate chour
  if [ ! -f "$REPORTS_DIR/$f" ]; then
    add "🔴 ${2} 리포트 없음 — ${f} 미생성"
    return 0
  fi
  ct=$(TZ='Asia/Seoul' git -C "$REPORTS_DIR" log -1 --format=%cd --date=format-local:'%Y-%m-%d %H:%M' -- "$f" 2>/dev/null) || ct=""
  if [ -z "$ct" ]; then
    add "⚠️ ${2} 리포트 있음 — 커밋 시각 확인 불가 (git 이력 없음)"
    return 0
  fi
  cdate="${ct%% *}"; chour="${ct#* }"; chour=$((10#${chour%%:*}))
  if [ "$cdate" = "$DATE_KST" ] && [ "$chour" -ge "$3" ]; then
    add "✅ ${2} 리포트 커밋됨 (${ct#* })"
  else
    add "🔴 ${2} 리포트 커밋 시각 이상 — ${ct} KST (정상: ${DATE_KST} ${3}시 이후). 지연 실행이 전일 데이터로 만들었을 수 있음"
  fi
}
if [ -d "$REPORTS_DIR" ]; then
  if [ "$DOW" -le 5 ]; then
    check_report US US 7
    check_report KR KR 16
  elif [ "$DOW" -eq 7 ]; then
    check_report WEEK 주간 0
  fi
else
  add "⚠️ 리포트 repo 미체크아웃 (${REPORTS_DIR}) — 리포트 확인 skip"
fi

# ── 메시지 조립 (매일 heartbeat — 부재 자체가 watchdog 사망 신호) ────────────────
{
  echo "🩺 자동화 헬스체크 (${DATE_KST} ${DOW_KO})"
  [ "$DATE_KST" != "$NOW_DATE_KST" ] && echo "⏱️ 지연 실행 — ${DATE_KST} 기준 점검 (실행 $(TZ='Asia/Seoul' date '+%m-%d %H:%M') KST)"
  for l in "${LINES[@]}"; do echo "$l"; done
} > "$OUT_FILE"
cat "$OUT_FILE"
exit "$RED"
