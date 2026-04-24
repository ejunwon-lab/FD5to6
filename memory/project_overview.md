---
name: FD5to6 프로젝트 개요
description: 전체 프로젝트 구조, 목적, 주요 파일 위치
type: project
originSessionId: 95525fc7-8754-4538-8403-849b3b084bbd
---
JUN & SOO 주식 포트폴리오 관리 시스템. 두 파트로 구성.

**Why:** 개인 투자 포트폴리오를 Google Sheets로 관리하고, iOS 앱으로 모바일에서 확인하기 위해

**How to apply:** 작업 요청 시 어느 파트(GAS or iOS)인지 먼저 파악하고 적절한 도구/규칙 적용

## 파트 1: Google Apps Script (apps-script/)
- KIS API(한국투자증권)로 국내/해외 주식 현재가, 등락, 52주 고저, 수익률 수집
- Google Sheets "투자수익 트래커" 시트에 데이터 업데이트
- 주요 파일: KIS_API.js, KIS_StockStatus.js, Config.js, MobileAPI.js
- 배포: `python3 apps-script/push_safe.py` (절대 clasp push 직접 실행 금지)
- Secret.js = KIS API 키 포함, 로컬에 없고 원격에만 존재

## 파트 2: iOS 앱 (ios/)
- SwiftUI, XcodeGen 프로젝트
- Google Sheets 데이터를 읽어 포트폴리오 현황 표시
- 탭 구성: 대시보드 / 종목 / 분석
- 주요 파일:
  - Sources/App/MainTabView.swift — 탭 네비게이션 (PageTabViewStyle로 스와이프)
  - Sources/Features/Dashboard/DashboardView.swift — 합계수익, 오늘수익, 확정/운용수익
  - Sources/Features/Holdings/HoldingsView.swift — 종목 목록, 필터, 정렬
  - Sources/Features/Holdings/HoldingCard.swift — 종목 카드 (allInfo/standard 두 가지)
  - Sources/Models/PortfolioModels.swift — Holding, Portfolio 모델
  - Sources/Shared/Extensions.swift — Color.profit(빨강), Color.loss(파랑), profitColor 등

## 색상 컨벤션
한국 주식 컨벤션: 상승=빨강(profit), 하락=파랑(loss)
- Color.profit = Color(red: 0.85, green: 0.10, blue: 0.10)
- Color.loss = Color(red: 0.05, green: 0.35, blue: 0.85)
