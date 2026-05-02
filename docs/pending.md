# Pending (열린 항목)

완료되면 이 파일에서 삭제하고 해당 세션 문서에 "완료" 기록.

---

## 🟡 확인 필요

- **코스피200선물 K200F** — 장중에 KIS output1 값 뜨는지 확인 필요. 장 마감 후엔 KRX:KOSPI200(GOOGLEFINANCE) fallback으로 표시됨. GOOGLEFINANCE도 안 뜨면 별도 대응 필요.
- **KIS 해외지수 API 검증** — SPX excd를 SPI→NYS로 수정함. 장중에 SPX/NDX/DJI/SOX KIS 직접 조회 동작 여부 확인 필요 (실패 시 GOOGLEFINANCE fallback)
- **iOS 리빌드 필요** — Xcode에서 ⌘R (전일수익 버그 수정, 참고지표 auto-fetch, 햅틱 수정, 보유기간 소팅 반영)
- **GAS 일회성 실행 필요** — `restoreAJ2fromLastTradingDay()` 함수를 GAS 에디터에서 한 번 실행해 AJ2:AK2 복원 (4/30 목 데이터로)

## 🟢 예정 작업

