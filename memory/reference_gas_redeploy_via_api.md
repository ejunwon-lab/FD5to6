---
name: reference_gas_redeploy_via_api
description: GAS 버전 고정 웹앱 배포는 Apps Script API로 자율 재배포 가능 (에디터 수동 클릭 불필요)
metadata: 
  node_type: memory
  type: reference
  originSessionId: 864969ab-74ca-4465-8fbf-a5f884fa7966
---

GAS 웹앱 `/exec`은 버전 고정 배포면 `push_safe.py`(코드만 PUT)로는 안 먹고 새 배포 버전이 필요하다([[feedback_gas_deploy_both]] 계열, errors.md doPost 함정). 과거엔 "에디터 → 배포 관리 → 신규 버전" 사용자 수동작업으로 처리했으나, **Apps Script API로 Claude가 직접** 할 수 있다 — 사용자는 클릭 0.

방법 (token은 `push_safe.py`의 `get_token()`·`api()` 재사용):
1. `POST /v1/projects/{id}/versions {"description": ...}` → 현재 HEAD 콘텐츠 스냅샷 = 새 versionNumber (먼저 push_safe로 HEAD에 코드 PUT 해둘 것)
2. `GET /v1/projects/{id}/deployments` → 배포 목록. `deploymentConfig.versionNumber`가 없으면 **HEAD**(항상 최신, 갱신 불필요), 있으면 고정.
3. 고정 WEB_APP 배포마다 `PUT /v1/projects/{id}/deployments/{deploymentId} {"deploymentConfig":{"versionNumber":새버전,"manifestFileName":"appsscript","description":원본설명}}` → **deploymentId 유지 = /exec URL·웹훅 등록 불변**.

이 프로젝트(v2, SCRIPT_ID는 push_safe.py에 하드코딩) 배포 구성: **HEAD 1개**(WEB_APP+EXECUTION_API, 항상 최신) + **버전 고정 3개**(과거 webhook/m1). 어느 URL을 GAS_WEB_APP_URL이 쓰는지 시크릿이라 못 읽으면 **전부 같은 새 버전으로 갱신**하면 안전(같은 코드베이스). 검증: `GET /content?versionNumber=N`으로 그 버전 소스에 변경 마커 grep.

주의: 고정 배포를 새 버전으로 올리면 그 버전 manifest의 entryPoints를 상속(예: EXECUTION_API가 추가될 수 있음 — access가 MYSELF면 무해). 사용자 성향: 수동 단계도 내가 자율 처리([[feedback_just_do_it]]·[[feedback_self_verify_before_handoff]]).
