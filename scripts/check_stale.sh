#!/usr/bin/env bash
# 인덱스 문서가 코드와 어긋났는지(stale) 정합 검사. 작업 마무리 시점에 수동 실행.
#
# 검사 항목 (false positive 최소화 — "코드에 있는데 인덱스에 없는" 케이스만):
#   1) apps-script-v2의 public function 선언 → code-map.md에 등재됐나
#   2) web-desk/src/components의 *.tsx 파일 → code-map.md에 등재됐나
#   3) architecture.md·features.md·api-reference.md의 last updated 날짜가 너무 오래?
#
# exit code: 0 = OK, 1 = stale 의심 있음
set -uo pipefail

cd "$(dirname "$0")/.." || exit 1

ISSUES=0
warn() { echo "⚠ $*"; ISSUES=$((ISSUES+1)); }
info() { echo "  $*"; }
title(){ echo ""; echo "─ $* ─"; }

CODEMAP="docs/code-map.md"
ARCH="docs/architecture.md"
FEAT="docs/features.md"
APIREF="docs/api-reference.md"

# ───────────────────────────────────────────────────────────────
title "1) GAS public function → code-map 등재 여부"
GAS_DECLARED=$(grep -rohE "^function [a-zA-Z_][a-zA-Z0-9_]*" apps-script-v2 2>/dev/null \
  | awk '{print $2}' | sort -u)
NOT_IN_MAP=""
while IFS= read -r fn; do
  [ -z "$fn" ] && continue
  # private 헬퍼(_시작) 제외
  case "$fn" in _*) continue;; esac
  # code-map.md 어느 곳이든 단어로 언급됐나
  if ! grep -qw "$fn" "$CODEMAP" 2>/dev/null; then
    NOT_IN_MAP="$NOT_IN_MAP$fn"$'\n'
  fi
done <<< "$GAS_DECLARED"
if [ -n "$NOT_IN_MAP" ]; then
  warn "GAS에 정의됐으나 code-map에 미등재 public 함수:"
  printf '%s' "$NOT_IN_MAP" | sed 's/^/    /'
else
  info "OK (private _ 헬퍼 제외)"
fi

# ───────────────────────────────────────────────────────────────
title "2) web-desk 컴포넌트 → code-map 등재 여부"
NOT_IN_MAP_DESK=""
while IFS= read -r path; do
  c=$(basename "$path" .tsx)
  if ! grep -qw "$c" "$CODEMAP" 2>/dev/null; then
    NOT_IN_MAP_DESK="$NOT_IN_MAP_DESK$c"$'\n'
  fi
done < <(find web-desk/src/components -name "*.tsx" -type f 2>/dev/null)
if [ -n "$NOT_IN_MAP_DESK" ]; then
  warn "web-desk에 존재하나 code-map에 미등재 컴포넌트:"
  printf '%s' "$NOT_IN_MAP_DESK" | sed 's/^/    /'
else
  info "OK"
fi

# ───────────────────────────────────────────────────────────────
title "3) 인덱스 문서 last updated 신선도"
TODAY_EPOCH=$(date +%s)
for doc in "$ARCH" "$FEAT" "$APIREF"; do
  [ -f "$doc" ] || continue
  LU=$(grep -E "^last updated:" "$doc" | head -1 \
    | sed -E 's/^last updated:[[:space:]]+//' | tr -d ' ')
  if [ -z "$LU" ]; then
    warn "$doc: 'last updated' 행 없음"
    continue
  fi
  # macOS/Linux date 양쪽 시도
  LU_EPOCH=$(date -j -f "%Y-%m-%d" "$LU" "+%s" 2>/dev/null \
    || date -d "$LU" "+%s" 2>/dev/null || echo "")
  if [ -z "$LU_EPOCH" ]; then
    warn "$doc: 날짜 파싱 실패 ($LU)"
    continue
  fi
  AGE_DAYS=$(( (TODAY_EPOCH - LU_EPOCH) / 86400 ))
  if [ "$AGE_DAYS" -gt 30 ]; then
    warn "$doc: ${AGE_DAYS}일 경과 ($LU) — 점검 권장"
  else
    info "$doc: ${AGE_DAYS}일 전 ($LU)"
  fi
done

# ───────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════"
if [ "$ISSUES" -eq 0 ]; then
  echo "✓ 인덱스 정합 — stale 의심 없음"
  exit 0
else
  echo "⚠ stale 의심 ${ISSUES}건 — 인덱스 문서 점검 권장"
  echo "  (false positive 가능 — 등재 가치 없는 함수면 무시)"
  exit 1
fi
