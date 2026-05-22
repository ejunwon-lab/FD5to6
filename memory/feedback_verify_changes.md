---
name: feedback-verify-changes
description: "모든 변경 보고에 \"## 검증\" 섹션 필수 — 자동 검증 + 사용자 확인 안내"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 54e226a2-49c3-468f-b2e6-5e6e3db43386
---

코드 변경 보고는 **"## 검증"** 섹션을 반드시 포함한다. "X 고침"으로 끝내지 않는다. 자동 검증(node --check / vitest / tsc / walk-through) 결과를 명시하고, 사용자 확인이 필요하면 "어디·무엇·어떻게·예상값" 4요소로 안내.

**Why:** 검증 단계 누락이 감사 세션의 주된 사고 패턴이었음 (syncHolidays 스승의날, 다계좌 손익 빈칸 등). 보고에 검증 섹션을 강제하면 누락이 구조적으로 줄어듦. 2026-05-22 사용자 확정.

**How to apply:**
- 변경 분류(W-1/2·G-1/2/3·I-1·C-1) → CLAUDE.md "변경 검증 절차" 매트릭스의 자동 검증 + 사용자 확인 적용
- GAS 순수/시트/외부 로직(G-1·G-2·G-3) 변경 시 구체 입력→예상 출력 **walk-through 1건+** 응답에 포함
- 사용자 확인 필요 항목은 또렷이(굵게·🔴). 응답 전 멈추지 않음(완화 정책) — 흐름은 유지하되 미해결 가시화
- 자동 검증 실패 시 배포·커밋 안 함. 사용자 검증 실패 보고 받으면 walk-through부터 재진단
