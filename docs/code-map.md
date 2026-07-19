# Code Map

last updated: 2026-07-20

코드 구조를 파악할 때 **파일을 열기 전에 먼저 읽는 지도**.
함수명·역할·시트 스키마·데이터 흐름만 기록한다. **줄 번호는 적지 않는다** (가장 빨리 낡음).
실제 수정 직전에는 해당 함수를 직접 읽어 확인한다 — 지도는 "어디 있나"를 알려줄 뿐 검증을 대신하지 않는다.

> **갱신 규칙**: 함수를 추가/삭제하거나 역할·시그니처·시트 스키마가 바뀌면 이 파일의 해당 항목도 같은 커밋에서 갱신한다.

---

## 시스템 구성

- **활성 시스템**: `apps-script-v2/` (GAS) + `web/` (React PWA) + `ios2/` (SwiftUI)
- 레거시(`apps-script/`·`ios/`)는 2026-05-19 제거. 필요 시 git 히스토리에서 복원.

**데이터 흐름**
```
거래_입력폼 ─addTransactionFromForm→ 거래_원장
거래_원장 ─updatePositionFromLedger→ 보유현황 / 실현손익
KIS API ─updateNewPriceHistory→ 현재가_이력 (거래일만, 날짜×종목 Wide)
현재가_이력 + 보유현황 + 거래_원장 ─computeStockMetrics→ 종목지표 (지표 단일 계산)
실현손익 + 현재가_이력 ─buildSoldTracker→ 매도추적 (판 종목 What-if 스냅샷)
종목지표 + 보유현황 ─buildDashboard→ 대시보드 시트
종목지표 + 보유현황 ─newMobileGetPortfolio→ JSON → web/ios2
```

---

## 증상 → 위치 인덱스

버그/요청이 들어오면 **여기서 먼저 위치를 찾는다.** 그래도 모자라면 해당 함수만 읽는다.

| 증상 / 기능 | 파일 | 핵심 함수 |
|---|---|---|
| 변동 라벨 "오늘/전일/최근" | web `utils/changeLabel.ts` · ios2 `Shared/ChangeLabel.swift` · GAS `MobileAPI.js`(priceAsOfDate) | `decideChangeLabel` · `_isTradingDateStr` |
| 당일 수익 금액·% | GAS `StockMetrics.js` → *종목지표* 시트 | `computeStockMetrics` |
| 합계/운용/확정 수익 | GAS `MobileAPI.js` + *추이 기록*(AD2) | `newMobileGetPortfolio` · `_mFindPrevDayProfitChange` |
| 1주/1달 손익 | GAS `StockMetrics.js` → *종목지표* 시트 | `computeStockMetrics` · `pnlAt` |
| 1M/3M/6M/1Y 수익률 | GAS `StockMetrics.js` → *종목지표* 시트 | `computeStockMetrics` · `pctAt` |
| 52주 고저 (high52/low52) | GAS `StockMetrics.js` → *종목지표* 시트 | `computeStockMetrics` |
| 환율 USD/GBP | GAS `NewSystem.js` → *설정* 시트 | `updateFxRates` · `_mGetFxRates` |
| 보유기간 | GAS `NewSystem.js` | `_holdingPeriod` |
| 보유수량·평균단가·매입금액 | *보유현황* (원장 기반 계산) | `updatePositionFromLedger` |
| *대시보드* 시트 렌더·정렬·서식 | GAS `Dashboard.js` | `buildDashboard` · `_handleDashSortChange` |
| 종목 상세·가격 차트 | GAS `MobileAPI.js` | `newMobileGetStockDetail` |
| 월별 실현손익 | GAS `MobileAPI.js` | `newMobileGetMonthlyRealized` |
| 추이/수익 히스토리 차트 | GAS `MobileAPI.js` + *추이 기록* | `newMobileGetProfitHistory` |
| 매도 복기 (안 팔았다면?) | GAS `SoldTracker.js` → *매도추적* 시트 | `buildSoldTracker` · `newMobileGetSoldTracker` |
| 기간별 번 돈 (1주/1개월/올해) | web 순수함수 (*추이 기록* AD diff) | `computePeriodProfits` (web only) |
| 참고지표 (KOSPI 등) | GAS `MobileAPI.js` | `newMobileGetIndicators` |
| 현재가 갱신 안 됨 | GAS `NewSystem.js` + `KIS_API.js` | `updateNewPriceHistory` · `_fetchPricesFromKIS` |
| 거래일/휴일 판정 | GAS `Holidays.js`(휴일) · `MobileAPI.js`(거래일) | `_isKoreanHoliday` · `_mIsTradingDay` · `_isTradingDateStr` |
| 휴장일 동기화 | GAS `Holidays.js` → *휴장일* 시트 | `syncHolidays` (구글 공휴일 캘린더 '공휴일' 분류, 매월 25일 트리거) |
| 입력폼 → 원장 등록 | GAS `NewSystem.js` | `addTransactionFromForm` |

> 응답 JSON의 필드별 의미·계산 위치는 `docs/api-reference.md` 참조.

---

## GAS 시트 스키마 (apps-script-v2)

시트명 상수는 `NS` (NewSystem.js). 0-based 인덱스 = `getValues()` 배열 기준.

### *거래_원장* (NS.LEDGER) — 불변 거래 이력
`[0]날짜 [1]구분(매수/매도) [2]종목코드 [3]종목명 [4]분류 [5]증권사 [6]계좌 [7]수량 [8]단가 [9]금액 [10]수수료 [11]메모`

