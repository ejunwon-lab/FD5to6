# 시스템 아키텍처 — FD5to6

last updated: 2026-05-28

JUN & SOO 주식 포트폴리오 시스템의 전체 그림.
**작업 시작 전 이 문서를 먼저 본다** — 코드 위치는 `code-map.md`, 기능 체크리스트는 `features.md`, API 응답 필드는 `api-reference.md`, 설계 결정 이유는 `decisions.md`.

---

## 한 줄 요약

KIS API → **Google Apps Script v2 + Google Sheets**(중앙 데이터 허브, 자동 캐싱) → **4개 클라이언트** (iOS / 웹앱 / 데스크 / Telegram 봇) — 모두 같은 GAS endpoint를 읽기만 함.

---

## 시스템 개요

```
                       ┌─────────────────────────────────────────────────┐
                       │              Google Sheets (단일 진실)            │
                       │   거래_원장 · 보유현황 · 종목지표 · 현재가_이력    │
                       │   장기_가격_이력 · 추이 기록 · 실현손익 · 설정     │
                       │   참고지표 · 휴장일                              │
                       └────────▲──────────────────────▲─────────────────┘
                                │                       │
                  자동·수동 갱신 │           읽기 (캐시 기반) │
                                │                       │
    ┌──────────────┐    ┌──────┴─────────────────┐     │
    │   KIS API    │───▶│   apps-script-v2/      │     │
    │ (국내·해외     │    │   (Google Apps Script) │     │
    │  주식·지수     │    │                         │     │
    │  ·선물)       │    │  • mobile* / newMobile*│     │
    └──────────────┘    │  • updateAllNew·트리거 │     │
                        │  • Telegram webhook    │     │
    ┌──────────────┐    │  • _mIsTradingDay·휴장일│    │
    │ Yahoo Finance│───▶│                         │     │
    │ (선물·DXY)   │    └────────┬───────────────┘     │
    └──────────────┘             │                      │
                                 │ scripts.run / webhook│
    ┌──────────────┐             │                      │
    │GOOGLEFINANCE │─시트수식───▶│                      │
    │ (VIX·TNX·금) │             │                      │
    └──────────────┘             ▼                      │
                       ┌──────────────────┐             │
                       │   클라이언트 4종   │─────────────┘
                       │                  │
                       │ ① iOS (ios2/)    │  ─ Google OAuth + ScriptAPIService
                       │ ② 웹앱 (web/)    │  ─ Google OAuth (GIS), PWA
                       │ ③ 데스크         │  ─ DataProvider Context, 시간당 자동
                       │   (web-desk/)    │     백그라운드 재페치
                       │ ④ Telegram 봇    │  ─ 워치 양방향 (메시지 ↔ 손익 회신)
                       │                  │     + 자동 푸시 (장중)
                       └──────────────────┘
```

---

## 컴포넌트 5개 — 한 줄씩

| # | 컴포넌트 | 역할 | 위치 |
|---|---|---|---|
| 1 | **Apps Script v2** | 중앙 데이터 허브. KIS·Yahoo·GoogleFinance 통합, 시트 갱신, 모든 클라이언트 API 제공, 자동 트리거 | `apps-script-v2/` |
| 2 | **Google Sheets** | 단일 진실 (캐시). 거래·보유·지표·추이를 시트 단위로 보관 | (Google) |
| 3 | **iOS 앱** | 네이티브 SwiftUI, 4탭. 백그라운드 세션 + 캐시 | `ios2/` |
| 4 | **웹앱 (모바일·일반)** | React PWA, 홈화면 설치 가능 | `web/` |
| 5 | **데스크 (Bloomberg 스타일)** | React + Tailwind, 정보 밀도 데스크. DataProvider 단일 캐시 + 시간당 자동 갱신 | `web-desk/` |
| 6 | **Telegram 봇** | 애플워치 손익 알림. GAS Web App webhook 우회 (시크릿 0 클라이언트) | `apps-script-v2/Telegram.js` |

> 1·2·6은 GAS 안에 있고, 3·4·5가 클라이언트.

---

## 데이터 흐름 (4가지 경로)

### A. 일상 — 사용자가 가격을 갱신하고 본다

