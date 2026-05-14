# 2026-05-14 — Mobile API 복구 + 추이 기록 + 운용수익 통일

## 배경

- iOS 앱 `updateNewCurrentPrice is not defined` 에러
- 웹앱 종목 카드 잘못된 값 표시
- 보유 종목 현황 합계와 요약 카드 "오늘의 수익" 값 차이
- 웹앱/iOS 기간별 수익 계산 로직 불일치

## 진단

1. `apps-script-new/MobileAPI.js`가 신시스템 GAS (`apps-script-v2`)로 옮겨지지 않음 — v2 분리(commit `e3433e6`) 때 누락
2. 옛 `MobileAPI.js`는 옛 *보유현황* 23컬럼 가정. 신 15컬럼과 불일치
3. `_mNormCode`, `_normCode`에 패딩 버그 — 앞 0 종목(`005930` 등) 매칭 실패
4. 추이 기록 시트 갱신 함수가 v2에 옮겨지지 않음 (`NS.TREND` 상수 자체 누락)
5. 같은 종목코드 여러 계좌 보유 시 `extraMap` 키 충돌 → 합계 부정확
6. 웹앱 기간 필터는 entries 개수 기준, iOS는 캘린더 일수 기준 → 다른 결과
7. 해외주식 가격이 USD 그대로 *현재가_이력*에 저장 → KRW 환산 누락

## 완료 작업

### GAS (apps-script-v2)

- **MobileAPI.js** v2 신규 작성 (`apps-script-new`에서 이동 + 재작성)
  - `newMobile*` 8개 함수 모두 신 15컬럼 구조로 정렬
  - 누락 필드(change/m1/m3/m6/y1/high52/low52)는 *현재가_이력*에서 직접 계산
  - `_mFindPriceColumn` 헬퍼 추가
- **Trend.js** 신규 — *추이 기록* 시트 갱신
  - 운용중 = 모든 보유 종목 (KIS_SKIP 포함)
  - 대기 = *설정* 시트 합계 행 자동 감지 (A/B열에 "합계"·"소계" 있는 행의 C값)
  - AJ2/AK2: 전일 합계 변동 백업 (장 시작 전 표시용)
- `_normCode` 6자리 패딩 적용
- `_fetchPricesFromKIS`: batch API + 해외주식 KRW 환산
- `updateAllNew`에 `logToTrendSheet` + `buildDashboard` 호출 추가
- 자동 트리거 17:30 (atHour 17 / nearMinute 30) + 메뉴 항목
- `onOpen` 시 *대시보드* 시트 자동 활성화
- `extraMap` 키 `code` → `code+broker+account` (같은 종목 여러 계좌 정확 처리)
- `summary` 운용수익 = 전체 보유 손익 (KIS_SKIP 포함)
- `prevDayChangAmount/Pct`를 *추이 기록* AJ2/AK2에서 읽음

### Dashboard.js

- 정렬 드롭다운 + 매입금액/평가금액 컬럼 복원
- 보유 종목 현황: 19 → 20컬럼 (당일등락액/등락률/손익, 1주일/1달 손익, 1M/3M/6M/1Y)
- 합계 행 추가 (매입/평가/손익/당일손익/1주일/1달)
- 보유 종목 현황 섹션을 요약 다음으로 위치 변경
- 한국식 색상 (상승=빨강, 하락=파랑)
- 모든 숫자 우측 정렬

### iOS

- `AnalysisView`, `StockDetailView`: `Color.accent/.loss/.profit` 명시 (ShapeStyle 에러 수정)
- `StockDetailView` Chart ForEach 분리 (컴파일러 추론 단순화)
- `PortfolioViewModel.profitChange`: history 양 끝 차이 (웹앱과 통일)
- `ProfitHistoryView`: 주말 필터 제거, 일평균을 일별 diff 평균으로
- `HoldingCard`: `onDetail` 콜백 + 보유기간 라인 끝 인라인 버튼

### Web

- `ProfitHistoryChart`: 캘린더 기준 (오늘 − N일) 필터 → iOS와 동일
- `HoldingCard`: `onDetail` 콜백 + 보유기간 라인 끝 인라인 버튼
- `HoldingsPage`의 absolute overlay 제거

### 일회성

- `migrateOverseasUsdToKrw` — 해외 종목 옛 USD 행을 KRW로 환산 (GOOGLEFINANCE 일별 환율)

## 기타

- `apps-script-new/` 폴더 git rm으로 정리
- *추이 기록* 시트 헤더 구조 그대로 사용 (B~L 업데이트별, N~S 일별, U~AF 수익)

## 사용자 피드백 (메모리 저장됨)

- **가정은 코드 짜기 전에 명시** — 데이터 정의·컬럼 의미·매핑 등 가정은 코드 작성 전에 1줄로 명시하고 확인받기 (`feedback_state_assumptions.md`)
