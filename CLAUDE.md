# FD5to6 프로젝트 가이드

## 프로젝트 개요
JUN & SOO의 주식 포트폴리오 관리 시스템.
- **Google Sheets + Apps Script**: KIS API로 주식 데이터 수집/업데이트
- **iOS 앱 (SwiftUI)**: 시트 데이터를 읽어 모바일로 포트폴리오 현황 표시

## 디렉토리 구조
```
FD5to6/
├── apps-script-v2/    # GAS (Diag·Main·Dashboard·MobileAPI·NewSystem·KIS_API·Trend·Holidays·StockMetrics)
│   └── push_safe.py   # Secret.js 보호 배포 + node --check 사전 검증
├── web/               # React PWA (TypeScript + Vite, vitest)
│   └── src/           # App·components·utils·models
├── ios2/              # SwiftUI iOS (XcodeGen, NewFD7)
│   └── Sources/       # App·Core·Models·Shared·Features
├── scripts/           # save.sh·run.sh (저장!·실행@ 자동화)
├── memory/            # Claude 메모리 백업 (GitHub 동기화용)
├── docs/              # code-map·api-reference·errors·decisions·pending·features·sessions/
└── config/            # global-claude.md
```
> 레거시 `apps-script/`·`ios/`는 2026-05-19 제거. git 히스토리에 보존.

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

**시스템 전체 그림이 필요할 때** → `docs/architecture.md` — 5 컴포넌트(GAS/Sheets/iOS/web/web-desk/Telegram), 데이터 흐름 4 경로, 자동 트리거 표, 공통 규칙, 작업 진입점 인덱스를 한 곳에 모음.

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

## 시스템 한눈에

전체 구조·상세 규칙은 `docs/architecture.md` 참조. **매 작업에 필요한 핵심만 여기에 압축** — 새 세션 시작 시 자동으로 컨텍스트에 들어감.

**5 컴포넌트**:
- `apps-script-v2/` — GAS (중앙 데이터 허브, 시트 캐시, 자동 트리거)
- `web/` — React PWA (모바일/일반)
- `web-desk/` — 데스크 (Bloomberg 스타일, `DataProvider` 단일 캐시)
- `ios2/` — SwiftUI 네이티브
- `apps-script-v2/Telegram.js` — Telegram 봇 (워치 손익 알림)

**데이터 흐름**: KIS API → GAS `updateAllNew` → Google Sheets 캐시 → 4개 클라이언트가 **시트만 읽음** (KIS 직접 호출 없음). 사용자 ⚡ 전체 업데이트 버튼 누를 때만 KIS 강제 갱신.

**자동 트리거** (등록은 시트 메뉴 🛠️ 유지보수에서 사용자가 1회 클릭):

| 트리거 | 시각 | 동작 |
|---|---|---|
| `scheduledDailyUpdate` | 매일 17:30 (장 마감 후) | `updateAllNew` |
| `scheduledHourlyUpdate` | 거래일 09:30~16:30 매시 :30 | `updateAllNew` (8회/일) |
| `tgPushPnL` | 거래일 09:00~16:00 매시 :00/:20/:40 | 가격 갱신 후 Telegram 푸시 |
| `scheduledHolidaySync` | 매년 12월 | 구글 공휴일 캘린더 동기화 |

**데스크 표시 규칙** (모든 새 컴포넌트에 자동 적용 — memory: `feedback_number_display`·`feedback_stock_name_primary`):
- 숫자: `Math.round(n).toLocaleString()` 풀. `compactKRW`·`억`·`만`·`M`·`K` 등 축약 금지
- 종목: 종목명 메인 (`text-amber font-medium`), 종목코드 보조 (`text-xxs text-ink-faint`)

**작업 진입점** (어떤 작업에 어디 보나):

| 작업 | 1차 진입 |
|---|---|
| GAS 함수 추가/수정 | `code-map.md` GAS 섹션 → 해당 .js |
| 데스크 컴포넌트 | `code-map.md` Web Desk 섹션 → `web-desk/src/components/*` |
| 새 기능 계획 | `desk-enhancement-plan.md` (Phase A/B/C) |
| 응답 JSON 필드 | `api-reference.md` |
| 시트 컬럼 의미 | `architecture.md` 시트 스키마 |
| 자동 트리거 | `architecture.md` 트리거 표 + `Main.js`/`Telegram.js` |
| 과거 버그 | `errors.md` (증상→원인→해결) |
| 설계 결정 이유 | `decisions.md` |

## 핵심 규칙

### GAS 배포
- **절대 `clasp push` 직접 실행 금지** — Secret.js가 원격에서 삭제됨
- **반드시 `python3 apps-script-v2/push_safe.py` 사용** (활성 시스템 = v2)
- Secret.js는 로컬에 없고 원격(Google)에만 존재. 절대 건드리지 않음

### iOS 빌드
- XcodeGen 프로젝트 — VS Code SourceKit 에러는 대부분 false positive
- 실제 빌드는 Xcode에서 확인

## 주장 검증 절차

