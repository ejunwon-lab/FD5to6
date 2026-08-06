---
name: feedback_no_blocking_waits
description: 배포 후 CDN 전파·Pages 빌드 같은 수동 대기를 폴링으로 붙잡지 말 것 — push·워크플로 성공 확인까지만 하고 보고 종료
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a9e3ca7a-e921-4e1a-8ea5-825d7ff22553
  modified: 2026-08-06T11:49:30.890Z
---

배포 검증은 **커밋·push·배포 워크플로 success 확인까지**만 같은 턴에서 하고 즉시 보고를 마친다. CDN 전파, GitHub Pages 빌드, 캐시 만료 같은 "시간만 지나면 되는" 수동 대기를 sleep/until 폴링으로 붙잡고 턴을 끌지 않는다.

**Why:** 2026-08-06 데스크 배포에서 CDN 전파·Pages 빌드를 지켜보느라 대기 루프를 연달아 걸어 십몇 분간 사용자에게 주도권을 돌려주지 않음 → 사용자가 직접 중단시키고 "왜 안 멈추냐"고 지적.

**How to apply:**
- push + `gh run` success 확인 → 바로 보고·턴 종료. "몇 분 뒤 새로고침" 안내로 충분.
- 전파 확인이 꼭 필요하면 다음 사용자 메시지 때 그 시점 상태를 1회 점검 (폴링 금지).
- 예외: 사용자가 명시적으로 "반영될 때까지 확인해줘"라고 요청한 경우만 백그라운드 폴링 1개.
