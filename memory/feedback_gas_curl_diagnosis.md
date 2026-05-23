---
name: gas-curl-diagnosis
description: GAS Web App deployment 디버깅 시 curl 결과만 신뢰 금지 — Python urllib 등 표준 클라이언트로 교차 검증
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ff11f833-0d22-4b57-ae5a-4dcef779fffc
---

GAS Web App `/exec` URL을 외부에서 POST로 테스트할 때 **curl 결과만 보고 deployment 상태를 단정하지 말 것.** curl(`-L --post302` 등)이 GAS의 302 → googleusercontent.com redirect를 RFC와 다르게 처리해 **405 `allow: HEAD, GET`을 만들어내는데, 이게 "deployment에 doPost 없음"으로 오해되어 진단을 미궁에 빠뜨림.** Python urllib는 같은 URL에 동일 POST 보내면 200을 받음 — 즉 deployment는 정상.

**Why**: 2026-05-23 Telegram webhook 디버깅에서 이 함정으로 1시간+ 헛돌이 + 사용자 강한 분노. 사용자에게 "doPost가 deployment에 없는 것 같다, 새 배포해 달라"를 반복 요청한 게 시간 낭비의 핵심.

**How to apply**:
- GAS Web App POST 디버깅 시 **curl + Python urllib 둘 다** 돌려 결과 비교
- curl이 405인데 Python urllib가 200이면 → deployment는 정상, 진단 방향 잘못된 것
- 사용자에게 "새 배포해 주세요" 같은 행동 요청 전에 반드시 **Python urllib로도 확인**
- 관련 errors.md 항목: 2026-05-23 "Telegram webhook 302/405 — appsscript.json `webapp.access: MYSELF`"

[[gas-webapp-anyone-anonymous]]
