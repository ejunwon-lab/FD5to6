# Pending (열린 항목)

완료되면 이 파일에서 삭제하고 해당 세션 문서에 "완료" 기록.

---

## 🔴 긴급

- **iOS 빌드 에러** — Xcode에서 빌드 실패. 에러 메시지 미공유 상태. 원인 미파악. (SourceKit 에러는 false positive)

## 🟡 확인 필요

- **코스피200선물 KIS API 응답 구조** — Logger 추가해둠. `🌐 참고지표 갱신` 실행 후 Apps Script 실행 로그에서 `국내선물 응답` 내용 확인 필요
- **KIS 해외지수 API 검증** — `getOverseasIndex()` (tr_id: HHDFS00000300)가 SPX/NDX/DJI/SOX에 실제로 동작하는지 확인 (실패 시 Yahoo Finance fallback 동작)

## 🟢 예정 작업

- **Google Sheets Named Range 설정** — 🛠️ 시스템 관리 → Named Range 초기 설정 실행 필요 (TREND_OP_TOTAL, TREND_PEND_TOTAL)
- **TNX 값 표시** — 현재 43.23 표시 (실제 금리 4.32%). 변환 표시 여부 미결정
