# Pending (열린 항목)

완료되면 이 파일에서 삭제하고 해당 세션 문서에 "완료" 기록.

---

## 🟡 확인 필요

- **KIS 해외지수 API 검증** — SPX excd를 SPI→NYS로 수정함. 장중에 SPX/NDX/DJI/SOX KIS 직접 조회 동작 여부 확인 필요 (실패 시 GOOGLEFINANCE fallback)
- **iOS 리빌드 필요** — Xcode에서 ⌘R (분석 화면 전면 개편, 참고지표 C안 레이아웃, HoldingCard 수정 포함)
- **GAS 일회성 실행 필요** — `restoreAJ2fromLastTradingDay()` 함수를 GAS 에디터에서 한 번 실행해 AJ2:AK2 복원 (4/30 목 데이터로)
- **연 환산 차트 예금금리선** — chartOverlay로 플롯 영역 안에만 그리도록 수정. 실제 빌드 후 동작 확인 필요

## 🟢 예정 작업