```
사용자(시트 메뉴 또는 클라이언트 ⚡ 전체 업데이트)
  → updateAllNew()
    → updateFxRates           — 환율 (설정 시트)
    → updateNewPriceHistory   — KIS로 현재가 fetch → 현재가_이력 (Wide, 거래일만)
    → updatePositionFromLedger — 거래_원장 → 보유현황 재계산
       └ computeStockMetrics  — 종목지표 시트 갱신 (당일/1주/1달/1M/3M/6M/1Y/52주)
    → logToTrendSheet         — 추이 기록 1행 누적
    → buildDashboard          — 대시보드 시트 렌더
```

### B. 자동 트리거 (사용자 개입 X)

```
A. scheduledDailyUpdate          — 매일 17:30 (장 마감 후 정리)
B. scheduledHourlyUpdate         — 거래일 09:30~16:30 매시 :30 (±5분, 8회/일)
                                    → updateAllNew (위 A 흐름)
                                    → LockService로 충돌 시 skip
C. tgPushPnL                     — 거래일 09:00~16:00 매시 :00/:20/:40
                                    → updateNewPriceHistory + updatePositionFromLedger
                                    → Telegram 워치 푸시 (자동 손익 알림)
D. scheduledHolidaySync          — 매년 12월 휴장일 동기화 (구글 공휴일 캘린더)
E. tgFlushReportQueue            — 매일 08:05·17:05 KST (시장 리포트 큐)
                                    → claude.ai routine이 *시장리포트_큐* 시트에 적재한 "대기" 행
                                    → Telegram 발송 → "발송완료" 마킹
```

### C. 클라이언트가 시트 캐시를 읽기 (자동 갱신 X, 시트만 읽음)

```
iOS / web / web-desk
  → gasApi.getPortfolio        → newMobileGetPortfolio       → 보유현황·종목지표 읽기
  → gasApi.getIndicators       → newMobileGetIndicators      → 참고지표 읽기
  → gasApi.getProfitHistory    → newMobileGetProfitHistory   → 추이 기록 읽기
  → gasApi.getMonthlyRealized  → newMobileGetMonthlyRealized → 실현손익 읽기
  → gasApi.getStockDetail      → newMobileGetStockDetail     → 단일 종목 상세
  ⚠️ KIS 직접 호출 없음. 시트값만 반환 → 빠름 (1~3초)
```

### D. Telegram 양방향

```
사용자 메시지 (워치/모바일) ─▶ Telegram 서버 ─▶ Cloudflare Worker proxy
                                                          ↓
                                          GAS Web App doPost (webhook)
                                                          ↓
                                          handleTelegramWebhook (시크릿 검증 + chat_id 화이트리스트)
                                                          ↓
                          "갱신" 메시지 → updateNewPriceHistory + updatePositionFromLedger
                                                          ↓
                                          tgSendMessage(_tgFormatPnL()) → 워치 답글
```

---

## GAS 주요 파일 (apps-script-v2/)

| 파일 | 역할 |
|---|---|
| `Main.js` | onOpen 메뉴(📊 뉴시스템 / 🛠️ 유지보수) · updateAllNew · 트리거 setup/delete (`scheduledDailyUpdate` / `scheduledHourlyUpdate`) · doPost(`action=addMarketReport`면 시장 리포트 큐, 아니면 Telegram webhook) |
| `MobileAPI.js` | 모든 클라이언트 API: `newMobileGetPortfolio`·`Indicators`·`ProfitHistory`·`StockDetail`·`MonthlyRealized`·`UpdateAll`. `_mIsTradingDay`·`_isTradingDateStr`·`_mFindPrevDayProfitChange` 헬퍼 |
| `NewSystem.js` | `updatePositionFromLedger`(거래원장→보유현황), `updateFxRates`(환율), `updateNewPriceHistory`(KIS 가격→현재가_이력), `addTransactionFromForm` |
| `StockMetrics.js` | `computeStockMetrics` — 보유현황+현재가_이력+거래원장으로 종목지표 시트 한 번에 계산 (당일/1주/1달/1M/3M/6M/1Y/52주). 모든 갱신 경로가 끝에 통과 |
| `Dashboard.js` | `buildDashboard`·`_handleDashSortChange` — *대시보드* 시트 렌더 + 정렬 드롭다운 |
| `KIS_API.js` | KIS 토큰·국내/해외 주식·국내/해외 지수·국내선물 |
| `Trend.js` | `logToTrendSheet`·`recordTrend` — 추이 기록 누적 |
| `Holidays.js` | `syncHolidays`·`_isKoreanHoliday`·`HOLIDAY_NAMES` 화이트리스트 (스승의날 등 기념일 제외) |
| `Telegram.js` | 워치 봇 전체 — webhook 핸들러·자동 푸시 `tgPushPnL`·트리거 등록 `tgSetupPushTrigger` · **시장 리포트 큐** (`_tgHandleMarketReportPost`·`tgFlushReportQueue`·`tgSetupReportQueueTrigger`) |
| `Diag.js` | `runDiag` — 진단 함수 (보유현황·종목지표·추이 등 점검) |
| `Secret.js` | ⚠️ 로컬에 없음. 원격(Google)에만 존재. **절대 push 금지** |
| `push_safe.py` | Secret.js 보호 배포 — node --check 사전 검증 + clasp push |

