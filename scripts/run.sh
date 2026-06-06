#!/usr/bin/env bash
# 실행@ 의 기계적 단계 — git pull + memory 복원 + 전역 CLAUDE.md
# 사용:  bash scripts/run.sh
# (docs/pending.md 요약은 Claude가 이 스크립트 실행 후 수행한다)
set -uo pipefail

cd "$(dirname "$0")/.." || exit 1
ROOT="$(pwd)"

# 1. git pull
echo "── git pull ──"
if ! git pull; then
  echo "✗ git pull 실패 (충돌·네트워크?) — 수동 확인 필요"
  exit 1
fi

# 2. memory 복원: repo memory/ → ~/.claude 라이브 디렉토리
MEM_DST="$HOME/.claude/projects/$(printf '%s' "$ROOT" | sed 's/[^a-zA-Z0-9]/-/g')/memory"
mkdir -p "$MEM_DST"
cp memory/*.md "$MEM_DST"/ 2>/dev/null && echo "✓ memory 복원 완료" || echo "⚠ memory 파일 없음 — 건너뜀"

# 3. 전역 CLAUDE.md 없으면 복사
if [ ! -f "$HOME/.claude/CLAUDE.md" ]; then
  mkdir -p "$HOME/.claude"
  cp config/global-claude.md "$HOME/.claude/CLAUDE.md" 2>/dev/null \
    && echo "✓ 전역 CLAUDE.md 복사" || echo "⚠ config/global-claude.md 없음"
fi

echo "── 기계적 단계 완료 → 이제 docs/pending.md 요약 ──"
