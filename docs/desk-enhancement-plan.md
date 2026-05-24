# 데스크 고도화 (web-desk Enhancement Plan)

> 2026-05-25 작성 · 전세계 데스크 10개 분석 기반 web-desk 4개 메뉴 강화 계획

## 1. 분석한 데스크 10개

| # | 데스크 | 시그니처 패턴 / 강점 |
|---|---|---|
| 1 | **Bloomberg Terminal** | 정보 밀도 극한, 멀티패널 동시 표시, 마켓 히트맵, 종목간 상관관계 매트릭스, 커맨드 바 |
| 2 | **Refinitiv Eikon (LSEG Workspace)** | 뉴스·이벤트 컨텍스트 통합, 종목 영향 분석, 이코노믹 캘린더 |
| 3 | **Interactive Brokers TWS** | Performance tab (벤치마크 비교), Risk Navigator, 익스포저 매트릭스, 드로다운 곡선 |
| 4 | **TradingView** | 차트 중심, 마켓 히트맵, 스크리너, 상승/하락 TOP, 백테스트 통계 |
| 5 | **Robinhood** | 모바일 카드, 시각 등락 시그널(녹/적 그라데이션), 1탭으로 상세 |
| 6 | **Fidelity Active Trader Pro** | 세금 센터(Tax Lot), 배당 캘린더, 분석 도구 통합 |
| 7 | **Wealthfront** | 자동 절세 시뮬레이션(Tax-loss Harvesting), 벤치마크 outperformance 트래킹 |
| 8 | **Personal Capital / Empower** | 순자산 추이, 자산 배분 도넛, 수수료 분석, 은퇴 시뮬레이션 |
| 9 | **Morningstar Portfolio X-Ray** | 스타일 박스(가치/성장 × 대/중/소), 다양화 점수, 섹터·국가·시총 분해 |
| 10 | **Schwab StreetSmart Edge** | 워치리스트, 종목 상관관계 매트릭스, 옵션 차트 통합 |

## 2. 도출한 핵심 인사이트

- **깊이** (Bloomberg/IBKR): 한 화면에 더 많은 컨텍스트
- **비교** (Wealthfront/IBKR): 벤치마크·시장 대비 outperformance
- **분해** (Morningstar): 어떤 종목·섹터가 합계에 얼마나 기여
- **시각화** (TradingView/Bloomberg): 히트맵·상관관계 매트릭스로 패턴
- **액션 가능성** (Wealthfront/Fidelity): 절세 제안, 리밸런싱 알림
- **시계열 깊이** (IBKR): 일별·월별·연별 비교 누적
- **카드 ↔ 표 ↔ 차트** 전환 (Robinhood ↔ Bloomberg)

## 3. 메뉴별 상세 계획

### 📋 Holdings (보유 종목)

| 기능 | 영감 | 구현 | 데이터 출처 | 우선순위 |
|---|---|---|---|---|
| 계좌 chips + 6 정렬 + 검색 + 3-view 토글 | IBKR Portfolio | DashboardHoldings 재활용 | 기존 holdings | 🔴 A |
| 현황 strip (필터 합계 + 동적 카드) | Bloomberg | HoldingsStatusStrip 재활용 | 기존 | 🔴 A |
| 종목 클릭 → 상세 모달 | Robinhood | StockDetailModal 재활용 | getStockDetail | 🔴 A |
| 시장 × 계좌 익스포저 매트릭스 | Bloomberg/IBKR | 격자표, 셀에 ₩금액 | 기존 holdings 집계 | 🔴 A |
| 52주 위치 막대 (현재가 게이지) | IBKR | SVG 막대 + 마커 | high52/low52/currentPrice | 🟠 B |
| 수익률 히스토그램 (종목 분포) | Morningstar | 10구간 막대 | returnPct[] | 🟠 B |
| CSV 내보내기 | IBKR Activity | client-side CSV | 기존 | 🟢 C |

### 📊 Analysis (분석)

| 기능 | 영감 | 구현 | 데이터 출처 | 우선순위 |
|---|---|---|---|---|
| Risk-Return KPI (Sharpe/Max DD/Vol/Win/Best) | Wealthfront/IBKR | 기존 AnalysisPage | equityCurve 계산 | 🔴 A (있음) |
| 수익 기여도 막대 | Morningstar X-Ray | 종목별 기여 % 막대 | 기존 holdings | 🔴 A |
| 벤치마크 outperformance 차트 | Wealthfront | 2선 차트 (포트 vs KOSPI/S&P) | equityCurve + 지표 history (GAS 확장) | 🟠 B |
| 시장 + 섹터 도넛 | Morningstar | recharts PieChart 2개 | category 필드 (확인 필요) | 🟠 B |
| 월별 수익 히트맵 | TradingView Calendar | 격자 셀 색상 | equityCurve 월말 | 🟠 B |
| 드로다운 곡선 (Underwater) | IBKR Risk | AreaChart, 0 위 안 보임 | equityCurve | 🟢 C |
| 상관관계 매트릭스 | Bloomberg/Schwab | 컬러 셀 표 | 종목별 daily returns (GAS 확장) | 🟢 C |