> 배포: **반드시 `python3 apps-script-v2/push_safe.py`** (clasp push 직접 금지)

---

## Google Sheets 스키마 (요약)

| 시트 | 컬럼 의미 | 사용처 |
|---|---|---|
| **거래_원장** | A:날짜 B:매수/매도 C:종목코드 D:종목명 E:카테고리 F:증권사 G:계좌 H:수량 I:단가 | `updatePositionFromLedger` 입력 |
| **보유현황** | A:코드 B:종목명 C:카테고리 D:증권사 E:계좌 F:비중 G:수량 H:평단 I:매입금액 J:현재단가 K:평가금액 L:손익 M:수익률 | 모든 클라이언트의 holdings 소스 |
| **종목지표** | code+broker+account 키. 당일등락·1주PnL·1달PnL·1M%·3M%·6M%·1Y%·52주H·52주L | `_readStockMetrics`(MobileAPI) |
| **현재가_이력** | A:날짜 + 종목 Wide. 거래일만 누적 | KIS 가격 캐시. 1M/3M/6M/1Y 계산 |
| **장기_가격_이력** | KIS 주봉/일봉 백필 (52주·장기 수익률) | StockMetrics |
| **추이 기록** | 날짜별 합계 자산·운용·확정 누적. AD2=합계최신, U열=어제거래일 행 | 합계수익·전일변동 |
| **실현손익** | 종목·증권사·계좌별 매도 손익 | `confirmedProfit` 합산 |
| **설정** | B2=USD/KRW · B3=GBP/KRW · A7:E12 대기자금(A:증권사 B:구분 C:대기자금 D:비고 E:업데이트 날짜 자동 스탬프) | `updateFxRates` · `_mGetCashReserve` · onEdit `_handleCashReserveTimestamp` |
| **참고지표** | KOSPI·KOSDAQ·SPX·NDX·DJI·SOX·ES·NQ·GC·CL·VIX·TNX·DXY·NVDA·AAPL·MSFT·HSI 등 | `newMobileGetIndicators` |
| **휴장일** | 증시 휴장일 (스승의날 등 제외, 14종 화이트리스트) | `_isKoreanHoliday`·`_isTradingDateStr` |
| **대시보드** | GAS가 시트에 렌더한 가시화 (사용자가 시트에서 봄) | buildDashboard |
| **종목상태_이력** | 자동 누적 (참조용) | 분석 |

`NS.KIS_SKIP = ['펀드','예금','보험','기타']` — KIS 호출에서 제외, holdings 응답에도 제외. 단 *데스크*는 `_mGetNonStockAssets`로 별도 노출(Account P&L 패널 "비주식 자산" 그룹).

---

## 자동 트리거 종합

| 트리거 | 시각 | 조건 | 동작 | 충돌 방지 |
|---|---|---|---|---|
| `scheduledDailyUpdate` | 매일 17:30 (±15분) | — | `updateAllNew` | 없음 (장 마감 후) |
| `scheduledHourlyUpdate` | 매 30분 (everyMinutes) | **거래일 + 09:25~16:35 + minute 25~35** | `updateAllNew` | LockService.tryLock(2000) |
| `tgPushPnL` | 매시 :00/:20/:40 (3개 트리거) | **거래일 + 09:00~16:00** | 가격+보유현황 갱신 후 Telegram 푸시 | LockService.tryLock(1000) |
| `scheduledHolidaySync` | 매년 12월 | — | 구글 공휴일 캘린더 → 휴장일 시트 | 없음 |
| `tgFlushReportQueue` | 매일 08:05·17:05 KST (2개 트리거) | — (큐 비어 있으면 즉시 종료) | *시장리포트_큐* 시트의 "대기" 행 → Telegram 발송 → 마킹 | 없음 (큐가 직렬화) |

