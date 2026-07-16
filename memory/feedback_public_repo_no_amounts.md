---
name: feedback_public_repo_no_amounts
description: repo가 PUBLIC이므로 커밋 docs·내 응답에 실제 원화 금액을 쓰지 말 것 (마스킹/비율/반올림)
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 632bf658-b254-428b-8635-f90fdd130a6e
---

`ejunwon-lab/FD5to6`는 **PUBLIC repo**다. 커밋되는 docs와 내 응답에 **실제 금융 수치(순자산·계좌 잔액·실현/운용 손익·매매 금액)를 그대로 쓰면 공개 유출**이다.

**Why:** 2026-07-16, changelog·errors·plans·memory·코드 시드에 실제 원화 금액(순자산 등)이 그대로 커밋돼 공개돼 있던 것을 발견 → git-filter-repo 2회(집계 금액 리터럴 + 시드 실거래 80건)로 히스토리 스크럽 + force push로 정리. 검증 소급 안 되게 처음부터 안 쓰는 게 답.

**How to apply:**
- docs(`changelog`·`errors`·`plans`·`sessions`·`features` 등)·memory·**내 응답 텍스트**에서 금액은 `[금액]`·비율(%)·반올림(≈)·"약 2배" 같은 상대 표현으로만. 정확한 값은 **로컬 시트·`backups/`(gitignore)에만**.
- 코드 시드·테스트 픽스처에 **실데이터 금지 — 합성/라운드 가짜값** 사용.
- 진단·검증은 금액 없는 `Diag.js`(_buildDiag: 날짜·참거짓·개수만) 우선. backup 덤프의 실금액은 필요 최소만 읽고 응답에 원문 그대로 복붙 금지.
- walk-through·검산이 필요하면 비율·구조로 서술(예: "손익=평가−매입 성립", "매입의 약 17배 오염").

관련: [[reference_kakao_account_map]](금액 예시 마스킹) · 미러 백업은 스크럽 시 항상 먼저.
