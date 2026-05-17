#!/usr/bin/env bash
# 저장! 의 기계적 단계 — memory 미러 + git add/commit/push
# 사용:  bash scripts/save.sh "<커밋 메시지>"
# (세션 문서 작성은 Claude가 먼저 한 뒤 이 스크립트를 호출한다)
set -uo pipefail

MSG="${1:-}"
if [ -z "$MSG" ]; then
  echo "✗ 커밋 메시지가 필요합니다:  bash scripts/save.sh \"메시지\""
  exit 1
fi

cd "$(dirname "$0")/.." || exit 1
ROOT="$(pwd)"

# 1. memory 미러: ~/.claude 라이브 디렉토리 → repo memory/
MEM_SRC="$HOME/.claude/projects/$(echo "$ROOT" | sed 's:[ /]:-:g')/memory"
if [ -d "$MEM_SRC" ]; then
  cp "$MEM_SRC"/*.md memory/ 2>/dev/null && echo "✓ memory 미러 완료" || echo "⚠ memory 파일 없음 — 건너뜀"
else
  echo "⚠ memory 소스 디렉토리 없음: $MEM_SRC"
fi

# 2. git add
git add -A

# 3. 변경 없으면 종료
if git diff --cached --quiet; then
  echo "✓ 커밋할 변경 없음 — 종료"
  exit 0
fi

# 4. commit
if git commit -m "$MSG" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"; then
  echo "✓ 커밋 완료"
else
  echo "✗ 커밋 실패"
  exit 1
fi

# 5. push
if git push; then
  echo "✓ push 완료 — 저장 끝"
else
  echo "✗ push 실패 — 커밋은 로컬에 있음. 네트워크 확인 후 'git push' 재시도"
  exit 1
fi