### *보유현황* (NS.POSITION) — 원장 기반 자동 계산
`[0]종목코드 [1]종목명 [2]분류 [3]증권사 [4]계좌 [5]보유기간 [6]보유수량 [7]평균단가 [8]매입금액 [9]현재단가 [10]평가금액 [11]손익 [12]수익률(%) [13]수동평가금액 [14]비고`

### *실현손익* (NS.REALIZED_PNL) — 매도 시 누적
`[0]매도일 [1]종목코드 [2]종목명 [3]분류 [4]증권사 [5]계좌 [6]매도수량 [7]매도단가 [8]매도금액 [9]평균매입단가 [10]매입원가 [11]수수료 [12]실현손익 [13]수익률(%)`

### *현재가_이력* (NS.PRICE_HISTORY) — 날짜×종목 Wide 포맷
- 1행 = 헤더: `[A]"날짜"` + `[B…]종목코드`
- 2행~ = 데이터: `[A]날짜` + `[B…]그 날짜의 종목별 현재단가`
- **거래일 행만 존재해야 함** — 비거래일 행이 끼면 변동/라벨 계산이 오염됨

### *거래_입력폼* (NS.FORM) — 입력은 C열, 행은 `NS.FR` 상수
`FR = {DATE:3, TYPE:4, CODE:5, NAME:6, CAT:7, BROKER:8, ACCT:9, QTY:10, PRICE:11, AMT:12, FEE:13, MEMO:14, SUBMIT:16}`

### *설정* (NS.SETTINGS) — 환율: USD=(2,2), GBP=(3,2)

### *추이 기록* (NS.TREND) — 시계열 요약 (복잡)
주요 셀: `AD2`=합계수익 최신, `U열`=날짜, `AE/AF`=전일 거래일 변동액/률

### *참고지표_히스토리* — `[0]날짜 [1]시간 [2…]지표값`

### *휴장일* (NS.HOLIDAYS) — 증시 휴장일 단일 소스
`[0]날짜(yyyy-MM-dd) [1]내용 [2]출처(캘린더/수동)` · `syncHolidays`가 채움 · `_isKoreanHoliday`가 읽음

### *시장리포트_큐* — Claude Routine이 적재 → Telegram이 발송
`[0]작성시각 [1]구분(US/KR) [2]대상날짜 [3]제목 [4]본문 [5]발송상태(대기/발송완료/실패) [6]발송시각 [7]에러` · `_tgHandleMarketReportPost`가 채움 · `tgFlushReportQueue`가 읽고 마킹

### *종목지표* (NS.STOCK_METRICS) — 종목별 지표 단일 소스
`[0]종목코드 [1]종목명 [2]증권사 [3]계좌 [4]당일등락 [5]당일등락률 [6]당일손익 [7]1주손익 [8]1달손익 [9]1M% [10]3M% [11]6M% [12]1Y% [13]52주최고 [14]52주최저` · `computeStockMetrics`가 채움 · `_readStockMetrics`가 읽음

### *매도추적* (NS.SOLD_TRACKER) — 매도 이벤트별 What-if 스냅샷 (state, 매 갱신 재기록)
`[0]매도일 [1]종목코드 [2]종목명 [3]분류 [4]증권사 [5]계좌 [6]매도수량 [7]매도단가 [8]매도금액 [9]평균매입단가 [10]매입원가 [11]실현손익 [12]현재가 [13]안팔았다면손익 [14]판것대비차이 [15]경과일` · `buildSoldTracker`(*실현손익*×*현재가_이력* 파생) 채움 · `newMobileGetSoldTracker`가 읽음. 국내만 what-if(해외 blank·환율 미반영), 예금·펀드는 코드 빈칸이라 자동 제외. 일별 이력 SSOT는 *현재가_이력*

### 기타 상수 (NS)
- `KIS_SKIP = ['펀드','예금','보험','기타']` — KIS 가격 조회 제외 분류
- `BROKERS`, `ACCOUNTS`, `CATEGORIES`, `LC`(원장 1-based 컬럼맵)

---

## GAS — apps-script-v2/

### Main.js — 메뉴·트리거
- `onOpen` — **📊 뉴시스템**(데이터 작업) + **🛠️ 유지보수**(진단·트리거) 두 메뉴 생성
  - 뉴시스템: 전체/현재가/보유현황/대시보드 갱신 + 휴장일 동기화
  - 유지보수: 🔍 진단(`runDiag`) / ⏰ 17:30 트리거 / 🕐 장중 매시 :30 트리거 / 📱 Telegram 푸시 / 📊 시장 리포트 큐 트리거(`tgSetupReportQueueTrigger`)·수동 발송(`tgFlushReportQueueNow`)
- `doPost(e)` — action 라우팅: `addMarketReport`→`_tgHandleMarketReportPost` / `pushPnL`→`_tgHandlePushPost`(GitHub Actions 장중 텔레그램 푸시) / 그 외→`handleTelegramWebhook` (모두 Telegram.js)
- `onEdit` — 입력폼 제출·대시보드 정렬 드롭다운 분기
- `updateAllNew` — 전체 업데이트: 가격→보유현황→대시보드 (`menuUpdateAll` alias)
- `menuUpdatePricesOnly` — 현재가만
- `scheduledDailyUpdate` / `setupDailyTrigger` / `deleteDailyTrigger` — 17:30 자동 트리거 (장 마감 후 정리)
- `scheduledHourlyUpdate` / `setupHourlyTrigger` / `deleteHourlyTrigger` — 장중 매시 :30 트리거 (거래일 09:30~16:30, `everyMinutes(30)` + 핸들러 분 체크 / LockService로 tgPushPnL·사용자 갱신과 충돌 방지)
- `_handleCashReserveTimestamp(e)` — onEdit 분기. *설정* C7:C12(대기자금) 편집 시 같은 행 E열에 yyyy-MM-dd HH:mm 자동 스탬프 (빈 값으로 지우면 스탬프도 지움)

