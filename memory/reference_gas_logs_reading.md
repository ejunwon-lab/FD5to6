---
name: reference_gas_logs_reading
description: GAS 실행 로그·실행 시간을 로컬에서 읽는 법 — Cloud Logging entries:list (시트를 못 읽는 맥에서도 실측 가능)
metadata:
  type: reference
---

GAS의 `Logger.log` 줄은 Cloud Logging에 남는다(보존 약 30일). `push_safe.py`의 `get_token()`으로 받은 토큰으로 `POST https://logging.googleapis.com/v2/entries:list` 를 부른다.

- `resourceNames`: 앱 OAuth 프로젝트(번호는 [[reference_api_metrics_app_calls]]의 Cloud Monitoring 조회와 같은 프로젝트).
- `filter`: `resource.type="app_script_function" AND timestamp>="…Z"` + `jsonPayload.message:"찾을 말"`, 오류만은 `severity>=ERROR`.
- 본문은 `jsonPayload.message`. `jsonPayload.serviceContext`에는 배포 식별자가 들어 있으니 출력하지 않는다. `serviceContext.version`이 있으면 웹앱(고정 배포) 경로, 없으면 트리거(원본) 경로.
- 구 시스템(v1) 프로젝트의 로그도 같은 곳에 섞인다 → `serviceContext.service`나 `labels.script.googleapis.com/deployment_id`가 지금 프로젝트의 배포 목록에 없으면 다른 프로젝트.
- 실행 시간은 로그에 없다. `○○ 시작`·`○○ 완료` 두 줄의 시각 차이로 잰다(2026-11-21: 장중 갱신 중앙값 44초). GAS v40부터는 `updateAllNew 소요:` 줄에 단계별 시간이 찍힌다.
- 쓸모: 종가 잠금(`closeLock:`)·아침 대조(`closeCheck:`)·알림(`amAlert:`)·소급 보정(`backfill:`) 같은 `실행@` 만기 실측, 배포 직후 트리거가 계속 도는지 확인.

조회 스크립트는 아직 저장소에 없다(세션 임시 폴더에서 매번 만듦 — 저장소의 `scripts/`에 두는 것이 열린 항목).
