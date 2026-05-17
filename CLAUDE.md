# FD5to6 프로젝트 가이드

## 프로젝트 개요
JUN & SOO의 주식 포트폴리오 관리 시스템.
- **Google Sheets + Apps Script**: KIS API로 주식 데이터 수집/업데이트
- **iOS 앱 (SwiftUI)**: 시트 데이터를 읽어 모바일로 포트폴리오 현황 표시

## 디렉토리 구조
```
FD5to6/
├── apps-script/       # GAS 소스 (.js 파일들)
│   ├── push_safe.py   # Secret.js 보호 GAS 배포 스크립트
│   └── *.js           # KIS_API, KIS_StockStatus, Config 등
├── ios/               # SwiftUI iOS 앱
│   └── Sources/
│       ├── App/       # MainTabView
│       ├── Features/  # Dashboard, Holdings, Analysis
│       ├── Models/    # PortfolioModels
│       └── Shared/    # Extensions, Colors
├── memory/            # Claude 메모리 파일 백업 (GitHub 동기화용)
└── docs/
```

## 새 컴퓨터 세팅
클론 후 아래 순서대로 실행:
```bash
# 1. Claude 메모리 복원
mkdir -p ~/.claude/projects/-Users-$(whoami)-Documents-Claude-2026-FD5to6/memory
cp memory/* ~/.claude/projects/-Users-$(whoami)-Documents-Claude-2026-FD5to6/memory/

# 2. 전역 Claude 설정 (저장!/실행@ 자동 적용)
mkdir -p ~/.claude
cp config/global-claude.md ~/.claude/CLAUDE.md
```

## 코드 탐색
코드 구조가 필요할 때 **파일 전체를 읽기 전에** `docs/code-map.md`를 먼저 읽는다.
함수명·위치를 파악한 뒤 해당 부분만 grep 또는 offset/limit으로 읽는다.

**버그/요청이 들어오면 — 코드 읽기 전에 먼저:**
1. `docs/errors.md` 검색 — 같은 영역이 과거에 터졌으면 원인·함수가 이미 적혀 있다
2. `docs/code-map.md`의 **증상 → 위치 인덱스** — 증상으로 파일·함수를 바로 찾는다
3. 응답 JSON 필드 문제면 `docs/api-reference.md` — 필드 → 계산 위치
→ 위 3개로 위치를 잡은 뒤, **그 함수만** 읽는다.

**code-map.md 갱신 규칙** (필수):
- 함수를 추가/삭제하거나 함수 역할·시그니처·시트 스키마가 바뀌면, **같은 작업에서** `docs/code-map.md`의 해당 항목도 갱신한다.
- code-map.md에는 **줄 번호를 적지 않는다** (가장 빨리 낡음). 함수명·역할·시트 컬럼 의미·데이터 흐름만 기록.
- 지도는 "어디 있나"를 알려줄 뿐 — 실제 수정 직전엔 해당 함수를 직접 읽어 확인한다.

## 핵심 규칙

### GAS 배포
- **절대 `clasp push` 직접 실행 금지** — Secret.js가 원격에서 삭제됨
- **반드시 `python3 apps-script-v2/push_safe.py` 사용** (활성 시스템 = v2)
- Secret.js는 로컬에 없고 원격(Google)에만 존재. 절대 건드리지 않음

### iOS 빌드
- XcodeGen 프로젝트 — VS Code SourceKit 에러는 대부분 false positive
- 실제 빌드는 Xcode에서 확인

## 세션 키워드

| 키워드 | 동작 |
|---|---|
| `새 세션 시작해` | `docs/pending.md`, `docs/features.md` 읽고 현황 한 문단 요약 |
| `중간 저장해` | 현재까지 작업 내용을 세션 문서에 저장 |
| `동기화해` | 세션 문서 작성 + memory 복사 + git add/commit/push |
| `저장!` | `중간 저장해` + `동기화해` 합쳐서 한 번에 실행 |
| `실행@` | git pull + memory 복원 (`FD5to6/memory/` → `~/.claude/.../memory/`) + `docs/pending.md` 읽고 현황 요약 |

## 저장! 절차

`저장!` 입력 시:

1. 세션 문서(`docs/sessions/YYYY-MM-DD-주제.md`) 작성/갱신, 필요 시 `pending.md`·`errors.md` 갱신
2. `bash scripts/save.sh "<커밋 메시지>"` 실행 — memory 미러 + git add/commit/push 를 한 번에 (기계적 단계는 스크립트가 보장)

## 실행@ 절차

`실행@` 입력 시:

1. `bash scripts/run.sh` 실행 — git pull + memory 복원 + 전역 CLAUDE.md 복사 를 한 번에
2. `docs/pending.md`, `docs/features.md` 읽고 현황 한 문단 요약

> 기계적 단계(파일 복사·git 명령)는 `scripts/save.sh`·`scripts/run.sh`에 박혀 있어 누락되지 않는다.
> 판단이 필요한 단계(세션 문서 작성, 현황 요약, 커밋 메시지 작성)만 Claude가 수행한다.

## 문서 관리 규칙

- **미완료 항목**은 `docs/pending.md`에만 기록. 세션 문서에서 중복 작성 안 함
- **설계 결정**은 `docs/decisions.md`에 이유와 함께 기록
- **에러 해결**은 즉시 `docs/errors.md`에 증상·원인·해결 자동 기록 (별도 지시 없어도)
- 세션 문서는 `docs/sessions/YYYY-MM-DD-주제.md` 형식. 같은 날 여러 세션이면 주제로 구분
- `docs/architecture.md`, `docs/features.md`, `docs/api-reference.md` 수정 시 `last updated` 날짜 갱신

## memory vs docs 역할 구분

- **memory** (`~/.claude/projects/.../memory/`) → Claude 행동 지침 (피드백, 작업 방식, 사용자 성향)
- **docs** (`FD5to6/docs/`) → 프로젝트 내용 (기능, 이슈, 설계 결정, API)

## 자동 메모리 저장 지시
대화 중 아래 상황이 발생하면 메모리 파일을 자동으로 저장/업데이트:
- 새로운 기능이 완성될 때
- 중요한 설계 결정이 내려질 때
- 버그 원인과 해결책을 발견했을 때
- 사용자가 작업 방식에 대한 피드백을 줄 때

메모리 위치: `~/.claude/projects/-Users-$(whoami)-Documents-Claude-2026-FD5to6/memory/`