### Holidays.js — 증시 휴장일 단일 소스
- `syncHolidays` — 구글 '대한민국 공휴일' 캘린더 → *휴장일* 시트. 채택 기준 = 이벤트 DESCRIPTION '공휴일' 분류(1차 권위, 2026-07-20 전환 — 이름 화이트리스트는 desc 부재 시 폴백만) + KRX 고정휴장(5/1·12/31·제헌절). 설계 `docs/plans/2026-07-20-휴장일-권위소스.md`
- `scheduledHolidaySync` — 매월 25일 자동 동기화 트리거 핸들러 (`_ensureHolidayTrigger`, 12월 게이트 제거 2026-07-20 — 연중 임시공휴일 자동 수용)
- `_isKoreanHoliday(date)` — *휴장일* 시트 읽어 휴일 판정 (시트 없으면 `_HOLIDAY_FALLBACK`)
- `_getHolidaySet` — 시트 → Set 캐시 / `_setupHolidaysSheet` — 시트 생성

### NewSystem.js — 셋업·원장·보유현황·가격수집
- `NS` — 전 시트명/컬럼맵/상수 (위 스키마 참조)
- `setupNewSystem` + `_setup*Sheet` — 최초 시트 7종 생성
- `addTransactionFromForm` — 입력폼 → *거래_원장* 1행 추가
- `_mLastUpdateAt(ss)` (MobileAPI.js) — *대시보드* 2행("🕐 마지막 갱신 …") 정규식 파싱 → 저장된 갱신시각(yyyy-MM-dd HH:mm). `newMobileGetPortfolio`의 `updatedAt`이 이걸 사용 → 갱신=now 재기록, 단순읽기=직전 갱신시각. 셀 없으면 now() 폴백
- `_handleAddTradePost(e)` — doPost `action=addTrade` 분기. secret(TG_WEBHOOK_SECRET) 검증 → `_appendTradeRow`. 카톡 매매 자동기록 전용 (`scripts/post_trade.py`가 호출)
- `_appendTradeRow(t)` — 카톡 매매 payload → *거래_원장* 1행. 정규화(증권사 별칭·코드 A제거·날짜 기본 오늘·금액 검산) + **멱등**(주문번호+동일 fill, 분류 룩업보다 먼저) + 매도 분류 *보유현황* 룩업(코드+증권사+계좌) + append + `updatePositionFromLedger` → `{beforeQty,afterQty}`. 설계: `docs/plans/2026-06-11-카톡매매-원장자동기록.md`. **`type=입금/출금`(`NS.FLOW_TYPES`)이면 현금흐름 행 분기**: 종목 필드 없이 금액만 기록(멱등 키=날짜+구분+증권사+계좌+금액), 재계산 연쇄 없이 반환 `{flow:true}` — TWR 보정용 (`docs/plans/2026-07-16-TWR-입금왜곡보정.md`)
- `updatePositionFromLedger` — *거래_원장* → *보유현황* 재계산 (구분이 매수/매도 아닌 행, 예: 입금/출금은 명시 skip). 끝에 `computeStockMetrics`·`buildSoldTracker`·`buildDashboard` 호출. KIS_SKIP(예금·펀드·보험) 행은 값·수식 보존, **단 평가금액 빈칸+현재단가>0이면 자가치유**(평가=현재단가×수량·손익=평가−매입 재계산·잘못된 집계 수식 제거, errors.md 2026-07-15)
- `updateNewPriceHistory(ss)` — KIS 시세 → *현재가_이력* 행 upsert (**비거래일엔 미기록**. KIS 실패 종목은 직전가 carry-forward + toast)
- `updateFxRates` — 환율 → *설정*
- `_fetchPricesFromKIS(codes)` — KIS 가격 일괄 조회 (실패 종목 1회 재시도)
- `_normCode(c)` — 종목코드 정규화 (6자리 패딩, 영숫자 `0047A0`·해외 `AAPL` 허용)
- `_holdingPeriod(dateStr)` — 보유기간 문자열 ("11개월 26일")
- `importHistoricalTrades` — 과거 거래 시드 입력