코드·파일·git·외부 서비스 *상태*에 대한 사실 주장은 **같은 턴에서 검증한 출처와 함께 제시한다.** 검증 안 된 것은 "**[추측]**" 또는 "**[확인 필요]**" 명시.

### 주장 유형별 검증 명령

| 주장 유형 | 답하기 전 실행 |
|---|---|
| "X가 git history에 있다/없다" | `git log --all -S "X" --oneline` |
| "deployment에 X 코드가 있다/없다" | curl POST로 응답 검증 또는 *배포 시각 ↔ push 시각 비교* |
| "Property/env가 X 값이다" | `Logger.log`로 출력 or 대시보드 확인 |
| "함수 F가 Y에서 호출된다" | `grep -n "F(" 파일경로` |
| "사용자가 한 작업 결과" | 도구 출력 직접 확인 (대화 기억 신뢰 금지) |
| "파일 X가 존재한다/내용이 Y다" | `Read` 또는 `ls` |
| "테스트 통과한다" | 실제 실행 후 결과 표시 |

### 위반 사례 (실제로 발생한 케이스 — 같은 실수 반복 금지)

- "git history에 chat_id 남음" → `git log -S` 1초면 확인 가능했는데 안 함
- "deployment에 새 코드 박혔다" → 배포 시각 ↔ push 시각 비교 안 함
- "GAS deploy 안 해도 됨" → 변경 함수가 deployment 경로인지 확인 안 함
- "Version 6 already deployed" → 그 Version 6이 *언제* 만들어진 건지 확인 안 함

### 작동 원칙

검증 가능한데 안 하고 추측 → 자동 위반. 사용자가 행동(배포·실행·재시도)을 해야 할 때는 **추측 단계와 검증된 단계 분리해 표시**.

증거를 같은 turn에 보이면 사용자가 즉시 검증·반박 가능 — 추측이 숨을 곳이 없어진다.

## 변경 전 설계 절차 (이 repo의 위험 변경 트리거)

원칙·4항목 체크리스트·출력 형식은 **전역 CLAUDE.md "변경 전 설계 절차" + `/design-check` skill** 참조. 여기서는 이 프로젝트에서 **코딩 전 `/design-check`가 필수인 구체 경로**만 매핑한다.

| 전역 트리거 | 이 repo 해당 |
|---|---|
| 배포 서버코드 | `apps-script-v2/*.js`의 doPost/doGet·트리거 함수(`scheduled*`·`tgPushPnL`·`_tgHandle*Post` 등) |
| CI/스케줄 파이프라인 | `.github/workflows/*` (`market-report.yml`·`telegram-push.yml`) |
| 권한·인증 | `appsscript.json`(oauthScopes·webapp.access), GAS Properties 시크릿 |
| 외부 API | KIS·Naver·Yahoo·Telegram·CalendarApp 호출 추가/변경 |

- 과거 에러 검색 대상: `docs/errors.md` (텔레그램만 5건 — 4건은 코딩 전 추론·문서로 알 수 있었음, errors.md 2026-06-09)
- 설계 노트 산출물: `docs/plans/YYYY-MM-DD-주제.md`
- **2단계 전략**: 현재 규칙 + skill(자율 적용). 다음 위험 변경에서 효과(코딩 전 에러 차단)를 증명한 뒤, PreToolUse hook으로 위험 경로 Edit 시 강제 게이트 추가.

## 변경 검증 절차

코드를 고친 뒤 "X 고침"으로 끝내지 **않는다.** 변경 보고는 반드시 아래 **"## 검증"** 섹션을 포함한다 (누락 = 미완료).

### 변경 분류 → 검증 방법

| 분류 | 예 | 자동 검증 (Claude) | 사용자 확인 |
|---|---|---|---|
| **W-1** 웹 순수 함수 | `web/src/utils/*.ts` | `npm test` + 새 케이스 추가 · `tsc --noEmit` | 불필요 |
| **W-2** 웹 컴포넌트 | `web/src/components/*.tsx` | `tsc --noEmit` · CI build | 브라우저 새로고침 → 어떤 요소 |
| **G-1** GAS 순수 로직 | `_normCode`·`pnlAt`·날짜 함수 | push_safe `node --check` + **walk-through 1건+** | 🔍 진단의 ___ 필드 |
| **G-2** GAS 시트 I/O | `updatePositionFromLedger` 등 | 위 + 시트 스키마 walk-through | 시트의 어느 셀·행 |
| **G-3** GAS 외부 API | KIS·CalendarApp 호출 | 위 + 응답 처리 walk-through | 🔍 진단 (필드 명시) |
| **I-1** iOS Swift | `ios2/Sources/**/*.swift` | (SourceKit false-positive 다수) | Xcode 빌드 + 화면 |
| **C-1** 스크립트·문서·설정 | `.py`·`.md`·`.yml`·`.gitignore` | 해당 시 syntax 검사 | 보통 불필요 |

### Walk-through 규칙 (G-1·G-2·G-3 필수)

순수 GAS 로직 변경 시 **구체 입력 1건 이상**을 코드 흐름대로 추적해 보고에 명시. "잘 됩니다" 같은 추상 표현 금지.

