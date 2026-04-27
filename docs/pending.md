# Pending (열린 항목)

완료되면 이 파일에서 삭제하고 해당 세션 문서에 "완료" 기록.

---

## 🟡 확인 필요

- **코스피200선물 K200F** — 장중에 KIS output1 값 뜨는지 확인 필요. 장 마감 후엔 KRX:KOSPI200(GOOGLEFINANCE) fallback으로 표시됨. GOOGLEFINANCE도 안 뜨면 별도 대응 필요.
- **KIS 해외지수 API 검증** — SPX excd를 SPI→NYS로 수정함. 장중에 SPX/NDX/DJI/SOX KIS 직접 조회 동작 여부 확인 필요 (실패 시 GOOGLEFINANCE fallback)

## 🟠 한 번만 해야 할 것

- **매일 8:30 자동실행 트리거 등록** — GAS 시트 메뉴 `🛠️ 시스템 관리` → `⏰ 매일 8:30 자동실행 등록` 클릭 (1회)

## 🟢 예정 작업