> 트리거 등록은 시트 메뉴(🛠️ 유지보수)에서 사용자가 1회 클릭. 등록은 `setup*Trigger` 함수, 해제는 `delete*Trigger`.

---

## 클라이언트별 기능 요약

### ① iOS (`ios2/`, SwiftUI, XcodeGen)

- **인증**: GoogleSignIn (`AuthManager`)
- **데이터**: `ScriptAPIService` → `newMobileGet*` (백그라운드 세션 + `CacheService`)
- **4탭** (PageTabViewStyle, NavigationStack 없음): Indicators / Dashboard / Holdings / Analysis
- **공유 상태**: `PortfolioViewModel.shared` (@EnvironmentObject)
- **빌드**: Xcode (VS Code SourceKit 에러는 false positive)

### ② 웹앱 (`web/`, React + Vite + PWA)

- **인증**: GIS (Google Identity Service)
- **데이터**: `api/gasApi.ts` → `lib/useRealized`·`usePortfolio` (각 페이지마다 자체 fetch)
- **페이지**: Dashboard / Holdings / Analysis / Indicators / Activity
- **배포**: GitHub Actions → https://ejunwon-lab.github.io/FD5to6/
- **PWA**: 홈화면 설치 가능
- ⚠️ **표시 규칙(숫자 풀·종목명 메인)은 아직 미적용** — pending

### ③ 데스크 (`web-desk/`, React + Tailwind, Bloomberg 스타일)

- **인증**: GIS (동일)
- **데이터 단일 소스**: `lib/DataProvider.tsx` Context — 모든 페이지가 1 instance 공유 (페이지 전환 시 fetch 0건)
- **첫 진입**: portfolio + indicators + profitHistory Promise.all → **monthlyRealized 백그라운드 prefetch**
- **시간당 자동 백그라운드 재페치** (GAS 자동 갱신과 매칭)
- **5 메뉴**: Dashboard / Holdings / Analysis / Indicators / Activity
- **표시 규칙** (영구):
  - 모든 숫자 `toLocaleString()` 풀 (`compactKRW`·억/만 금지)
  - 종목명 메인(amber) + 종목코드 보조(faint)
- **주요 패널** (Phase A 완료):
  - Holdings: Account P&L (계좌×원금/수익금/평가) + 3-view 토글(Web/Terminal/List) + 상세 모달
  - Indicators: Top Gainers/Losers + Market Heatmap + 카테고리별 패널
  - Analysis: Risk-Return KPI + Allocation 도넛 + Concentration + **Profit Contribution** (±막대, ₩/% 토글) + Winners/Losers
  - Ticker: live indicators + holdings movers (종목명 메인)
- **배포**: GitHub Actions (`.github/workflows/deploy-desk.yml`) → https://ejunwon-lab.github.io/FD5to6/desk/

### ④ Telegram 봇 (`apps-script-v2/Telegram.js`)

- **구조**: 워치 → Telegram 서버 → Cloudflare Worker proxy → GAS Web App webhook
- **보안**:
  - 시크릿은 GAS PropertiesService에만, 클라이언트 0개
  - webhook URL은 `?secret=XXX` 검증 + chat_id 화이트리스트
  - `update_id` 중복 제거 + `LockService` 동시 처리 차단
- **양방향**: 워치 "갱신" 메시지 → 가격+보유현황 갱신 → 손익 회신
- **자동 푸시**: 거래일 09:00~16:00, 매시 :00/:20/:40 근처 (3개 트리거)
- **메시지 포맷**: `_tgFormatPnL()` — 합계수익·오늘수익·확정·운용 한 메시지로

---

## 캐시·갱신 정책 (시간 단위)

