# 세션: 2026-05-23 — web-terminal 신규 대시보드 빌드

## 배경

사용자 요청: GAS 포트폴리오 데이터를 "클로드 디자인"으로 대시보드화. 기존 `web/` React PWA는 유지하고 별도 신규 프로젝트로.

## 진행 흐름

1. **디자인 리서치 + 3가지 mockup 제시** (`docs/mockups/`)
   - 1-terminal.html — Bloomberg/IBKR 다크 고밀도
   - 2-editorial.html — FT/Carta 잡지풍 (Instrument Serif + DM Sans)
   - 3-minimal.html — Linear/Vercel 미니멀 (Geist + 모노크롬)
2. **사용자 Terminal 선택** → 실제 React 프로젝트 빌드
3. **Phase 1**: Vite + React + TS + Tailwind 셋업 → AppShell + Dashboard sample
4. **Phase 2**: GAS OAuth 연결 (기존 web/ 패턴 그대로 — script.googleapis.com/v1/scripts/:run)
5. **Phase A**: Holdings·Analysis·Indicators·Activity 4페이지 풀 구현
6. **Dashboard 리디자인**: 기존 web/ 종목 패턴 참고 — 계좌 chips + 6 정렬 모드 + 검색

## 만들어진 것

### 프로젝트 구조 (`web-terminal/`)
```
src/
├── App.tsx                    (사이드바 라우팅)
├── auth/AuthContext.tsx       (Google OAuth via GIS)
├── api/gasApi.ts              (getPortfolio / getIndicators / getProfitHistory / getMonthlyRealized / getStockDetail)
├── lib/
│   ├── types.ts               (확장된 Holding: accountType·broker·opProfit·dayChange·buyDate)
│   ├── sampleData.ts          (KOSPI/KOSDAQ 포함 5 지표, 8 종목 with 계좌 정보)
│   ├── format.ts              (fmtKRW·fmtPct)
│   ├── usePortfolio.ts        (GAS fetch + sample fallback)
│   └── useRealized.ts         (월별 실현 손익)
└── components/
    ├── shell/                 (TopBar·Ticker·Sidebar·Footer)
    ├── ui/Panel.tsx
    ├── dashboard/             (KpiStrip·EquityChart·MarketIndices·DashboardHoldings·ActivityFeed)
    ├── holdings/HoldingsPage.tsx
    ├── analysis/AnalysisPage.tsx
    ├── indicators/IndicatorsPage.tsx
    └── activity/ActivityPage.tsx
```

### Dashboard 레이아웃
- KPI Strip 5 카드 (full width)
- KOSPI/KOSDAQ (1/3) | Equity Chart 30일 (2/3)
- Holdings 영역 — 계좌 chips + 6 정렬 + 검색 + 컬럼 9개 rich row
- Recent Activity (full)

### Holdings 영역 (web/ 패턴 이식)
- 계좌 chips (증권사별 색상: 미래에셋 orange, 삼성증권 blue)
- 정렬 6모드: 종목정보·당일등락·보유기간·평가금액·수익률·수익금
- 검색
- 행 컬럼: Symbol·계좌+증권사 chip·Shares·Avg·Value·Day Δ (₩+%)·Total P&L (₩+%)·Held days·Weight bar
- 계좌 필터링 시 푸터에 소계 표시

### 4개 페이지
- **Holdings**: 전체 정렬 가능 테이블 + 시장(KR/US) 필터 + 검색 + 통계 strip
- **Analysis**: Sharpe·Max DD·Win Rate·Volatility 계산 + 시장별 도넛 + 집중도 막대 + Top 5 winners/losers
- **Indicators**: 심볼 패턴으로 자동 카테고리 그룹 (Korea/US/FX/Crypto/...) + 큰 카드
- **Activity**: 월별 P&L 막대 (클릭→필터) + 5 통계 + 종목별 청산 내역

### GAS 연결
- 기존 web/ 패턴 그대로: `script.googleapis.com/v1/scripts/{SCRIPT_ID}:run` + OAuth Bearer
- VITE_GOOGLE_CLIENT_ID 환경변수 (배포된 web/ JS에서 값 추출 — 공개 client ID)
- 로그인 안 한 상태 → 샘플 데이터 + Sign in 버튼
- 로그인 완료 → 라이브 데이터 자동 fetch + LIVE 상태 바 + Refresh 버튼

## 기술 스택
- Vite 8.0 + React 18.3 + TS 5.5 (기존 web/과 동일)
- Tailwind 3 (커스텀 토큰: bg/line/ink/amber/cyan/gain/loss)
- Recharts 2 (Area·Pie·Bar)
- 폰트: JetBrains Mono + Major Mono Display
- 빌드 사이즈: ~620kB / gzip 184kB

## 디자인 결정
- **Terminal 채택 이유**: Bloomberg/IBKR 스타일 — 정보 밀도 우선, monospace 숫자, dark 테마. 사용자가 3안 중 선택
- **스캔라인 오버레이**: body::before로 1px 간격 cyan 줄무늬 (CRT 터미널 분위기)
- **F-key hints**: 사이드바 메뉴와 푸터에 F1~F9 표시 (Bloomberg-스타일)
- **블링킹 커서**: 푸터 우측 `> ready_` (1초 깜빡임)
- **자동 스크롤 티커**: 11개 심볼 60s 무한 루프
- **글자 크기 14px** (초기 12px → 사용자 요청으로 확대)

## 남은 작업 (다음 세션)
- Trade Log / Price History / Dividends 페이지 (sidebar 항목만)
- 종목 클릭 → 상세 모달 (getStockDetail 활용)
- 자동 새로고침 트리거 (5분)
- 모바일 반응형
- GitHub Pages 배포 워크플로

## 메모 (memory 갱신 없음)
오늘은 새 프로젝트 빌드라 기존 memory 변경 불필요. CLAUDE.md "주장 검증 절차"는 이전 커밋(0983233)에 이미 들어감.
