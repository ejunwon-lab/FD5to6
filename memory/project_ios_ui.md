---
name: iOS 앱 UI 현황
description: 현재 구현된 UI 상태, 디자인 결정사항
type: project
---
last updated: 2026-04-25

**Why:** VS Code 재시작 시 컨텍스트 복원용
**How to apply:** UI 수정 요청 시 현재 상태 파악에 활용

## 대시보드 (DashboardView)
- **세로 페이징** 구조: Page1(기존 대시보드) / Page2(기간별 수익)
  - GeometryReader + ScrollView(.vertical) + .scrollTargetBehavior(.paging)
- Page1: 타이틀 "JUN & SOO 투자 현황" + 합계수익 카드 + 오늘수익 카드 + 확정/운용 카드
- Page2 (ProfitHistoryView):
  - 기간 선택: 1주/1달/3달/6달
  - 날짜 범위 표시 (M/d (E) 형식)
  - 기간 수익 금액 카드 (수익=빨강, 손실=파랑)
  - 수익 추이 라인+영역 차트 (Swift Charts, 주말 제외)
  - 일평균 / 최고 하루 / 최저 하루 스탯 (주말 제외)
  - 데이터: GAS mobileGetProfitHistory() → 추이 기록 Section C (최근 180개)

## 종목 (HoldingsView + HoldingCard)
- 기본 정렬: allInfo
- 탭: 종목정보 / 당일등락 / 평가금액 / 수익률 / 수익금
- 카드 테두리: 당일 등락 방향으로 빨강/파랑, lineWidth: 1.8
- allInfoCard: 헤더 → 투자금|평가금액 → 오늘등락 컬러바 → 상세그리드

## 탭 네비게이션 (MainTabView)
- PageTabViewStyle — 네이티브 스와이프
- 커스텀 탭바: ultraThinMaterial, safeAreaInset
- 탭: 대시보드 / 종목 / 분석

## 공통
- SourceKit 에러는 XcodeGen false positive — 실제 빌드 무관
- 새 파일 추가 후 xcodegen generate 필요
