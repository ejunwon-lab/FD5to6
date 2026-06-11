# 설계 노트 — market-report 정시화 (daisy-chain 메커니즘 재사용)

> 2026-06-11 작성. 위험 변경(CI/스케줄 파이프라인) → `/design-check` 게이트.
> 트리거: KR 리포트가 타깃 17:02 KST 대비 +3.3~3.8h 지연 발화(6/9·6/10·6/11 연속). errors.md:36 후보 구체화.

## 배경
- market-report.yml은 **저빈도 cron 4개**(US 08:02/08:42 KST, KR 17:02/17:42 KST). GitHub schedule이 best-effort라 고부하 시 **지연**(드롭은 아님 — 저빈도라 통째 드롭은 안 되나 +1~4h 지연). 장 마감 직후 의사결정 지원 목적 대비 가치 저하.
- telegram-push daisy-chain은 6/11 라이브 검증 통과(체인 ~2h 간격 무중단, cron 의존 0회). **이 체인은 24/7 alive** — 08:02·17:02 KST 양 시각 모두 살아있는 run이 존재(6/11 run 로그로 확인: 22:33→00:31→02:30→04:29→06:28→08:26 UTC 연속).

## 채택 방향 (B+): 검증된 telegram 체인이 market-report를 정시 dispatch + 멱등 가드
- telegram 체인은 이미 24/7로 살아 5분마다 poke 중 → **여기에 "리포트 창 통과 감지 → `gh workflow run market-report.yml` dispatch"를 얹는다.** dispatch는 이벤트 구동이라 cron 지연과 무관(6/8~10 dispatch 드롭 실측 0건).
- market-report.yml은 **거의 안 바뀜**: workflow_dispatch 경로 이미 존재. cron 4개는 **재시드 백업으로 강등**(telegram과 동일 패턴, 삭제 X).

### ⚠️ 핵심 함정: 반복 dispatch → 리포트 재생성 레이스
- poke가 5분마다라 창(17:02~) 통과 후 리포트 commit까지 ~15분간 **3틱이 같은 "파일 없음"을 보고 3중 dispatch** → errors.md:32 "2회 안전망 race"와 정확히 동류(파일 생성 전 중복 생성·push 충돌).
- **회피책 2중**:
  1. market-report.yml에 `workflow_dispatch` 입력 `auto` 추가. `auto=true`면 현재 `schedule` 전용인 "오늘 파일 있으면 skip" 가드를 **dispatch에도 적용**(수동 `auto` 미지정 dispatch는 종전대로 강제 재생성 유지).
  2. market-report.yml에 `concurrency: group: market-report-<type>, cancel-in-progress: false` 추가 → 중복 dispatch는 **1 running + 1 pending으로 수렴**, pending run이 이어받을 때 1번 가드가 커밋된 파일을 보고 skip. → 멱등.

## 1. 외부 동작 가정
- `workflow_dispatch`는 GITHUB_TOKEN 재귀방지 예외 → 체인이 다른 워크플로를 dispatch 가능 → **근거**: telegram 체인이 자기 자신을 self-dispatch 중(6/11 검증). 타 워크플로 dispatch도 동일 `actions: write` 권한 + `gh workflow run`. [실환경 스모크로 재확인]
- telegram 체인은 08:02·17:02 KST에 alive → **근거**: 6/11 run 로그 ~2h 간격 24/7 연속 확인.
- `concurrency` + `cancel-in-progress:false`는 중복을 1 pending으로 수렴 → **근거**: telegram-push.yml:38-40에서 동일 패턴 검증됨.
- GitHub contents API(`gh api repos/.../contents/docs/reports/KR-<date>.md`)로 파일 존재 확인 가능 → 404=없음 → 200=있음. [검증 필요 — 실제 404/200 응답 확인]

## 2. 과거 부류 (errors.md)
- **errors.md:32-35 "2차 run push 충돌 + cron ~4.5h 지연"**: 2회 안전망이 시간 간격 0이 되면 레이스 → push rejected. **회피**: 위 auto-가드+concurrency로 멱등 보장(시각 간격에 의존 안 함). 교훈("멱등 보장을 시각 간격에 의존 말 것") 정면 반영.
- **errors.md:14-15 고빈도 cron 통째 드롭**: market-report는 저빈도라 드롭 아닌 지연. dispatch 전환으로 둘 다 회피.
- **errors.md:36**: 이 항목이 바로 그 후보의 실행 설계.

## 3. 추론 가능 vs 실환경 전용
- **머리로 거름**: dispatch 재귀예외·concurrency 수렴·auto 가드 멱등성·KST 창 계산 로직·체인 alive 시각대(로그 기반). 이 변경이 telegram **push 체인을 깨지 않을 것**(추가 블록을 `|| true`로 격리, 별도 `Dispatch next chain run` 스텝의 `if: success()` 보존).
- **실환경에서만**: ① 실제 dispatch가 타 워크플로를 트리거하는지 ② contents API 404/200 실제 응답 ③ concurrency 수렴이 *타 워크플로 dispatch* 맥락에서도 동일한지 ④ 17:02 창에서 정확히 1회만 실 리포트 생성되는지(레이스 회피 실측). → **추론으로 "됨" 판정 금지, dry_run+스모크로만.**

## 4. 검증 방법
- **자동(코딩 후)**:
  - YAML 문법: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/market-report.yml'))"` (telegram도 동일).
  - `auto=true` dry_run dispatch → 가드가 "이미 발송됨 skip" 또는 정상 생성하되 commit/send 안 함 확인.
  - 스모크: telegram 체인에 dispatch 블록 넣고, 임의 시각에 강제로 창 조건 만족시켜 market-report가 `actor=github-actions[bot]`로 dispatch되는지 1회 확인.
- **🔴 사용자 확인 / 라이브 실측**:
  - **어디**: `gh run list --workflow=market-report.yml` + Telegram.
  - **무엇**: 다음 거래일 KR 리포트가 **17:0x~17:1x KST**(창 +10분 내)에 발화·도착하는지(현 ~20:4x 대비). run 1개만 success + 나머지 pending/skip(중복 0).
  - **어떻게**: 거래일 17시대 관찰.
  - **예상값**: KR 리포트 Telegram 17:1x KST 도착, `docs/reports/KR-<date>.md` 17:1x 커밋, cron run은 concurrency로 흡수.

→ **게이트: 통과 (코딩 진행 가능).** 단 가정 4-①②④는 "실환경 전용"이라 dry_run+스모크 통과 전엔 "검증 완료" 주장 금지. 4-④(레이스 1회성)가 최우선 실측 포인트.

## 미해결 선택지 (사용자 결정 필요)
- **B+ (위, 추천)**: telegram 체인에 dispatch 얹기. 최소 변경·검증된 체인 재사용. 리스크: 갓 검증된 telegram-push.yml 수정(격리로 완화).
- **A (대안)**: market-report 독립 체인 구성. 관심사 분리·telegram 무영향. 비용: 대규모 재작성 + "poke 중 인라인 생성" 신규 미검증 로직.
- **C (보수)**: dispatch 전환 없이 push 직전 `git pull --rebase` 재시도만 추가 → 레이스는 막지만 **지연은 못 고침**. 정시화 목적 미달.
