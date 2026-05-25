---
name: number-display-full
description: 모든 UI에서 숫자는 절대 축약하지 말고 풀 숫자로 표시 (억/만/M/K 금지)
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e9e7f391-3392-4162-9c42-001fe6a546bc
---

UI에 숫자를 표시할 때 **절대 축약하지 않는다**. `1.23억`·`456만`·`₩1.5M`·`12K` 같은 표기 금지. 항상 `toLocaleString()`로 천 단위 콤마 풀 숫자.

**Why:** 사용자가 명시적으로 "줄여서 표시하는 습관이 있는데, 절대 그렇게 하지마"라고 지시. 포트폴리오 데스크 = 정확한 금액 한 번에 파악이 핵심.

**How to apply:**
- 새 컴포넌트 작성 시 `compact()`·`compactKRW()` 류 함수 만들지 말 것. 그냥 `Math.round(n).toLocaleString()` 또는 `n.toLocaleString()`.
- 기존 `compact*` 헬퍼 사용처도 발견 시 풀 숫자로 교체.
- `docs/pending.md`의 "웹앱 숫자 표시 풀 출력" 항목과 연관 — 사용자 결정이 풀로 확정됨.
- 단가는 소수점 처리 필요한 경우 있음 (US 종목 USD): `$h.avgPrice.toFixed(2)` 같은 정밀도는 유지하되, 자릿수 자체를 줄이지는 말 것.

연관: [[stock-name-primary]]
