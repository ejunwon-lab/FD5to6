# FD5to6 프로젝트 가이드

## 프로젝트 개요
JUN & SOO의 주식 포트폴리오 관리 시스템.
- **Google Sheets + Apps Script**: KIS API로 주식 데이터 수집/업데이트
- **iOS 앱 (SwiftUI)**: 시트 데이터를 읽어 모바일로 포트폴리오 현황 표시

## 디렉토리 구조
```
FD5to6/
├── apps-script/       # GAS 소스 (.js 파일들)
│   ├── push_safe.py   # Secret.js 보호 GAS 배포 스크립트
│   └── *.js           # KIS_API, KIS_StockStatus, Config 등
├── ios/               # SwiftUI iOS 앱
│   └── Sources/
│       ├── App/       # MainTabView
│       ├── Features/  # Dashboard, Holdings, Analysis
│       ├── Models/    # PortfolioModels
│       └── Shared/    # Extensions, Colors
└── docs/
```

## 핵심 규칙

### GAS 배포
- **절대 `clasp push` 직접 실행 금지** — Secret.js가 원격에서 삭제됨
- **반드시 `python3 apps-script/push_safe.py` 사용**
- Secret.js는 로컬에 없고 원격(Google)에만 존재. 절대 건드리지 않음

### iOS 빌드
- XcodeGen 프로젝트 — VS Code SourceKit 에러는 대부분 false positive
- 실제 빌드는 Xcode에서 확인

## 자동 메모리 저장 지시
대화 중 아래 상황이 발생하면 메모리 파일을 자동으로 저장/업데이트:
- 새로운 기능이 완성될 때
- 중요한 설계 결정이 내려질 때
- 버그 원인과 해결책을 발견했을 때
- 사용자가 작업 방식에 대한 피드백을 줄 때

메모리 위치: `/Users/halcyon/.claude/projects/-Users-halcyon-Documents-Claude-2026-FD5to6-ios/memory/`
