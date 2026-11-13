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
MEM_SRC="$HOME/.claude/projects/$(printf '%s' "$ROOT" | sed 's/[^a-zA-Z0-9]/-/g')/memory"
if [ -d "$MEM_SRC" ]; then
  cp "$MEM_SRC"/*.md memory/ 2>/dev/null && echo "✓ memory 미러 완료" || echo "⚠ memory 파일 없음 — 건너뜀"
else
  echo "⚠ memory 소스 디렉토리 없음: $MEM_SRC"
fi

# 2. git add
git add -A

# 2.5. 저장 직전 자동 검사 — harness/session.sh 와 같은 검사기 (공개 repo라 걸리면 커밋 중단)
GUARD="$(dirname "$(readlink "$HOME/.claude/CLAUDE.md" 2>/dev/null)")/save_guard.py"
if [ -f "$GUARD" ] && command -v python3 >/dev/null 2>&1; then
  python3 -I "$GUARD" "$ROOT" || exit 1
elif [ "${SAVE_ALLOW:-}" = "1" ]; then
  echo "⚠ 저장 검사 생략 — harness/save_guard.py 또는 python3 없음 (SAVE_ALLOW=1)"
else
  # 공개 repo — 검사 없이 저장하지 않는다. 풀어 둔 변경은 그대로 두고 멈춤 (git add 만 된 상태)
  echo "✗ 저장 중단 — 검사기(harness/save_guard.py) 또는 python3 를 찾지 못함. harness 연결 확인: bash harness/bootstrap.sh"
  echo "  의도된 경우에만 SAVE_ALLOW=1 (사용자 승인)"
  exit 1
fi

# 3. 변경 없으면 종료
if git diff --cached --quiet; then
  echo "✓ 커밋할 변경 없음 — 종료"
  exit 0
fi

# 3.5. staging hint — 인덱스 문서 갱신 누락 감지 (경고만, 차단 X)
STAGED=$(git diff --cached --name-only)
hint_missing() {
  if ! grep -q "^$1\$" <<< "$STAGED"; then
    echo "  ⚠ '$2' 변경 — '$1' 함께 갱신 권장 (이번 commit에 미포함)"
  fi
}
HAS_HINT=0
if echo "$STAGED" | grep -qE '^apps-script-v2/.+\.js$'; then
  ! grep -q "^docs/code-map.md$" <<< "$STAGED" && {
    hint_missing "docs/code-map.md" "GAS .js"
    HAS_HINT=1
  }
fi
if echo "$STAGED" | grep -qE '^apps-script-v2/Main\.js$|^apps-script-v2/Telegram\.js$'; then
  ! grep -q "^docs/architecture.md$" <<< "$STAGED" && {
    hint_missing "docs/architecture.md" "트리거·메뉴 영향 .js"
    HAS_HINT=1
  }
fi
if echo "$STAGED" | grep -qE '^web-desk/src/components/.+\.tsx$'; then
  ! grep -q "^docs/code-map.md$" <<< "$STAGED" && {
    hint_missing "docs/code-map.md" "web-desk 컴포넌트"
    HAS_HINT=1
  }
fi
if echo "$STAGED" | grep -qE '^apps-script-v2/MobileAPI\.js$'; then
  ! grep -q "^docs/api-reference.md$" <<< "$STAGED" && {
    hint_missing "docs/api-reference.md" "MobileAPI (응답 필드 영향 가능)"
    HAS_HINT=1
  }
fi
if [ "$HAS_HINT" = "1" ]; then
  echo "  (의도된 누락이면 계속 진행 OK — 매뉴얼 점검: bash scripts/check_stale.sh)"
fi

# 4. commit
if git commit -m "$MSG" -m "Co-Authored-By: Claude <noreply@anthropic.com>"; then
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