### MobileAPI.js — iOS/웹 진입점 (모두 JSON 문자열 반환)
- `newMobileGetPortfolio` — 포트폴리오 전체 JSON (holdings·summary·byCategory·byAccount)
- `newMobileUpdateCurrentPrice` / `newMobileUpdateHistory` / `newMobileUpdateAll` — 갱신 트리거
- `newMobileGetStockDetail(code)` — 종목 상세 (가격 시계열 포함)
- `newMobileGetMonthlyRealized` — **실현손익 행 단위 14필드** (date·month·code·name·category·broker·account·qty·sellPrice·sellAmount·avgBuyPrice·buyCost·fee·profit·returnPct). 매도일 desc. KPI/월별 집계는 클라이언트 derive
- `newMobileGetProfitHistory` — 추이 히스토리
- `newMobileGetIndicators` — 참고지표 (현재값)
- `newMobileGetIndicatorHistory` — **참고지표 시계열** (*참고지표_히스토리* 시트 wide JSON, name→key 매핑, 날짜 asc). 벤치마크 차트·지표 상세 모달용
- `getPortfolioMetrics` / `_handlePortfolioMetricsPost` — **포트폴리오 상대 지표** (리포트 public용, doPost `action=portfolioMetrics`+시크릿). 자산군 비중%(현금성 포함)·종목 비중%·MDD%·`recentReturns`(운용수익률% 누적 시계열, AC열)·`dailyReturns:[{date,dRatePct,rawPct?,flowAdj?,suspect?}]`(최근 7거래일 **일별 총자산 변화율%**, S열 — 마지막5 복리=d5라 주간 리포트 일자별 표와 d5 정합. **TWR read-time 보정**: 원장 입금/출금 행으로 flow 맵 구성(비거래일 롤포워드) → `r_adj=(Q−F−V_prev)/V_prev`·`flowAdj:true`, |dRate|≥3%인데 flow 없으면 `suspect:true`. ₩ 금액 비노출)·`portfolioReturn{d5,d20}`(보정된 dRate 복리누적, 매매 강건·벤치 단위일치) — **원화 절대액 미포함**. MDD=*추이 기록* 일별 Q열 peak-to-trough. **% 셀은 `_mPctVal`로 파싱**(numeric=분수×100/텍스트=% — Sheets가 음수 % 문자열만 분수로 자동 파싱하는 비대칭, errors.md 2026-07-16)
- `_handleEmailReportPost` / `_emailReportSelfTest` / `emailKillSwitch_ON` / `emailKillSwitch_OFF` / `_mdToHtml` — **이메일 셀프발송** (PB 리포트, doPost `action=emailReport`+시크릿). 수신=발송=`getEffectiveUser` 소유자 고정(제3자 불가). 안전장치 5중: killswitch(`email_disabled`)·제목화이트리스트(`Market Close/Wrap`)·일일상한 6·주소마스킹·수신자고정. `_mdToHtml`=MarkdownV1→HTML(htmlBody). 스코프 `script.send_mail` 필요(재승인)
- `_mMapHolding` — 보유현황 행 + *종목지표* → holding 객체 (지표는 `_readStockMetrics`로 읽음, StockMetrics.js)
- `_mGetBuyDates` / `_mGetFxRates` / `_mGetCashReserve` (*설정* A7:E12) / `_mGetNonStockAssets` (KIS_SKIP 카테고리 행) / `_mFindPrevDayProfitChange`
- `_mGroupBy` — 분류별/계좌별 집계
- `_isTradingDateStr(s)` / `_mIsMarketDay` / `_mIsTradingDay` — 거래일 판정 (휴일은 `Holidays.js._isKoreanHoliday`)
- `_newGetYahooFinanceQuote` / `_newFill*` — 참고지표 fallback

### Dashboard.js — *대시보드* 시트 렌더
- `buildDashboard` — *대시보드* 시트 전체 그리기 (요약카드·보유종목표·계좌별·분류별·월별·Top5)
- `DB` — 색상·`COLS:20`·정렬 프로퍼티 키 상수
- 종목 지표는 `StockMetrics.js`로 이관 — `buildDashboard`는 `_readStockMetrics()`로 *종목지표* 읽음
- `_handleDashSortChange(e)` — 정렬 드롭다운 처리
- `_dbSectionTitle` / `_dbHeader` / `_dbColorCell` — 렌더 헬퍼
- `_dbNum` / `_dbPnl` / `_dbRate` — 문자열 포맷 (현재는 **요약 카드에서만** 사용)
- `_FMT_INT` / `_FMT_PNL` / `_FMT_PCT` — 표 숫자 셀 표시 서식 상수

### StockMetrics.js — 종목 지표 단일 계산
- `computeStockMetrics` — *현재가_이력*+*보유현황*+*거래_원장* → 종목별 지표 → *종목지표* 시트
  - `pnlAt` = 정확한 기간 손익 (오늘 평가금액 − N일전 평가금액 − 기간 내 순매수금액)
  - `updatePositionFromLedger` 끝에서 호출 (모든 갱신 경로가 통과)
- `_readStockMetrics` — *종목지표* → Map (앱·대시보드가 읽음). 시트 없으면 1회 자동 계산
- `_setupStockMetricsSheet` — 시트 생성

### SoldTracker.js — 매도 종목 What-if 추적
- `buildSoldTracker` — *실현손익*×*현재가_이력*(마지막 거래일 가격) → *매도추적* 시트(state). **KIS 신규호출 없음**(현재가_이력이 원장 전체 코드 기준이라 판 종목도 매일 기록). `updatePositionFromLedger` 끝에서 호출(모든 갱신 경로 통과 → 항상 fresh, errors.md 70/72 회피). 국내만 what-if, 해외는 blank(환율 미반영 스케일), 예금·펀드는 코드 빈칸 자동 제외
- `newMobileGetSoldTracker` — *매도추적* → JSON (items 16필드: sellDate·code·name·category·broker·account·sellQty·sellPrice·sellAmount·avgBuyPrice·buyCost·realizedProfit·currentPrice·ifHeldProfit·diff·elapsedDays). 시트 없으면 1회 자동 빌드. 웹/데스크 매도 복기용
- `_soldLatestPriceMap` — *현재가_이력* 마지막 거래일 행 → {code→현재가}+기준일 (비거래일 스킵)
- `_setupSoldTrackerSheet` — 시트 생성
- 설계: `docs/plans/2026-07-15-매도추적-기간별번돈.md`

