# Pending (열린 항목)

완료되면 이 파일에서 삭제하고 해당 세션 문서에 "완료" 기록.

---

## 🔴 긴급

- **iOS 빌드 에러** — Xcode에서 빌드 실패. 에러 메시지 미공유 상태. 원인 미파악.

## 🟡 확인 필요

- **KIS 해외지수 API 검증** — `getOverseasIndex()` (tr_id: HHDFS00000300)가 SPX/NDX/DJI/SOX에 실제로 동작하는지 확인
- **KIS 국내선물 API 검증** — `getDomesticFutures()` (tr_id: FHMIF10000000, 코드: 101W2606)가 동작하는지 확인
- **금/WTI 심볼 확인** — `COMEX:GC1!`, `NYMEX:CL1!`이 GOOGLEFINANCE에서 동작하는지 확인
- **달러인덱스(DXY)** — `DX-Y.NYB` 심볼 동작 여부 확인

## 🟢 예정 작업

- **Google Sheets Named Range 설정** — 🛠️ 시스템 관리 → Named Range 초기 설정 실행 필요 (TREND_OP_TOTAL, TREND_PEND_TOTAL)
- **참고지표 iOS UI 개선** — TNX 값 표시 방식 (43.23 → 4.32%로 변환 표시 여부)
