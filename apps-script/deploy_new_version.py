#!/usr/bin/env python3
"""
Auto-deploy a new version to existing Web App deployment.
- 기존 Web App deployment 의 URL 을 유지하면서 새 version 으로 업데이트
- 사용자가 GAS UI 에서 '배포 관리 → 새 버전' 클릭 안 해도 됨

Usage:
  python3 deploy_new_version.py          # 구 시스템 (기본값)
  python3 deploy_new_version.py new      # 신 시스템
"""
import json, sys, time
from pathlib import Path
import requests

SCRIPTS = {
    "old": "12MAcPpoVE39N_Sz0B79G0rjGvevJ8-S_ibVC1Ot61fyVPZnaSQmrJyiR",
    "new": "1DC8llpWYz2ZvzsqVCaz60qomATwxP_CBzuHBitCf0uQT5NbBF-n7IHdZ",
}
CLASPRC = Path.home() / ".clasprc.json"


def get_token() -> str:
    data  = json.loads(CLASPRC.read_text())
    token = list(data["tokens"].values())[0]
    if token.get("expiry_date", 0) / 1000 - time.time() < 60:
        params = {
            "client_id":     token["client_id"],
            "client_secret": token["client_secret"],
            "refresh_token": token["refresh_token"],
            "grant_type":    "refresh_token",
        }
        r   = requests.post("https://oauth2.googleapis.com/token", data=params)
        new = r.json()
        token["access_token"] = new["access_token"]
        token["expiry_date"]  = int((time.time() + new["expires_in"]) * 1000)
        data["tokens"][list(data["tokens"].keys())[0]] = token
        CLASPRC.write_text(json.dumps(data, indent=2))
    return token["access_token"]


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else "old"
    if target not in SCRIPTS:
        print(f"Usage: deploy_new_version.py [old|new]")
        sys.exit(1)
    script_id = SCRIPTS[target]
    token     = get_token()
    base      = f"https://script.googleapis.com/v1/projects/{script_id}"
    headers   = {"Authorization": f"Bearer {token}"}

    # 1. 기존 Web App deployment 찾기
    r = requests.get(f"{base}/deployments", headers=headers)
    if not r.ok:
        print(f"List deployments failed: {r.status_code} {r.text}")
        sys.exit(1)
    deployments = r.json().get("deployments", [])
    web_app = None
    for d in deployments:
        cfg = d.get("deploymentConfig", {})
        # HEAD/read-only deployment 는 versionNumber 가 None — 건너뜀
        if cfg.get("versionNumber") is None:
            continue
        for ep in d.get("entryPoints", []):
            if ep.get("entryPointType") == "WEB_APP":
                web_app = d
                break
        if web_app: break
    if not web_app:
        print("No editable Web App deployment found.")
        sys.exit(1)

    deployment_id = web_app["deploymentId"]
    cfg           = web_app.get("deploymentConfig", {})
    print(f"Web App deployment: {deployment_id[:20]}... (current version: {cfg.get('versionNumber')})")

    # 인자로 버전 받으면 그 버전으로 rollback
    target_version = int(sys.argv[2]) if len(sys.argv) > 2 else None
    if target_version is None:
        # 새 version 생성
        r = requests.post(f"{base}/versions", headers=headers, json={"description": "auto-deploy"})
        if not r.ok:
            print(f"Create version failed: {r.status_code} {r.text}")
            sys.exit(1)
        target_version = r.json()["versionNumber"]
        print(f"New version: {target_version}")

    # deployment 업데이트
    new_config = {
        "scriptId":         script_id,
        "versionNumber":    target_version,
        "manifestFileName": cfg.get("manifestFileName", "appsscript"),
        "description":      cfg.get("description", ""),
    }
    r = requests.put(
        f"{base}/deployments/{deployment_id}",
        headers=headers,
        json={"deploymentConfig": new_config},
    )
    if not r.ok:
        print(f"Update deployment failed: {r.status_code} {r.text}")
        sys.exit(1)
    print(f"Deployment updated. Version {cfg.get('versionNumber')} → {target_version}")


if __name__ == "__main__":
    main()