### Diag.js — 사용자 트리거 진단 (유지보수 메뉴)
- `runDiag` — `🛠️ 유지보수 → 🔍 진단` 메뉴 핸들러. 최소 진단 JSON 팝업으로 표시 (복사용)
- `_buildDiag` — 날짜·참거짓·개수·지표충족도·상태만 (금액·종목명·계좌 절대 미포함)
- 공개 엔드포인트 없음. 사용자가 메뉴로만 트리거

### Trend.js — `logToTrendSheet(ss)` *추이 기록* 갱신 + 헬퍼
- 3섹션 upsert: (A)업데이트별 B~L(+B2:L2 미러) (B)일별 N~S(+N2:S2) (C)수익 U~AF(+U2:AF2, 거래일 AH/AI 캐시)
- `_trFmtPct(n)` — **% 값 → numeric 분수 반환**(-7.08 → -0.0708) + `_trPctFormat`(rangeList `'+0.00%;-0.00%;+0.00%'` 서식). 과거 부호 % 문자열 반환 시절 음수만 auto-parse돼 타입 혼합·100배 축소 버그(errors.md 2026-07-16) — 읽기는 `_mPctVal`(MobileAPI)이 과거 혼합 셀까지 처리. % 열: F·I·L / S / Y·AC·AF·AI2
- `_trFmtNum` — 콤마 문자열(부호 무관 대칭 auto-parse라 유지) · `_trNum` · `_trLastFilledRowInCol` · `_trGetPendingTotal`(*설정* 합계 행 자동 감지)

### Telegram.js — Telegram 봇 연동 (텔레그램 손익 푸시 + webhook)
- `TG` — Properties 키·API base·트리거 핸들러·명령어 키워드 상수
- `tgSendMessage(text)` — Telegram sendMessage API 호출 (Markdown)
- `_tgFormatPnL` — `newMobileGetPortfolio()` → `summary.trendTotalProfit/totalProfitRate/dayChangAmount/dayChangePct/priceAsOfDate` 추출 → 메시지 포맷
- `tgPushPnL` — 장중 텔레그램 푸시 (**GitHub Actions가 5분마다 `action=pushPnL` poke** — F 구조 "단일 신뢰 시작 + 자체 루프", 2026-06-09). **거래일 + 09:00~16:00 + 락 + 18분 dedup(`tg_lastPushEpoch` 슬롯 선점)** 자체 게이트 → **`updateAllNew()` 전체 갱신**(FX·가격·보유현황·종목지표·추이기록 AD2·대시보드) + 발송, 그 외 silent skip. (2026-06-10: 부분갱신→전체. 부분갱신은 추이기록 AD2=합계손익이 stale→+0/직전값 버그) dedup이 카덴스의 단일 권위(겹치는 잡·중복 poke 무해화 → ~20분 간격)
- `_tgHandlePushPost(e)` — doPost `action=pushPnL` 분기. secret(`TG_WEBHOOK_SECRET`) 검증 → `tgPushPnL()` 호출 → `{success:true}`. GitHub Actions `telegram-push.yml` 전용 엔드포인트
- `tgRefreshAndPush` — 수동 갱신 (가격 + 보유현황 재계산 후 푸시 → `tg_lastPushEpoch` 갱신해 직후 자동 poke 중복 방지). 대시보드·추이 렌더 생략 (응답 시간 단축)
- `doPost`/`handleTelegramWebhook(e)` — Telegram webhook 진입점 (Main.js의 doPost가 `action` 보고 위임. `action=addMarketReport`면 `_tgHandleMarketReportPost`, 아니면 webhook으로)
  - secret 검증 (URL query) → update_id 중복 제거 (PropertiesService, retry 방지) → chat_id 화이트리스트 → 키워드 매칭 → LockService로 동시 처리 차단 → `tgRefreshAndPush`
- **시장 리포트 큐** (수동 발송용으로 유지 — 자동 cron은 GitHub Actions로 이관 2026-06-03):
  - `TG_REPORT` — 시트명·트리거 핸들러·상태·헤더 상수
  - `_tgEnsureReportQueueSheet` — *시장리포트_큐* 시트 보장. 헤더: 작성시각·구분(US/KR)·대상날짜·제목·본문·발송상태(대기/발송완료/실패)·발송시각·에러
  - `_tgHandleMarketReportPost(e)` — doPost 분기. secret(TG_WEBHOOK_SECRET 재사용) 검증 후 시트에 "대기" 행 적재. POST body는 form-encoded 또는 JSON 둘 다
  - `tgFlushReportQueue` — 시트의 "대기" 행 → `tgSendMessage` → "발송완료"/"실패" 마킹. 트리거 + 메뉴 수동 둘 다 호출
  - `tgSetupReportQueueTrigger` / `tgDeleteReportQueueTrigger` — 매일 08:05·17:05 KST 트리거 2개
  - `tgFlushReportQueueNow` — 메뉴 수동 발송용 alias
