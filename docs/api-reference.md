# API Reference — GAS 모바일 엔드포인트 데이터 계약

last updated: 2026-06-10

`apps-script-v2/MobileAPI.js`의 `newMobile*` 함수가 iOS(`ios2`)·웹(`web`)에 돌려주는 JSON 계약.
**"어떤 필드가 이상하다"** 류 버그는 코드를 뒤지기 전에 이 표에서 필드 → 계산 위치를 먼저 찾는다.

- 호출: 모두 `JSON.stringify(...)` 문자열 반환 (Apps Script `scripts.run` 특성)
- 타입 정의 원본: web `src/models/types.ts` / iOS `Sources/Models/PortfolioModels.swift`
- 실패 시 공통: `{ success: false, error: "<메시지>" }`

---

## newMobileGetPortfolio() → PortfolioResponse

앱 실행 시 즉시 호출. 포트폴리오 전체.

| 필드 | 의미 | 계산 위치 |
|---|---|---|
| `success` / `error` | 성공 여부 | — |
| `updatedAt` | API 호출 시각 (yyyy-MM-dd HH:mm:ss) | `newMobileGetPortfolio` (현재 시각) |
| `usdRate` / `gbpRate` | 환율 | `_mGetFxRates` ← *설정* 시트 |
| `summary` | 요약 (아래 표) | — |
| `byCategory` / `byAccount` | 분류별·계좌별 집계 (`Record<string, GroupStat>`) | `_mGroupBy` |
| `holdings` | 종목 배열 (아래 표) | `_mMapHolding` |
| `cashReserve` | 대기자금 `{ items: CashReserveItem[], total }` (2026-05-25 신규). 옛 클라이언트는 무시. | `_mGetCashReserve` ← *설정* A7:E12 |
| `nonStockAssets` | 비주식 자산 `{ items: NonStockAssetItem[], total }` (2026-05-25 신규). KIS_SKIP 카테고리(펀드·예금·보험·기타) 행들. 옛 클라이언트는 무시. | `_mGetNonStockAssets` ← *보유현황* (KIS_SKIP 카테고리) |

### summary (Summary)

| 필드 | 의미 | 계산 위치 / 소스 |
|---|---|---|
| `totalBuy` | 총 매입금액 | *보유현황* 매입금액 합 (KIS_SKIP 포함) |
| `totalCurrent` | 총 평가금액 | *보유현황* 평가금액 합 |
| `totalProfit` / `profitRate` | 운용 손익 = 평가−매입 | `newMobileGetPortfolio` |
| `trendTotalProfit` | 합계 수익 (확정+운용) | *추이 기록* AD2 우선, 없으면 운용+확정 |
| `totalProfitRate` | 합계 수익률 | trendTotalProfit / totalBuy |
| `confirmedProfit` / `confirmedProfitRate` | 확정(실현) 수익 | *실현손익* 시트 합 |
| `trendOperatingProfit` / `operatingProfitRate` | 운용 수익 | 평가−매입 |
| `dayChangAmount` | 당일(=최근 거래일) 수익액 | Σ(*종목지표*.당일손익) ← `computeStockMetrics` |
| `dayChangePct` | 당일 수익률 (문자열 "+0.00%") | dayChange / 전일평가금액 |
| `prevDayChangAmount` / `prevDayChangePct` | 전일 거래일 변동 | `_mFindPrevDayProfitChange` ← *추이 기록* U열 |
| `isMarketDay` | 지금이 장중인가 | `_mIsMarketDay` |
| `isTradingDay` | 오늘이 거래일인가 | `_mIsTradingDay` |
| `priceAsOfDate` | 가격 기준일 (yyyy-MM-dd) | *현재가_이력* 마지막 **거래일** 행 날짜 |

### holdings[] (Holding)