- **나쁨**: "syncHolidays가 기념일을 거릅니다."
- **좋음**: "2026-05-15 '스승의 날' → `HOLIDAY_NAMES.some(n => '스승의 날'.indexOf(n) !== -1)` → 매칭 없음 → 드롭 → *휴장일* 미기록 ✓"

walk-through 자체가 "내가 정말 그 로직을 이해했나"의 시험. 과거 사고들(스승의날·다계좌 손익 등)은 정확히 이걸 건너뛴 결과.

### 사용자 확인 안내 — "어디·무엇·어떻게·예상값"

- **금지**: "확인해 주세요" · "잘 되는지 보세요"
- **필수 4요소**:
  - **어디** (시트명·메뉴 경로·앱 화면)
  - **무엇** (구체 셀·필드·요소)
  - **어떻게** (클릭·새로고침·빌드)
  - **예상값** (정확한 값/범위)

예: "**📊 뉴시스템 → 📋 보유현황 재계산** 클릭 → *보유현황* 시트 **J2 셀(현재단가)** 이 0이 아닌 값" / "**🛠️ 유지보수 → 🔍 진단** → `priceAsOfDate`가 2026-05-15, `metricFill.1주손익` ≥ 20/23"

### 보고 형식

```
## 검증

### 자동 통과 ✓
- <도구>: <결과>
- walk-through: <입력> → <예상>

### 🔴 사용자 확인 필요 (해당 시)
- <어디>에서 <무엇>을 <어떻게> → 예상: <값>
```

"사용자 확인 필요" 항목은 굵게·🔴 등으로 도드라지게. **확인 응답 전에도 다음 작업으로 진행 가능 (완화 정책)** — 다만 미해결 항목은 가시화 유지.

### 자동 검증 실패 시

배포·커밋 **하지 않는다.** 어디서 깨졌는지 보고. 사용자 검증 실패 보고를 받으면 즉시 재진단 (walk-through부터 다시).

## 세션 키워드

| 키워드 | 동작 |
|---|---|
| `새 세션 시작해` | `docs/pending.md`, `docs/features.md` 읽고 현황 한 문단 요약 |
| `중간 저장해` | 현재까지 작업 내용을 세션 문서에 저장 |
| `동기화해` | 세션 문서 작성 + memory 복사 + git add/commit/push |
| `저장!` | `중간 저장해` + `동기화해` 합쳐서 한 번에 실행 |
| `실행@` | git pull + memory 복원 (`FD5to6/memory/` → `~/.claude/.../memory/`) + `docs/pending.md` 읽고 현황 요약 |
| `매매기록!` / `매매기록하자!` | 증권사 체결 카톡 붙여넣기 → 매수/매도 원장 자동 기록 프로세스 실행. 절차·주의점은 memory [[feedback_trade_record_command]] + `docs/plans/2026-06-11-카톡매매-원장자동기록.md` |

## 매매기록! (카톡 체결 → 원장 자동 기록)

`매매기록!`/`매매기록하자!` 입력 + 증권사 체결 카톡이 오면:

1. **파싱** — 종목명·구분(매수/매도)·수량·단가·마스킹계좌 추출. **같은 종목 여러 차수(1차·2차…)는 수량 합산해 1행**.
2. **계좌·수수료 룩업** — 마스킹계좌 → memory `reference_kakao_account_map.md`. 신규 마스킹계좌면 사용자에게 실계좌·수수료 규칙 묻고 표에 누적.
3. **코드·현재수량 조회** — 카톡엔 종목코드 없음. `python3 scripts/backup_sheets.py`로 시트 덤프 → `backups/<최신>/_보유현황_.csv`에서 종목명·증권사·계좌로 코드·보유수량 grep.
4. **판정** — 매도: 보유수량=매도수량이면 전량, 미만이면 일부. 매수: 분류 미상이면 사용자에게 질문.
5. **확정 표 제시 → 사용자 확인** (confirm-then-write. 금액=수량×단가 검산, 수수료 추정, 실현손익 미리보기).
6. **POST** — `python3 scripts/post_trade.py '<trade JSON>'` 건별 순차(각 건이 `updatePositionFromLedger` 연쇄 → lock 충돌 방지). 응답 `beforeQty→afterQty`·`posFound` 확인.
7. **검증** — `backup_sheets.py` 재덤프 → `_실현손익_`·`_보유현황_` 확인. GAS 계산 실현손익 보고.
8. **신규 계좌면 memory 누적** + 완료 후 `저장!` 안내.

## 인덱스 정합 검증 (stale 방지)

- `bash scripts/check_stale.sh` — 인덱스 vs 코드 전수 정합 검사. 작업 마무리·`저장!` 직전에 실행. GAS public 함수·web-desk 컴포넌트가 `code-map.md`에 등재됐는지 + `last updated` 30일+ 경과 검사.
- `scripts/save.sh`는 commit 직전 변경 파일 패턴 보고 누락 인덱스 자동 hint (차단 X, 경고만). Claude는 hint 보고 같은 turn에 추가 갱신할지 판단.
- 두 도구 false positive 가능 (alias 등 등재 불필요한 경우). 의도된 누락이면 무시.

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
