#!/usr/bin/env python3
"""
GAS 버전 고정 웹앱 재배포 — HEAD 콘텐츠로 새 버전 생성 + 고정 WEB_APP 배포들을 그 버전으로 갱신.
push_safe.py로 HEAD에 코드 PUT 한 뒤 실행한다. deploymentId 유지 → /exec URL 불변.
참조: memory/reference_gas_redeploy_via_api.md

사용법: python3 scripts/gas_redeploy.py "<버전 설명>" [검증마커]
  검증마커 주면 새 버전 소스에 그 문자열 존재까지 확인.
"""
import json, sys, time
from pathlib import Path
import requests

SCRIPT_ID = "1DC8llpWYz2ZvzsqVCaz60qomATwxP_CBzuHBitCf0uQT5NbBF-n7IHdZ"
CLASPRC = Path.home() / ".clasprc.json"


def get_token():
    data = json.loads(CLASPRC.read_text())
    if "tokens" in data:
        k = list(data["tokens"].keys())[0]; tok = data["tokens"][k]
        cid, csec = tok["client_id"], tok["client_secret"]
    else:
        k = None; tok = data["token"]; oc = data.get("oauth2ClientSettings", {})
        cid, csec = oc["clientId"], oc["clientSecret"]
    if tok.get("expiry_date", 0) / 1000 - time.time() < 60:
        r = requests.post("https://oauth2.googleapis.com/token", data={
            "client_id": cid, "client_secret": csec,
            "refresh_token": tok["refresh_token"], "grant_type": "refresh_token"})
        tok["access_token"] = r.json()["access_token"]
        tok["expiry_date"] = int((time.time() + r.json()["expires_in"]) * 1000)
        if k is not None: data["tokens"][k] = tok
        else: data["token"] = tok
        CLASPRC.write_text(json.dumps(data, indent=2))
    return tok["access_token"]


def api(method, url, token, body=None):
    r = requests.request(method, url, headers={"Authorization": f"Bearer {token}"}, json=body)
    if not r.ok:
        print(f"HTTP {r.status_code}: {r.text}"); sys.exit(1)
    return r.json()


def main():
    desc = sys.argv[1] if len(sys.argv) > 1 else "redeploy"
    marker = sys.argv[2] if len(sys.argv) > 2 else None
    token = get_token()
    base = f"https://script.googleapis.com/v1/projects/{SCRIPT_ID}"

    ver = api("POST", f"{base}/versions", token, {"description": desc})["versionNumber"]
    print(f"✓ 새 버전 생성: v{ver} ({desc!r})")

    if marker:
        src = api("GET", f"{base}/content?versionNumber={ver}", token)
        joined = "\n".join(f.get("source", "") for f in src.get("files", []))
        if marker in joined:
            print(f"✓ 마커 '{marker}' 새 버전 소스에 실재")
        else:
            print(f"❌ 마커 '{marker}' 없음 — 배포 중단"); sys.exit(1)

    deps = api("GET", f"{base}/deployments", token).get("deployments", [])
    updated = 0
    for d in deps:
        dc = d.get("deploymentConfig", {})
        if dc.get("versionNumber") is None:
            continue  # HEAD — 갱신 불필요
        if not any(e.get("entryPointType") == "WEB_APP" for e in d.get("entryPoints", [])):
            continue
        did = d["deploymentId"]
        api("PUT", f"{base}/deployments/{did}", token, {"deploymentConfig": {
            "versionNumber": ver, "manifestFileName": "appsscript",
            "description": dc.get("description", "")}})
        updated += 1
        print(f"  └─ 배포 갱신 → v{ver}  (id ...{did[-10:]}, {dc.get('description','')[:30]!r})")
    print(f"✓ 고정 WEB_APP 배포 {updated}개 v{ver}로 갱신 완료 (URL 불변)")


if __name__ == "__main__":
    main()