| 필드 | 의미 | 계산 위치 / 소스 |
|---|---|---|
| `code`·`name`·`category`·`broker`·`accountType` | 식별 정보 | *보유현황* 행 |
| `quantity`·`buyPrice`·`currentPrice` | 수량·평균단가·현재단가 | *보유현황* 행 |
| `opBuy`·`opCurrent`·`opProfit`·`profitRate` | 매입금액·평가금액·손익·수익률 | *보유현황* 행 |
| `change`·`changePct` | 당일 등락 | *종목지표* 시트 ← `computeStockMetrics` (StockMetrics.js) |
| `m1`·`m3`·`m6`·`y1` | 1·3·6·12개월 수익률(%) | *종목지표* 시트 ← `computeStockMetrics` `pctAt` |
| `high52`·`low52` | 52주 고·저 | *종목지표* 시트 ← `computeStockMetrics` |
| `buyDate` | 첫 매수일 | `_mGetBuyDates` ← *거래_원장* |

### GroupStat (byCategory / byAccount 값)
`current`(평가금액) · `buy`(매입금액) · `profit`(손익) · `count`(종목수) · `profitRate` · `pct`(비중%) — `_mGroupBy`

---

## 그 외 엔드포인트

| 함수 | 반환 타입 | 내용 |
|---|---|---|
| `newMobileGetStockDetail(code)` | StockDetailResponse | 종목별 positions·summary·transactions·priceHistory·stats |
| `newMobileGetMonthlyRealized()` | MonthlyRealizedResponse | 실현손익. **응답 두 형태 같이** 보냄 — `entries[]`: 행 단위 14필드 (date·month·code·name·category·broker·account·quantity·sellPrice·sellAmount·avgBuyPrice·buyCost·fee·profit·returnPct, 매도일 desc — 데스크 ActivityPage용) + `monthly[]`: 월별 집계 (month·count·winCount·profit·profitRate·winRate — web·iOS Analysis 후방 호환) |
| `newMobileGetProfitHistory()` | TrendHistoryResponse | 수익 추이 (entries: date·totalProfit) ← *추이 기록* |
| `newMobileGetIndicators()` | IndicatorsResponse | 참고지표 (key·name·category·value·change·changePct) |
| `newMobileGetIndicatorHistory()` | IndicatorHistoryResponse | **참고지표 시계열** (*참고지표_히스토리* 시트 wide JSON: keys + entries[{date, KOSPI, SPX, ...}]). 벤치마크 outperformance 차트용 — 날짜 asc 정렬, name→key 매핑 |
| `newMobileUpdateCurrentPrice()` | — | 현재가 갱신 트리거 |
| `newMobileUpdateHistory()` | — | *현재가_이력* 갱신 트리거 |
| `newMobileUpdateAll()` | — | 통합 갱신 트리거 |
| `getPortfolioMetrics()` (doPost `action=portfolioMetrics`+secret) | `{success, assetClassWeights:{분류:%}, holdings:[{name,category,weight}], mdd:음수%}` | **상대 지표만 — 원화 절대액 미포함** (public KR 리포트용). 비중 분모=보유현황 평가금액 합, MDD=*추이 기록* 일별 총자산(Q열) peak-to-trough(자산액 기준·입출금 포함) |

상세 필드는 web `src/models/types.ts`의 `StockDetailResponse`·`MonthlyRealizedResponse` 등 참조.

### 참고지표 데이터 소스 우선순위
1. KIS API (국내지수·해외지수·국내선물)
2. Yahoo Finance (ES=F, NQ=F 등 미국선물)
3. GOOGLEFINANCE (VIX, TNX, DXY, 금, WTI)
4. GOOGLEFINANCE fallback (KIS 실패 시 gfSymbol 있는 항목)

---

> **갱신 규칙**: `newMobile*` 응답 필드가 추가/삭제/의미 변경되면 같은 작업에서 이 문서도 갱신.
> 타입 정의(`types.ts`)와 항상 일치해야 한다.
