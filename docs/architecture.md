# 시스템 아키텍처

last updated: 2026-04-25

## 전체 구조

```
[KIS API] ──→ [Google Apps Script] ──→ [Google Sheets]
                      ↑                       ↓
              [iOS 앱 (SwiftUI)]  ←── scripts.run API
```

## 데이터 흐름

### 포트폴리오 데이터
1. KIS API → GAS → `투자수익 트래커` 시트 (가격·종목현황 업데이트)
2. iOS → `mobileGetPortfolio()` 호출 → GAS가 시트 읽어서 JSON 반환
3. iOS `PortfolioViewModel`에 캐시 저장 (`CacheService`)

### 참고지표 데이터
1. iOS → `mobileGetReferenceIndicators()` 호출
2. GAS: KIS API로 KOSPI/KOSDAQ/해외지수 조회
3. GAS: Yahoo Finance API로 ES=F, NQ=F 선물 조회
4. GAS: GOOGLEFINANCE 수식으로 VIX/TNX/DXY/금/WTI 조회 (Temp 시트 활용)
5. GAS: `참고지표` 시트 업데이트 + `참고지표_히스토리` upsert
6. JSON 반환 → iOS `IndicatorsView` 표시

## iOS 앱 구조

```
MainTabView (PageTabViewStyle)
├── Tab 0: IndicatorsView  — 참고지표
├── Tab 1: DashboardView   — 포트폴리오 요약
├── Tab 2: HoldingsView    — 종목 목록
└── Tab 3: AnalysisView    — 분류/계좌별 분석
```

- 탭바: 플로팅 캡슐 스타일 (`.ultraThinMaterial`)
- NavigationStack 없음 — PageTabViewStyle과 충돌하여 제거, 커스텀 헤더 사용
- 공유 상태: `PortfolioViewModel.shared` (@EnvironmentObject)

## GAS 주요 파일

| 파일 | 역할 |
|---|---|
| `Config.js` | 전역 상수, REFERENCE_INDICATORS 정의 |
| `MobileAPI.js` | iOS 진입점 함수 전체 |
| `KIS_API.js` | KIS API 호출 (토큰, 국내/해외 주식·지수·선물) |
| `KIS_StockStatus.js` | 종목 현황 업데이트 |
| `Trend.js` | 추이 기록 시트 업데이트 |
| `Main.js` | 통합 업데이트, 메뉴 정의 |
| `push_safe.py` | Secret.js 보호 배포 스크립트 |

## Google Sheets 구조

| 시트 | 용도 |
|---|---|
| 투자수익 트래커 | 종목별 매입·현재가·수익 |
| 추이 기록 | 날짜별 자산 추이 |
| 추이 그래프 | 차트 |
| 참고지표 | 현재 지표값 요약 (A~G열) |
| 참고지표_히스토리 | 날짜별 지표값 누적 |
| Temp | GOOGLEFINANCE 수식 임시 계산용 |
| 투자 분석 | 성과 분석 |
| 거래 입력 | 거래 내역 입력 |
