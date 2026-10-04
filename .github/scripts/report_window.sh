#!/usr/bin/env bash
# 리포트 자동 실행(schedule·auto dispatch) 창 판정 — 지연 cron이 KST 자정을 넘겨 전일 데이터로
# "다음 날짜" 파일을 선생성하면 그날 정규 실행이 "이미 발송됨"으로 skip된다 (errors.md 2026-10-04).
# 창 안에서만 생성하면 파일 날짜 == 의도한 날짜가 보장된다.
# usage: report_window.sh us|kr|weekly → exit 0 = 창 안, 1 = 창 밖
# 테스트: KST_DOW(1=월..7=일)·KST_HM(HHMM) env로 시각 주입.
set -u
dow="${KST_DOW:-$(TZ='Asia/Seoul' date +%u)}"
hm=$((10#${KST_HM:-$(TZ='Asia/Seoul' date +%H%M)}))   # 10# = 08xx octal 파싱 버그 회피
case "${1:-}" in
  us)     [ "$dow" -le 5 ] && [ "$hm" -ge 800 ] && [ "$hm" -le 2159 ] ;;   # 미 개장(22:30~) 전까지 전일 마감 유효
  kr)     [ "$dow" -le 5 ] && [ "$hm" -ge 1700 ] ;;                        # 당일 자정까지
  weekly) [ "$dow" -eq 7 ] && [ "$hm" -ge 1300 ] ;;
  *)      echo "usage: report_window.sh us|kr|weekly" >&2; exit 2 ;;
esac
