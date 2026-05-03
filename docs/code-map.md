# Code Map
last updated: 2026-05-03

코드 구조가 필요할 때 읽는 파일. CLAUDE.md에는 포함하지 않음.

---

## iOS — Sources/

### Core/
- **PortfolioViewModel.swift** — 전체 상태 관리 (ObservableObject)
  - `fetchPortfolio()` 데이터 읽기
  - `triggerUpdate()` 현재가+환율만
  - `updateHoldingsFast()` 현재가+등락+52주 (카드탭·⚡ 동일)
  - `updateHoldingsFull()` 1M/3M/1Y 포함 전체
  - `updateAll()` 통합 (✦)
  - `fetchIndicators()` 참고지표 (독립, 대시보드와 무관)
- **ScriptAPIService.swift** — GAS API 호출 레이어
- **CacheService.swift** — 포트폴리오·지표 캐시

### Models/
- **PortfolioModels.swift** — Holding, Summary, GroupStat, ReferenceIndicator 등

### Features/Dashboard/
- **DashboardView.swift**
  - `dashboardHeader` — 우측 상단 버튼 3개 (⚡=updateHoldingsFast, ⊞=updateHoldingsFull, ✦=updateAll)
  - `summaryCard` — 합계수익 + 오늘/전일수익 카드 (카드탭 → updateHoldingsFast)
  - `fxCard` — 환율 + 마지막 갱신
  - `showPrevDayProfit` — 장전/비거래일 판단
- **ProfitHistoryView.swift** — 스와이프 다운 기간별 수익 차트

### Features/Holdings/
- **HoldingsView.swift**
  - `filterBar` — 계좌 필터 칩 (HStack, 스크롤 없음)
  - `sortBar` — 정렬 버튼 (ScrollView)
  - `accountDisplayName` — 계좌 표시명 맵 (퇴직연금_개인IRP→퇴직연금_미래 등)
- **HoldingCard.swift**
  - `standardCard` / `allInfoCard` — sortKey에 따라 전환
  - `detailGrid` — 펼쳤을 때 상세 (1M/3M/1Y, 계좌: broker앞2자_accountType)

### Features/Analysis/
- **AnalysisView.swift**
  - `matrixSection` — 투자 효율 매트릭스 (4분면)
  - `annualizedSection` — 연 환산 수익률 차트 (Y축: 종목명·기간 / 수익률 컬러)
  - `position52Section` — 52주 포지션 바
  - `accountAnalysisSection` — 계좌별 분석 5탭 (현황/수익률/비중/오늘/종목)
  - `allocationSection` — 분류별 자본 배분 도넛

### Features/Indicators/
- **IndicatorsView.swift** — 참고지표 (카테고리별 섹션)

---

## GAS — apps-script/

### MobileAPI.js — iOS 앱 진입점
- `mobileGetPortfolio()` 읽기만 (~3초)
- `mobileTriggerUpdate()` 현재가+환율 갱신
- `mobileUpdateHoldingsFast()` → updateStockStatusQuick (현재가+등락+52주)
- `mobileUpdateHoldingsFull()` → updateStockStatusAuto (1M/3M/1Y 포함)
- `mobileUpdateAll()` → runFullUpdate (전체)
- `mobileGetReferenceIndicators()` 참고지표 (독립)
- `mobileGetProfitHistory()` 추이 히스토리
- `_buildPortfolioJSON()` 포트폴리오 JSON 빌드
- `_logToTrendSheetLite()` 추이 요약 갱신 (히스토리 추가 없음)

### Main.js — 실행 로직·메뉴
- `runFullUpdate()` 통합 업데이트
- `updateAllFinanceData()` 현재가+환율 갱신
- `setupDailyTrigger()` 매일 8:30 runFullUpdate 트리거
- `setupHoldingsTriggers()` 매일 8:30·17:30 종목현황 트리거
- `scheduledHoldingsUpdate()` 트리거 실행 함수 (updateStockStatusAuto + TrendLite)

### KIS_StockStatus.js
- `updateStockStatusQuick()` 빠른 현황 (현재가+등락+52주)
- `updateStockStatusAuto()` 전체 현황 (1M/3M/1Y 포함)

### Config.js — 설정값, Named Range, 헤더 텍스트 맵
### KIS_API.js — KIS API 호출 (토큰, 주식/지수/선물 조회)
### Trend.js — 추이 기록 (logToTrendSheet, Section A/B/C)
### Analysis.js — 성과 분석 (updatePerformanceAnalysis)
