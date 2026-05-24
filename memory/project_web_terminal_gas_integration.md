---
name: web-terminal-gas-integration
description: 신시스템(apps-script-v2)과 연동 중인 4개 클라이언트와 각각의 호출 함수·핵심 필드
metadata: 
  node_type: memory
  type: project
  originSessionId: ff11f833-0d22-4b57-ae5a-4dcef779fffc
---

신시스템(`apps-script-v2`) 1개 GAS 프로젝트에 4개 클라이언트가 붙음. 구시스템(`apps-script/`) 사용 안 함.

**Script ID 동일** (모든 클라이언트):
`1DC8llpWYz2ZvzsqVCaz60qomATwxP_CBzuHBitCf0uQT5NbBF-n7IHdZ`

## 4개 클라이언트

| # | 클라이언트 | 위치 | 연동 방식 | 호출 함수 |
|---|---|---|---|---|
| 1 | **web-terminal** | `web-terminal/src/api/gasApi.ts` | OAuth + scripts:run (devMode) | getPortfolio·getIndicators·getProfitHistory·getMonthlyRealized (4개 라이브 사용) |
| 2 | **web** (기존 PWA) | `web/src/api/gasApi.ts` | OAuth + scripts:run (devMode) | 9개 (+ getStockDetail·triggerUpdate·updateFull·updateFast·updateAll) |
| 3 | **Telegram** | `apps-script-v2/Telegram.js` | Cloudflare Worker → GAS doPost(internal) | 내부 호출: newMobileGetPortfolio·updateNewPriceHistory·updatePositionFromLedger |
| 4 | **iOS** (ios2) | `ios2/Sources/Core/ScriptAPIService.swift` | OAuth + scripts:run | 8개 (Portfolio·UpdateCurrentPrice·UpdateHistory·UpdateAll·Indicators·StockDetail·MonthlyRealized·ProfitHistory) |

**중요**: Telegram만 외부 클라이언트가 아닌 GAS 내부(doPost)에서 자기 함수를 호출. 나머지 셋은 외부 API.

## 데이터 위치 함정 (자주 헷갈림)

- **환율(USD/KRW, GBP/KRW)**: `newMobileGetPortfolio`의 *최상위* `usdRate`/`gbpRate` 필드. Settings 시트 B2(USD), B3(GBP)에서 읽음 ([MobileAPI.js:596-605])
- `newMobileGetIndicators`엔 **환율 없음** (DXY=달러인덱스만)
- `NEW_REFERENCE_INDICATORS` 배열은 KOSPI/KOSDAQ/SPX/NDX/DJI/SOX/ES/NQ/GC/CL/VIX/TNX/DXY + 빅테크 7개 + HSI

## 한 곳을 고치면 영향받는 클라이언트

GAS 함수(특히 `newMobileGetPortfolio` 응답 구조)를 바꾸면 4개 클라이언트 모두 영향. 응답 필드 추가는 안전, 삭제·이름 변경은 위험. 새 필드 추가 시 4 클라이언트 중 어디가 그 필드를 쓰는지 확인.

**Why**: 사용자가 정확히 지적한 부분. 다음 세션부터 GAS 응답 변경 시 자동으로 4개 클라이언트 영향 점검.

**How to apply**: GAS MobileAPI.js의 응답 필드를 추가/변경할 때 위 표 참조해 어느 클라이언트에 영향가는지 미리 짚을 것.

[[gas-curl-diagnosis]]
[[no-overconfident-claims]]
