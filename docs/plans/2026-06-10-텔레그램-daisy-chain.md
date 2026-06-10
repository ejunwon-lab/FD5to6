# 설계 노트 — telegram-push daisy-chain 전환 (+ GAS 관측성·현금성 동승) 2026-06-10

> `/design-check`. 위험: **CI 파이프라인(telegram-push.yml) + GAS 서버코드(doPost 경로) + 배포**.
> 배경: F 구조(spread cron)가 6/10 오후 실측으로 반증됨 — spread 수정(00:48Z) 후 잔여 18틱 중 **2틱만 발화**(05:15Z·09:02Z, 둘 다 격자 이탈 지연 발화). "다음 틱 ~20분 내 시작" 전제가 이 repo에서 성립 안 함. 같은 날 market-report(저빈도 cron 4개)는 전부 발화(단 1.5~3.8h 지연) → **고빈도 cron일수록 통째 드롭** 패턴.
> 프레임: 6/9 교훈 "best-effort 의존 횟수를 줄여라"의 극한 — 21틱 → **정상상태 0틱** (체인이 자기 자신을 잇고, cron은 체인 사망 시 재시동 백업으로만).

## 설계

```
[수동/cron 시드 1회] → run N: (concurrency 게이트) → 120분 sleep 루프(5분 poke, 기존 동일)
                          → 종료 직전 gh workflow run으로 run N+1 dispatch → exit
```
- **24/7 체인**: 장외에도 체인 유지(다음날 아침 cron 의존 제거가 목적). 장외 poke는 GAS가 즉시 skip — 비용 무시 가능(~288 doPost/일, 웹앱 실행 상한 대비 미미).
- **체인 중복 방지**: GitHub 네이티브 `concurrency: group telegram-push, cancel-in-progress: false` — 체인 생존 중 cron 백업이 발화하면 pending 큐에 머물다 GitHub이 그룹당 1개만 유지(잉여는 자동 취소). 커스텀 락 코드 0줄, 레이스 GitHub이 해결.
- **체인 정지법**(주석으로 문서화): run 취소만으론 cron이 재시드 → 완전 정지는 `gh workflow disable telegram-push.yml`.
- **dispatch 실패**: 3회 재시도(10s 간격), 전부 실패 시 exit 1(가시화) → cron 백업이 재시드.
- **GAS 관측성 동승**: `tgPushPnL`이 결과 문자열 반환(`sent`/`skip-dedup`/`skip-offhours`/`skip-holiday`/`skip-lock`), `_tgHandlePushPost`가 `{success:true, result:"…"}`로 에코 → GitHub 로그만으로 발송/스킵 적중률 측정 가능(6/9 교훈 "측정 없는 잘 됨은 추측").
- **GAS 현금성 비중 동승**: `getPortfolioMetrics` 분모에 `_trGetPendingTotal`(*설정* 대기자금) 합산 + `assetClassWeights['현금성']` 추가 → MDD(sumTotal=보유+대기)와 분모 일치 + 리스크 레이더에 수비 여력 표시.

## 1. 외부 동작 가정 + 근거

- **GITHUB_TOKEN으로 자기 workflow_dispatch 가능** → GitHub 문서: GITHUB_TOKEN 유발 이벤트는 새 run을 만들지 않지만 **workflow_dispatch·repository_dispatch는 예외**(재귀 방지 규칙의 명시 예외). `permissions: actions: write` 필요. → `[검증 필요 — 스모크 1회: minutes=1 run이 후속 run을 실제 dispatch하는지]`
- **workflow_dispatch는 best-effort 아님**(이벤트 구동, 큐 즉시 진입) → 근거: 6/8~6/10 수동 dispatch 전부 즉시 시작(00:42Z·6/9 11:52Z 등 실측). cron만 드롭되고 dispatch는 드롭 사례 0.
- **concurrency group이 잉여 run을 자동 정리(그룹당 in-progress 1 + pending 1)** → GitHub 문서 동작. 취소된 pending run은 스텝 실행 전 취소라 dispatch 안 함 → 체인 증식 불가. → `[검증 필요 — 실환경: 다음 cron 발화 시 pending→취소 관찰]`
- **gh CLI가 ubuntu-latest에 사전 설치 + GH_TOKEN env로 인증** → GitHub 호스티드 러너 표준 구성(사실).
- **GAS 웹앱 poke 24/7 무해** → tgPushPnL 게이트(거래일→시간대)가 장외 즉시 반환. 웹앱 doPost는 트리거 90분/일 쿼터와 무관(요청 구동).

## 2. 과거 부류 (errors.md)

- **"schedule best-effort 21중2" (6/9) + "spread 후에도 18중2" (6/10 본 노트)** → 이 설계의 존재 이유. cron 의존을 정상상태 0으로.
- **"git push|tail이 실패 가림" (6/10)** → dispatch 스텝은 파이프 없이 exit code 직접 검사 + 재시도.
- **"PoP 403 Cloudflare 함정" (6/9)** → 회피: 연결 입증된 GitHub→GAS 경로 유지(CF 미사용).
- **"-X POST 405" (6/6)** → poke curl 변경 없음(기존 검증된 형태 유지).
- dispatch·concurrency 자체의 과거 에러: 없음 (grep 확인).

## 3. 추론 가능 vs 실환경 전용

- **머리로 거름**: 체인 증식 불가(취소된 run은 dispatch 못 함) · dispatch 실패 시 cron 백업 수렴 · GAS dedup이 체인 겹침/재시드 중복을 흡수(기존 입증) · 관측성 필드는 소비자 파서 없음(로그 echo만)이라 하위 호환 · 현금성 추가는 kr-prompt가 자산군을 일반 포맷으로 다뤄 안전.
- **실환경에서만**: ① GITHUB_TOKEN self-dispatch 실제 작동 ② concurrency 잉여 정리 실거동 ③ 체인 장기 생존율(러너 사망 빈도) → ①은 오늘 스모크, ②③은 6/11 로그 관찰로.

## 4. 검증 방법

- 자동(오늘):
  - `node --check`(push_safe 내장) + GAS walk-through: ⓐ 09:00 poke `sent` 반환 → `{success:true,result:"sent"}` ⓑ 09:05 poke → `skip-dedup` ⓒ 23:50 poke → `skip-offhours` ⓓ getPortfolioMetrics: 보유합 90M+대기 10M → 주식 종목 K=9M이면 weight 9.0%, 현금성 10.0%, 합 100%.
  - v13 버전 고정 배포 3개 갱신 후 **API `GET /content?versionNumber=13`으로 마커 grep**(reference_gas_redeploy_via_api 절차).
  - **스모크**: `gh workflow run telegram-push.yml -f minutes=1` → 1분 루프 후 dispatch → **후속 run이 event=workflow_dispatch, actor=github-actions[bot]로 생성**되면 통과. 후속 run은 그대로 프로덕션 체인 시드(내일 아침 커버).
  - 스모크 poke 응답에 `result:"skip-offhours"`(현재 장외) 확인 = 관측성 동시 검증.
- 사용자(6/11 목):
  - **Telegram**에서 09:00~09:05 첫 푸시 + 이후 ~20분 간격 — 예상: 09시대 3회 내외.
  - (보조) `gh run list --workflow=telegram-push.yml`에 체인 run이 2시간 간격 연속 — 제가 로그로 대신 확인 가능.

→ **게이트: 통과** (잔여 `[검증 필요]` 2건은 오늘 스모크·6/11 관찰로 계획 명시됨)