- Setup 함수 (에디터에서 직접 실행):
  - `tgCaptureMyChatId` — 봇이 받은 마지막 메시지에서 chat_id 자동 추출 + webhook secret 자동 생성
  - `tgInstallWebhook` — Properties의 `TG_WEBAPP_URL` 읽어 `tgRegisterWebhook` 호출
  - `tgRegisterWebhook(url)` — Telegram setWebhook (`drop_pending_updates`, `max_connections:1`)
  - ~~`tgSetupPushTrigger`~~ / `tgDeletePushTrigger` — **(폐기)** GAS 시간 트리거 방식. best-effort라 수시간 누락(errors.md 2026-06-05) → GitHub Actions(`telegram-push.yml`)로 이관. 푸시 OFF는 `tgDeletePushTrigger`로 트리거 3개 제거
  - `tgDeleteWebhook` / `tgWebhookInfo` / `tgTestSend` — 디버깅용
- Properties 관리 (에디터에서 직접 실행, 시크릿 수동 등록·점검용):
  - `tgSetBotToken` / `tgSetWorkerUrl` / `tgClearWorkerUrl` — 봇 토큰·Cloudflare Worker URL 설정/해제
- `cloudflare-worker/worker.js` — Telegram 발송 프록시 워커 (GAS 아님, wrangler 배포). `jsonResponse(obj, status)` 응답 헬퍼 + secret 검증 + TG_CHAT_ID 다중 발송
  - `tgAddChatId` / `tgRemoveChatId` / `tgListChatIds` — chat_id 화이트리스트 관리
  - `tgShowSecret` — 현재 webhook secret 확인
- Properties 키: `TG_BOT_TOKEN`·`TG_CHAT_ID`·`TG_WEBHOOK_SECRET`·`TG_WEBAPP_URL`·`TG_LAST_UPDATE_ID`
  - 모두 GAS PropertiesService(서버 전용). 클라이언트(워치/iPhone)에 시크릿 0개

### KIS_API.js — `KIS_API` 객체: 토큰 발급, 국내·해외 주식/지수/선물 시세 조회

### Secret.js — KIS appkey/secret. **원격(Google)에만 존재. 절대 건드리지 않음.**
배포는 반드시 `python3 apps-script-v2/push_safe.py` (clasp push 금지).

---

## Web — web/src/ (React + Vite PWA)

- `App.tsx` — 탭 라우팅, portfolio/history/soldTracker 전역 fetch·상태
- `main.tsx` — 엔트리
- `api/gasApi.ts` — GAS `scripts.run` 호출 (newMobile* 함수 래핑, `getSoldTracker` 포함)
- `auth/AuthContext.tsx` — Google OAuth (GIS)
- `models/types.ts` — `PortfolioResponse`·`Summary`·`Holding`·`TrendEntry`·`SoldTrackerItem` 등 타입
- `utils/changeLabel.ts` — `decideChangeLabel`(오늘/전일/최근), `formatPriceAsOfDate`
- `utils/format.ts` — `krwCompact`·`pctFormatted` 등 숫자 포맷
- `utils/periodProfit.ts` — `computePeriodProfits`(1주/1개월/올해 번 돈 = *추이 기록* AD diff, 실현+평가 포함). vitest 6케이스
- `components/dashboard/` — `DashboardPage`(합계/오늘수익/기간별번돈/자산배분/계좌유형별/환율 — 매도복기는 전용 탭으로 분리), `ProfitHistoryChart`
- `utils/assetAllocation.ts` — `computeAssetAllocation`·`computeAccountTypeBreakdown`(일반 투자는 증권사 계좌 2개+면 계좌 단위 분리[삼성 종합/삼성 ISA], 1개면 증권사명만; 퇴직연금은 증권사 단위)
- `components/holdings/` — `HoldingsPage`, `HoldingCard`, `StockDetailModal`
- `components/analysis/AnalysisPage` · `components/indicators/IndicatorsPage`
- `components/soldtracker/SoldTrackerPage` — **매도 복기 전용 탭**(분석 오른쪽 "복기"). 정렬 pills(최근/차이/실현/경과/종목명, 재탭 시 방향 토글) + 요약 3칸 + 종목별 목록. `soldItems` 소비
- `components/ui/` — `Card`, `LoadingSpinner`, `TabBar`(탭 5개: 지표·대시보드·종목·분석·복기)
- 배포: git push → GitHub Actions → https://ejunwon-lab.github.io/FD5to6/

## GitHub Actions — `.github/workflows/`