### 🌐 Indicators (지표)

| 기능 | 영감 | 구현 | 데이터 출처 | 우선순위 |
|---|---|---|---|---|
| 카테고리별 그룹화 | TradingView Markets | 기존 IndicatorsPage | indicators[] | 🔴 A (있음) |
| 상승/하락 TOP 3 | TradingView Gainers | 상단 strip 2칸 | indicators changePct 정렬 | 🔴 A |
| 마켓 히트맵 (격자 + 색상) | Bloomberg/TradingView | CSS Grid + 색상 보간 | indicators[] | 🔴 A |
| 지표 클릭 → 상세 차트 모달 | TradingView | recharts LineChart | 지표 history (GAS 확장) | 🟠 B |
| 보유↔지표 영향도 (베타) | Refinitiv News Impact | 종목 베타 표 | returns history (GAS 확장) | 🟢 C |
| 이코노믹 캘린더 (FOMC/CPI/실적) | Refinitiv/Bloomberg | 외부 API (Trading Economics) | 외부 | 🟢 C |

### 💰 Trade Log / Realized P&L

| 기능 | 영감 | 구현 | 데이터 출처 | 우선순위 |
|---|---|---|---|---|
| 월별 P&L 막대 + 필터 | Fidelity/IBKR | 기존 ActivityPage | useRealized | 🔴 A (있음) |
| 5 KPI strip | IBKR Performance | 기존 | 기존 | 🔴 A (있음) |
| 연도 누적 + YoY 비교 | Wealthfront | 연도 토글 + 카드 2개 | useRealized 연도 집계 | 🟠 B |
| 세금 시뮬 (Tax-Lot) | Wealthfront | 미실현 손실 종목 + 절세 시뮬 | holdings + KR 양도세 계산 | 🟠 B |
| 장기/단기 보유 분류 | Fidelity Tax Center | buyDate 기준 분류 | buyDate (기존) | 🟢 C |
| 배당 일정 + 분기 누적 | Fidelity Dividends | 표 + 카드 | 배당 데이터 (GAS 확장) | 🟢 C |
| 거래 빈도 차트 (월/요일별) | TradingView | 막대 차트 | useRealized + transactions | 🟢 C |
| 수수료/세금 누적 | IBKR Activity | strip 카드 | 수수료 데이터 (GAS 확장) | 🟢 C |
| CSV/Excel export | IBKR | client-side blob | 기존 | 🟢 C |

## 4. Phase 구분

### Phase A (즉시 — High 우선순위, 1~2 세션)
GAS 작업 불필요. 기존 데이터로 즉시 구현 가능.
- Holdings 전체 기능(DashboardHoldings 수준) + 익스포저 매트릭스 + 상세 모달
- Analysis 수익 기여도 막대
- Indicators 상승/하락 TOP + 마켓 히트맵

### Phase B (중기 — Medium 우선순위)
GAS 확장 일부 필요 (indicator history, sector).
- Holdings 52주 위치, 수익률 히스토그램
- Analysis 벤치마크 outperformance, 월별 히트맵, 섹터 도넛
- Indicators 지표 상세 모달
- Activity 연도/YoY, 세금 시뮬

### Phase C (장기 — Low 우선순위)
GAS 큰 확장 필요 (returns history, 배당, 수수료) + 외부 API.
- Analysis 상관관계 매트릭스, 드로다운 곡선
- Indicators 보유↔지표 영향도, 이코노믹 캘린더
- Activity 배당 일정, 거래 빈도, 수수료, 장기/단기 분류, CSV export

## 5. 클라이언트 영향 범위

각 GAS 확장은 4개 클라이언트(web-desk·web·Telegram·iOS) 중 일부에만 영향:
- **새 endpoint 추가**: 응답 구조 신규라 기존 클라이언트 영향 없음. 사용하는 클라이언트만 코드 추가
- **기존 endpoint 응답 확장**: 새 필드 추가는 안전, 기존 필드 변경은 위험
- **자세히는 `project_web_terminal_gas_integration.md` 메모리 참조**
