#!/usr/bin/env bash
# 실행@ 의 기계적 단계 — git pull + memory 복원 + 전역 CLAUDE.md
# 사용:  bash scripts/run.sh
# (docs/pending.md 요약은 Claude가 이 스크립트 실행 후 수행한다)
set -uo pipefail

cd "$(dirname "$0")/.." || exit 1
ROOT="$(pwd)"

# 0. 히스토리 재작성(2026-07-04) 자기복구 — 로컬과 원격이 갈라졌으면
#    기존 HEAD를 백업 브랜치로 보존한 뒤 원격 기준으로 재정렬 (폴더 삭제 불필요)
git fetch origin -q || true
if git rev-parse origin/main >/dev/null 2>&1 \
   && ! git merge-base --is-ancestor HEAD origin/main 2>/dev/null \
   && ! git merge-base --is-ancestor origin/main HEAD 2>/dev/null; then
  BK="backup-pre-rewrite-$(date +%Y%m%d%H%M)"
  git branch "$BK" 2>/dev/null || true
  if git checkout -q -B main origin/main; then
    echo "✓ 재작성된 히스토리로 자동 재정렬 완료 (이전 상태는 브랜치 $BK 에 보존)"
  else
    echo "✗ 자동 재정렬 실패 (미커밋 변경 충돌?) — 'git status' 확인 후 수동 정리 필요"
    exit 1
  fi
fi

# 1. git pull
echo "── git pull ──"
if ! git pull; then
  echo "✗ git pull 실패 (충돌·네트워크?) — 수동 확인 필요"
  exit 1
fi

# 1b. 리포트 private repo 동기화 (docs/reports = FD5to6-reports clone, 2026-07-04 분리)
if [ -d docs/reports/.git ]; then
  git -C docs/reports pull -q --rebase || echo "⚠ docs/reports pull 실패 (무시 — 리포트 열람만 영향)"
elif [ ! -d docs/reports ]; then
  git clone -q https://github.com/ejunwon-lab/FD5to6-reports.git docs/reports \
    || echo "⚠ FD5to6-reports clone 실패 (private — gh auth 필요)"
fi

# 2. memory 복원: repo memory/ → ~/.claude 라이브 디렉토리
MEM_DST="$HOME/.claude/projects/$(printf '%s' "$ROOT" | sed 's/[^a-zA-Z0-9]/-/g')/memory"
mkdir -p "$MEM_DST"
cp memory/*.md "$MEM_DST"/ 2>/dev/null && echo "✓ memory 복원 완료" || echo "⚠ memory 파일 없음 — 건너뜀"

# 3. 전역 CLAUDE.md 동기화 (repo config = 단일 원본 SSOT, 항상 갱신)
GLOBAL_DST="$HOME/.claude/CLAUDE.md"
mkdir -p "$HOME/.claude"
if [ -f config/global-claude.md ]; then
  # 첫 동기화에서 머신 고유 내용 손실 방지: .bak이 없고 기존과 다르면 1회 백업
  if [ -f "$GLOBAL_DST" ] && [ ! -f "$GLOBAL_DST.bak" ] \
     && ! diff -q config/global-claude.md "$GLOBAL_DST" >/dev/null 2>&1; then
    cp "$GLOBAL_DST" "$GLOBAL_DST.bak"
    echo "✓ 기존 전역 CLAUDE.md → CLAUDE.md.bak 백업 (1회, 손실 방지)"
  fi
  cp config/global-claude.md "$GLOBAL_DST" && echo "✓ 전역 CLAUDE.md 동기화"
else
  echo "⚠ config/global-claude.md 없음"
fi

# 4. 전역 skill 동기화 (config/skills/* → ~/.claude/skills/)
if [ -d config/skills ]; then
  mkdir -p "$HOME/.claude/skills"
  cp -R config/skills/. "$HOME/.claude/skills/" 2>/dev/null \
    && echo "✓ 전역 skill 동기화" || echo "⚠ 전역 skill 복사 실패"
fi

echo "── 기계적 단계 완료 → 이제 docs/pending.md 요약 ──"
