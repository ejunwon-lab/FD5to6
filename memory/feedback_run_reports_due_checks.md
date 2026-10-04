---
name: feedback-run-reports-due-checks
description: 실행@ 때 pending의 만기 도래(⏰) 확인 항목은 묻지 말고 직접 실측해 결과를 바로 보고
metadata:
  node_type: memory
  type: feedback
  originSessionId: 48bef0b8-beb8-4690-8089-decab74199e3
  modified: 2026-10-04T10:24:07.785Z
---

`실행@`(세션 시작) 시 `docs/pending.md`에 "라이브 확인 잔여"로 남긴 항목 중 확인 시점이 지난 것(⏰ 만기 도래)은, 현황 요약에 그치지 말고 **gh·로그·API로 직접 실측해서 결과(정상/이상)를 그 자리에서 보고**한다. "확인할까요?"·"확인해 주세요"로 넘기지 않는다.

**Why:** 2026-10-04 watchdog 수리 후 사용자가 "니가 알아서 보고해 나중에" → "나중에 내가 실행하라고 하면 니가 결과를 그냥 말해"라고 지시. 사용자는 텔레그램·메일을 일일이 대조하고 싶어 하지 않고, 세션을 켜 둔 채 기다리는 것도 원치 않음(세션 내 예약은 세션 종료 시 소멸).

**How to apply:** 배포 후 사후 확인이 남으면 pending 항목에 ⏰ 날짜와 **확인 명령·기대값**을 구체적으로 적어 둔다(다음 세션의 내가 바로 실행 가능하게). 다음 `실행@`에서 만기 항목을 실측 → 통과면 pending에서 닫고 보고, 실패면 진단까지 하고 보고(수정은 승인 후). 사용자 눈으로만 볼 수 있는 것(텔레그램 실도착·화면)만 이유를 붙여 남긴다. 관련: [[feedback_self_verify_before_handoff]] · [[feedback_no_blocking_waits]]
