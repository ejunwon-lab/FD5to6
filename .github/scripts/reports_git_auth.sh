#!/usr/bin/env bash
# 비공개 리포트 저장소(docs/reports)에 push 하는 단계에서만 배포 키를 쓴다.
#   사용: 단계의 env 에 REPORTS_DEPLOY_KEY 를 주고, run 의 첫 줄에서  source .github/scripts/reports_git_auth.sh
# 체크아웃은 persist-credentials: false 라서 리포트를 쓰는 AI 단계가 도는 동안에는 러너에 키가 남아 있지 않다.
# 키는 러너 임시 폴더의 파일로만 두고(작업 끝에 러너와 함께 사라짐) 로그에 찍지 않는다.
if [ -z "${REPORTS_DEPLOY_KEY:-}" ]; then
  echo "reports_git_auth: REPORTS_DEPLOY_KEY 없음 — push 불가" >&2
  return 1 2>/dev/null || exit 1
fi
_RK="${RUNNER_TEMP:-/tmp}/reports_deploy_key"
( umask 077; printf '%s\n' "$REPORTS_DEPLOY_KEY" > "$_RK" )
export GIT_SSH_COMMAND="ssh -i $_RK -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=${RUNNER_TEMP:-/tmp}/reports_known_hosts"
unset _RK