- `deploy-web.yml` — web/ 빌드·gh-pages 배포 (push to main, paths web/)
- `deploy-web-desk.yml` — web-desk/ 빌드·gh-pages /desk/ 배포
- **`watchdog.yml`** (2026-07-19 신규) — 자동화 침묵 실패 감지. 매일 21:10·22:10 KST cron(뒤는 백업, 오늘 성공 run 있으면 dedup skip) → `scripts/watchdog_check.sh` 실행 → 텔레그램 heartbeat **매일 발송**(메시지 부재 = watchdog 사망 신호). 검사 5종: ①푸시 체인 alive ②오늘 sent 건수(run 로그의 GAS result 에코) ③휴장 판정(skip-holiday 관측 — 자체 달력 없음) ④시트 신선도(portfolioMetrics dailyReturns 마지막 날짜==오늘) ⑤리포트 파일(US/KR 평일·WEEK 일요일, private repo checkout). 🔴 있으면 run red + exit 1. 설계 `docs/plans/2026-07-19-자동화-watchdog.md`
- `diag-egress.yml` (2026-07-03 신규) — dispatch 전용 진단: 러너에서 데이터 소스별 HTTP+본문 head 실측. "차단" 보고 시 재사용 (memory: `reference-webfetch-vs-curl-headless`)
- **`market-report.yml`** (2026-06-03 신규) — 시장 리포트 자동 발송
  - cron `5 23 * * 0-4` UTC → KST 월~금 08:05 (US, 전일 미국 마감)
  - cron `5 8 * * 1-5` UTC → KST 월~금 17:05 (KR, 당일 한국 마감)
  - workflow_dispatch type=us/kr/both로 수동 실행
  - 흐름: checkout(main + **private `FD5to6-reports` → docs/reports 경로**, deploy key `REPORTS_DEPLOY_KEY`) → Python setup → `curl claude.ai/install.sh | bash` → `claude -p` headless 실행 → `docs/reports/{US|KR}-YYYY-MM-DD.md` Write → `send_telegram.py` 두 chat 발송 → **FD5to6-reports repo에** git auto-commit (`Market Report Bot`). 리포트 분리 2026-07-04 (`docs/plans/2026-07-04-리포트-private-분리.md`) — main repo는 public 유지(GH Pages), 리포트만 private
  - 로컬 열람: `docs/reports/` = FD5to6-reports clone (`scripts/run.sh`가 pull). 시트 백업: `scripts/backup_sheets.py` → `backups/`(gitignore) + launchd 주 1회(이 맥: halcyon_m1)
  - 인증: `CLAUDE_CODE_OAUTH_TOKEN` env (Max OAuth, 비용 0)
  - secrets: `CLAUDE_CODE_OAUTH_TOKEN`, `TG_BOT_TOKEN`, `TG_CHAT_IDS`
  - **Alert on generation failure** (2026-07-03): 3개 job 공통 — `found=no`면 텔레그램 경고+`exit 1` (dry_run 시 억제). telegram-push에도 체인 사망 `failure()` 알림. 설계 `docs/plans/2026-07-03-무음실패-알림.md`
  - weekly job: **Pre-fetch GAS portfolio metrics** step이 지표를 파일로 선확보 (에이전트 env 판단 제거, errors.md 2026-07-03)

## GitHub Actions scripts — `.github/scripts/`

- ⚠️ **프롬프트 3종(us·kr·weekly)+`kr-theses.md`는 2026-07-04부터 private repo `FD5to6-reports`의 `_config/`에 있음** (보유 종목 목록·투자 논리 비공개화). 로컬 편집: `docs/reports/_config/*.md` 수정 → `git -C docs/reports push`. 워크플로는 checkout된 그 경로를 cat.
  - `us-prompt.md` — US 분석 (Yahoo WebFetch 정본 + 인포맥스 RSS·한경 글로벌마켓 보조, WebFetch 실패 시 curl 폴백)
  - `kr-prompt.md` — KR 분석 (Naver·뉴스는 **Bash curl 필수** — WebFetch 도구 계층 차단 2026-07-03, iconv euc-kr. 수급/업종/종목뉴스API + 보유종목 그룹별)
  - `weekly-prompt.md` — 주간 리캡 (GAS 지표 pre-fetch 파일 1차, Yahoo curl 429 재시도)
- `send_telegram.py` — Telegram Bot API 발송 헬퍼 (Markdown→plain text fallback, 두 chat_id 순회)

## scripts/ — 로컬 스크립트·git 훅

- `run.sh` — 실행@ 기계 단계 (히스토리 재정렬 자기복구·pull·리포트 clone/pull·memory 복원·전역 CLAUDE.md/skill 동기화·pre-commit 훅 활성화)
- `save.sh` — 저장! 기계 단계 (memory 미러 + add/commit/push + 인덱스 누락 hint)
- `check_stale.sh` — 인덱스 vs 코드 정합 검사 (GAS public 함수·desk 컴포넌트 등재 여부 + last updated 경과)
- `backup_sheets.py` — GAS `action=backupData` POST → 전 시트 CSV 덤프 (`backups/` gitignore)
- `post_trade.py` — GAS `action=addTrade` POST (매매기록! 원장 기록)
- `gas_redeploy.py` — Apps Script API로 버전 고정 웹앱 재배포 (에디터 클릭 불필요)
- `setup_backup_launchd.sh` — 시트 백업 launchd 주 1회 등록 (맥별 1회)
- `watchdog_check.sh` (2026-07-19 신규) — watchdog.yml의 검사 로직. 로컬 실행 가능(gh 인증 + GAS env 선택) — 같은 스크립트로 스모크
- `git-hooks/pre-commit` (2026-07-19 신규) — 금액·시크릿 커밋 차단 스캐너. 경로 차단(.env·Secret.js·backups·키파일) + 시크릿 패턴(전 파일 추가줄) + 원화 금액 패턴(md만). 활성화 `git config core.hooksPath scripts/git-hooks`(run.sh 자동), 우회 `SCAN_BYPASS=1` 또는 `--no-verify`. memory [[feedback_public_repo_no_amounts]] 집행 장치

## Web Desk — web-desk/src/ (Bloomberg 스타일, React + Vite)

표시 규칙: 모든 숫자 `toLocaleString()` 풀, 종목명 메인·종목코드 보조 (memory: `feedback_number_display`·`feedback_stock_name_primary`)

- `App.tsx` — `<DataProvider>` wrap + 좌측 사이드바 메뉴 라우팅
- `api/gasApi.ts` — GAS `scripts.run` 래핑 (web/과 동일 endpoint)
- `auth/AuthContext.tsx` — Google OAuth (GIS)
- `lib/types.ts` — `Holding`·`Indicator`·`TickerItem`(name 포함) 등 데스크 자체 타입
- `lib/DataProvider.tsx` — **단일 데이터 소스** Context. `usePortfolio`·`useRealized`·`useSoldTracker`·`useIndicatorHistory` export
  - 첫 진입: portfolio + indicators + profitHistory Promise.all → monthlyRealized·soldTracker 백그라운드 prefetch
  - 시간당 자동 백그라운드 재페치 (`setInterval`) — soldTracker 포함
  - `updateAll` = 사용자 명시 KIS 강제 갱신 (후 realized·soldTracker 재갱신)
