# 전역 Claude 설정

## Claude 프로젝트 자동 감지

현재 작업 디렉토리 경로에 `Claude`와 연도(예: `2026`)가 포함되어 있으면 아래 키워드와 절차가 자동 적용된다.

해당 경로 패턴: `/Documents/Claude XXXX_mini/PROJECTNAME/`

---

## 세션 키워드 (자동 적용)

| 키워드 | 동작 |
|---|---|
| `실행@` | git pull + memory 복원 + `docs/pending.md` 읽고 현황 요약 |
| `저장!` | 현재 작업 내용 docs 업데이트 + memory 백업 + git add/commit/push |
| `중간 저장해` | 현재 작업 내용을 `docs/pending.md`에 업데이트 |
| `동기화해` | memory 백업 + git add/commit/push |

---

## 실행@ 절차

1. `git pull`
2. memory 복원 (경로는 현재 프로젝트 기준으로 자동 계산):
   ```bash
   PROJECT_DIR=$(pwd)
   PROJECT_SLUG=$(echo "$PROJECT_DIR" | sed 's|/|-|g' | sed 's|^-||')
   cp "$PROJECT_DIR/memory/"* ~/.claude/projects/$PROJECT_SLUG/memory/ 2>/dev/null || true
   ```
3. `docs/pending.md` 읽고 현황 한 문단 요약

---

## 저장! 절차

1. 현재 작업 내용을 `docs/pending.md`에 업데이트
2. memory 백업:
   ```bash
   PROJECT_DIR=$(pwd)
   PROJECT_SLUG=$(echo "$PROJECT_DIR" | sed 's|/|-|g' | sed 's|^-||')
   cp ~/.claude/projects/$PROJECT_SLUG/memory/* "$PROJECT_DIR/memory/" 2>/dev/null || true
   ```
3. `git add . && git commit -m "저장" && git push`
