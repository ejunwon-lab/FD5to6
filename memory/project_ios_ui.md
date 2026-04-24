---
name: iOS 앱 UI 현황
description: 현재 구현된 UI 상태, 디자인 결정사항
type: project
originSessionId: 95525fc7-8754-4538-8403-849b3b084bbd
---
현재 구현된 UI 상태 (2026-04-23 기준)

**Why:** VS Code 재시작 시 컨텍스트 복원용

**How to apply:** UI 수정 요청 시 현재 상태 파악에 활용

## 대시보드 (DashboardView)
- 타이틀: "JUN & SOO 투자 현황" (Large Title)
- 상단 카드: 합계수익 + 오늘수익 (별도 RoundedRectangle, cornerRadius: 20)
  - 합계수익: 그라디언트 배경 (파랑→보라)
  - 오늘수익: 플러스=빨강, 마이너스=파랑 배경
  - 숫자 폰트: .system(size: 40, weight: .bold, design: .rounded)
- 하단 카드: 확정수익 / 운용수익 (별도 카드, spacing: 20)
  - 수익률 폰트: .footnote
- updateOverlay: 하단 Capsule 형태

## 종목 (HoldingsView + HoldingCard)
- 기본 정렬: allInfo (종목 정보)
- 탭 순서: 종목정보 / 당일등락 / 평가금액 / 수익률 / 수익금
- 당일등락 정렬: change × quantity 기준
- titleBar: 종목(N) 좌측, 당일등락 뱃지 우측 정렬
- 아코디언: 한 번에 하나만 펼침 (expandedId 바인딩)
- allInfoCard 구조: 헤더(이름|꺽쇠|현재가) → 투자금|평가금액 → 오늘등락 컬러바 → 상세그리드
- 펼치기: withAnimation(.easeInOut(0.25)), .clipped()으로 뒤 글자 차단
- 카드 테두리: Color.primary.opacity(0.18), lineWidth: 0.8 (다크모드 대응)

## 탭 네비게이션 (MainTabView)
- PageTabViewStyle — 네이티브 스와이프
- 커스텀 탭바: ultraThinMaterial, safeAreaInset
- 탭: 대시보드 / 종목 / 분석

## 공통
- 카테고리 뱃지 제거됨
- SourceKit 에러는 XcodeGen false positive — 실제 빌드 무관