- `lib/usePortfolio.ts`·`useRealized.ts` — `DataProvider` re-export 1줄 (호출처 import 유지용)
- `lib/sampleData.ts` — fallback 더미 (종목명 한글 포함)
- `components/shell/` — `TopBar`, `Ticker`(live indicators + holdings movers), `Sidebar`, `Footer`
- `components/dashboard/` — `DashboardPage`, `KpiStrip`, `MarketIndices`, `EquityChart`, `ActivityFeed`, `DashboardHoldings`, `HoldingsStatusStrip`, `HoldingsTable`, `Indicators`
- `components/today/` — `TodayPage` (단축키 Y, Workspace > Today: KPI 4칸 [포트 변동·▲▼⏸ 카운트] + Sort [등락률·₩등락액·종목명] + Filter [ALL·GAIN·LOSS·FLAT] + 종목별 막대 카드 [순위·종목명·등락률·1주변동/주×수량·등락액·가로 막대])
- `components/holdings/` — `HoldingsPage`(ExposureMatrix + **Position52WeekPanel·ReturnHistogramPanel** 2단 + **AccountTypePanel** + DashboardHoldings 재사용), `ExposureMatrix`(Account P&L 패널), `AccountTypePanel`(계좌 유형별 일반투자/퇴직연금·증권사 계좌 분해 — `accountType.ts` `computeAccountTypeBreakdown` 클라 계산, 대기중 포함=총자산 기준), `Position52WeekPanel`(top 12 by weight·종목별 가로 막대 [저점─●현재가─고점]·25%/75% 색 임계), `ReturnHistogramPanel`(10구간 막대 분포·median/mean 메타·gain/loss 색상 구분), `HoldingCard`(Terminal), `HoldingCardWeb`(Web 스타일), `StockDetailModal`
- `lib/accountDisplay.ts` — 공통 계좌명 헬퍼 (`brokerShort`/`accountShort`/`accountDisplay(broker, account)`). 형식: `{미래/삼성}_{계좌명}`, 퇴직연금은 `미래_퇴직연금`/`삼성_퇴직연금`로 축약
- `components/indicators/` — `IndicatorsPage`(Gainers/Losers strip + Market Heatmap + 카테고리 패널 [BigIndicator] + **IndicatorDetailModal** 클릭 시 마운트), `GainersLosersStrip`, `MarketHeatmap`(Cell `onSelect?` 클릭 → 모달), `IndicatorDetailModal`(IndicatorHistory lazy load · 해당 key 시계열 추출 · LineChart + 기간 High/Low/Period% KPI · ESC/배경 클릭 close)
- `components/analysis/` — `AnalysisPage`(KPI·**BenchmarkPanel**·**MonthlyHeatmapPanel**·Allocation·Concentration·Contribution·Winners/Losers), `ContributionBar`, `BenchmarkPanel`(Portfolio vs KOSPI·S&P recharts LineChart — IndicatorHistory lazy load, 시작점 0% 정규화, vs KOSPI·vs SPX outperformance KPI 카드), `MonthlyHeatmapPanel`(equityCurve 월말 - 전월말 변화 격자, 색 진하기=|Δ|/max, hover 풀 ₩, YTD 합)
- `components/activity/` — `ActivityPage`(KPI 6칸 + **YearlyComparisonPanel + TaxSimPanel** 2단 + **SoldTrackerPanel** + Monthly 막대 + 9컬럼 테이블), `YearlyComparisonPanel`(올해·작년 카드 + YoY 차이 + 전체 연도표), `TaxSimPanel`(해외주식 미실현 손실 종목 · Tax-Loss Harvesting 시뮬 [22% · 연 250만 공제]), `SoldTrackerPanel`(매도 복기 What-if — 요약 4KPI + 10컬럼 테이블 [실현손익·안팔았다면·판것대비차이], `useSoldTracker`)
- `components/ui/Panel.tsx` — 공통 패널 컨테이너
- 배포: git push → GitHub Actions (`.github/workflows/deploy-desk.yml`) → https://ejunwon-lab.github.io/FD5to6/desk/

## iOS — ios2/Sources/ (SwiftUI, XcodeGen)

- `App/` — `NewFD7App`(엔트리), `MainTabView`(4탭), `SignInView`
- `Core/` — `AuthManager`(구글 로그인), `PortfolioViewModel`(상태), `ScriptAPIService`(GAS 호출), `CacheService`, `BackgroundNetworkSession`, `MockData`(Preview용)
- `Models/PortfolioModels.swift` — `Holding`·`Summary`·`GroupStat` 등
- `Shared/` — `ChangeLabel`(decideChangeLabel·formatPriceAsOfDate), `Extensions`
- `Features/Dashboard/` — `DashboardView`, `ProfitHistoryView`
- `Features/Holdings/` — `HoldingsView`, `HoldingCard`, `StockDetailView`
- `Features/Analysis/AnalysisView` · `Features/Indicators/IndicatorsView`
- 빌드: Xcode (VS Code SourceKit 에러는 대부분 false positive)