```
[GAS]                              [데스크 (사용자가 데스크 열어둔 상태)]
─────────────────────────────      ──────────────────────────────────
09:30 (±5분)  updateAllNew   ───▶  시간당 자동 백그라운드 재페치
10:30                              가 새 값을 받아 화면 자동 갱신
11:30                              (사용자 행동 불필요)
12:30
13:30
14:30
15:30
16:30
17:30      scheduledDaily          (장 마감 후 정리, 데스크는 이미 받음)
```

**클라이언트는 시트 캐시만 읽음 → KIS 직접 호출 없음 → 응답 1~3초**.
사용자가 ⚡ 전체 업데이트 버튼 누를 때만 KIS 강제 갱신 (`newMobileUpdateAll`).

---

## 공통 규칙 (코드 변경 시 반드시 지킨다)

1. **GAS 배포**: `python3 apps-script-v2/push_safe.py`만 사용. `clasp push` 직접 금지. Secret.js는 로컬·repo에 없고 원격에만 존재 → 절대 손대지 않음.
2. **숫자 표시**: 모든 UI에서 풀 `toLocaleString()` (memory: `feedback_number_display`)
3. **종목 표시**: 종목명 메인(amber·font-medium), 종목코드 보조(faint·text-xxs) (memory: `feedback_stock_name_primary`)
4. **변경 검증**: 코드 수정 후 반드시 "## 검증" 섹션 (자동 통과 + 사용자 확인 4요소) — CLAUDE.md 참조
5. **주장 검증**: git history·deployment·시트 상태에 대한 주장은 같은 턴에서 검증 명령 실행 (`git log -S`, `Read`, `curl POST` 등)
6. **iOS XcodeGen**: VS Code SourceKit 에러는 대부분 false positive. 실제 빌드는 Xcode에서.

---

## 작업 진입점 (어떤 작업을 할 때 어디부터 보나)

| 작업 유형 | 1차 진입 | 2차 진입 |
|---|---|---|
| GAS 함수 추가/수정 | `code-map.md` GAS 섹션 | 해당 .js 파일 직접 |
| 응답 JSON 필드 추가 | `api-reference.md` | 해당 `newMobileGet*` 함수 |
| 시트 컬럼 변경 | `architecture.md` 시트 스키마 | `code-map.md` GAS 시트 스키마 |
| 트리거 추가/수정 | `architecture.md` 자동 트리거 표 | `Main.js`·`Telegram.js` |
| 데스크 컴포넌트 | `code-map.md` Web Desk 섹션 | `web-desk/src/components/*` |
| 새 페이지·기능 | `features.md` (현황) | `desk-enhancement-plan.md`(Phase A/B/C) |
| 표시 규칙 의문 | `memory/feedback_number_display.md`·`feedback_stock_name_primary.md` | — |
| 과거 버그 | `errors.md` (증상→원인→해결) | — |
| 미해결 항목 | `pending.md` | — |
| 설계 결정 이유 | `decisions.md` | — |

---

## 배포 URL · 경로 메모

- **데스크 prod**: https://ejunwon-lab.github.io/FD5to6/desk/
- **웹앱 prod**: https://ejunwon-lab.github.io/FD5to6/
- **GAS 스크립트 ID**: `apps-script-v2/.clasp.json` (4개 클라이언트가 모두 같은 ID 참조)
- **GAS deployment**: HEAD 코드(devMode:true) 사용 → 재배포 없이 즉시 반영
- **Telegram webhook**: Cloudflare Worker → GAS Web App `?secret=XXX`
- **dev 환경**: `cd web-desk && npm run dev` → localhost:5173/FD5to6/desk/

---

## 다음 컴퓨터 세팅 절차 (요약)

```bash
git clone https://github.com/ejunwon-lab/FD5to6.git
cd FD5to6
# 1. Claude memory 복원
mkdir -p ~/.claude/projects/-Users-$(whoami)-Documents-Claude-2026-FD5to6/memory
cp memory/* ~/.claude/projects/-Users-$(whoami)-Documents-Claude-2026-FD5to6/memory/
# 2. 전역 CLAUDE.md
mkdir -p ~/.claude && cp config/global-claude.md ~/.claude/CLAUDE.md
# 3. 데스크 dev
cd web-desk && npm install && npm run dev
# 4. GAS clasp 인증 (사용자 직접) — clasp login + Secret.js는 GAS 웹 에디터에서 직접 입력 (push 금지)
```
