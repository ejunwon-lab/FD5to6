---
name: reference_github_actions_daisy_chain
description: GitHub Actions cron은 고빈도일수록 통째 드롭 — 신뢰 스케줄은 self-dispatch 체인(workflow_dispatch는 GITHUB_TOKEN 재귀방지 예외)
metadata: 
  node_type: memory
  type: reference
  originSessionId: 6020b076-c075-4ed1-9cb3-f5dc304a1520
---

**실측 (FD5to6, 2026-06-08~10)**: GitHub Actions `schedule`은 best-effort — 이 repo에서 고빈도 cron(일 18~21틱)은 **~2틱/일만 발화**(spread해도 동일), 저빈도 cron(일 4틱)은 다 발화하되 **1.5~4h 지연**. cron으로 정시성·발화 보장 둘 다 불가.

**해법 — daisy-chain**: 각 run이 sleep 루프(내부 OS 시계 = 정시) 후 종료 직전 `gh workflow run "$WORKFLOW" -R "$REPO"`로 자기 자신을 dispatch. 핵심 사실:
- **workflow_dispatch·repository_dispatch는 GITHub_TOKEN 재귀 방지 규칙의 명시 예외** → 봇이 자기 워크플로를 트리거 가능. `permissions: actions: write` 필요. (스모크 검증: run 27284601406 → 후속 run actor=github-actions[bot] 생성 확인)
- dispatch는 이벤트 구동이라 cron과 달리 드롭 0건 (실측).
- `concurrency: group + cancel-in-progress: false`로 체인 증식 차단 — cron 백업이 겹쳐 발화해도 pending 1개로 수렴, 취소된 run은 스텝 실행 전이라 dispatch 못 함.
- cron은 체인 사망 시 재시드 백업으로만. 완전 정지는 `gh workflow disable`(run 취소만으론 cron이 재시드).
- dispatch 스텝은 파이프 없이 exit code 직접 검사 + 재시도 ([[feedback_self_verify_before_handoff]], errors.md push|tail 교훈).

적용: `telegram-push.yml` (설계 `docs/plans/2026-06-10-텔레그램-daisy-chain.md`). [[project_market_report_pipeline]]도 지연 문제 동일 — 체인 검증 후 동일 메커니즘 후보.
