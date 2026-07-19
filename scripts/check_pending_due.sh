#!/usr/bin/env bash
# pending.md 만기 추적 — ⏰YYYY-MM-DD 태그가 오늘(KST) 이하인 항목을 표시.
# 용도: "내일 첫 실행 확인" 류 항목을 사람 기억에 맡기지 않는다 (stale pending 누적 방지).
# 호출: run.sh(실행@)가 자동 실행. 단독 실행도 가능: bash scripts/check_pending_due.sh
# 규약: pending.md 항목 줄 안에 ⏰2026-07-21 형태로 확인 예정일 기입 (닫으면 태그째 삭제).
set -u
cd "$(dirname "$0")/.." || exit 1

TODAY=$(TZ='Asia/Seoul' date +%Y-%m-%d)
FILE=docs/pending.md
[ -f "$FILE" ] || exit 0

due=0
while IFS= read -r line; do
  d=$(printf '%s' "$line" | grep -oE '⏰[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1 | tr -d '⏰')
  [ -z "$d" ] && continue
  if [ "$d" \< "$TODAY" ] || [ "$d" = "$TODAY" ]; then
    [ "$due" -eq 0 ] && echo "── ⏰ pending 확인 만기 도래 (${TODAY} 기준) ──"
    due=1
    # 항목 요약: 굵은 제목 부분만 추출, 없으면 줄 앞부분
    title=$(printf '%s' "$line" | grep -oE '\*\*[^*]+\*\*' | head -1 | tr -d '*')
    [ -z "$title" ] && title=$(printf '%s' "$line" | cut -c1-70)
    echo "  ⏰${d}  ${title}"
  fi
done < "$FILE"

[ "$due" -eq 0 ] && echo "── ⏰ pending 만기 항목 없음 ──"
exit 0
