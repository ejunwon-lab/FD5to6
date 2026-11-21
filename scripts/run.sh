#!/usr/bin/env bash
# 예비용 — 평소 `실행@` 은 전역 하네스(harness/session.sh start)가 한다. 이 스크립트는 하네스 없이 이 repo 만 맞출 때 쓴다.
# git pull + 리포트 저장소 pull + memory 복원 + pre-commit 훅 켜기 + pending 만기 확인
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

# 3. (삭제 2026-11-21) 전역 CLAUDE.md 복사 — 전역 규칙의 원본은 워크스페이스 repo 의 harness/global-CLAUDE.md 이고
#    ~/.claude/CLAUDE.md 는 그 파일의 심볼릭 링크다. 여기서 옛 사본을 복사하면 원본을 덮어쓴다.

# 3b. pre-commit 스캐너 활성화 — 금액·시크릿 커밋 차단 (scripts/git-hooks/pre-commit, 2026-07-19)
chmod +x scripts/git-hooks/* 2>/dev/null || true
git config core.hooksPath scripts/git-hooks && echo "✓ pre-commit 스캐너 활성화"

# 4. (삭제 2026-11-21) 전역 skill 복사 — 스킬도 harness/skills 가 원본(심볼릭 링크)

# 5. pending 만기 확인 (⏰YYYY-MM-DD 태그, 2026-07-20) — 확인 예정일 지난 항목 표시
bash scripts/check_pending_due.sh || true

echo "── 기계적 단계 완료 → 이제 docs/pending.md 요약 ──"
