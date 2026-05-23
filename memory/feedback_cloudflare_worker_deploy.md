---
name: cloudflare-worker-deploy
description: Cloudflare Workers는 secret 추가 시 새 version만 만들고 active deployment는 옛 버전 유지 — 수동 promote 필수
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ff11f833-0d22-4b57-ae5a-4dcef779fffc
---

Cloudflare Workers 대시보드에서 Variables and Secrets에 secret을 추가/변경하면 **새 version**은 생성되지만 active deployment는 *추가 전 버전*을 유지함. UI에 "deploy required" 알림 없음. 결과적으로 runtime의 env.X가 여전히 undefined → "worker misconfigured" 류 에러 무한 반복.

**Why**: 2026-05-23 Telegram Worker proxy 셋업 중 이 함정에 빠져 30분 헤맴. Variables and Secrets 페이지에선 "Value encrypted"로 정상 저장된 듯 보이는데 실제 runtime엔 적용 안 됨.

**How to apply**:
- Worker 디버깅 시 env.X가 비어있는 듯하면 **Deployments 탭 → Version History** 확인
- 최신 version("Add secret: ..." 같은 entry) 옆에 active 표시(파란 막대)가 없으면 → 우측 `···` → "Deploy this version" 수동 실행
- Cloudflare 문서엔 "secrets propagate immediately"라 적혀있지만 새 version을 active로 만들어야 적용됨

[[gas-curl-diagnosis]]
