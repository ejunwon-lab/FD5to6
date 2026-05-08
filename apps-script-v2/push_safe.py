#!/usr/bin/env python3
"""
GAS push (새 시스템 전용) — Secret.js 보호 배포 스크립트
- 원격 프로젝트 GET → Secret.js 메모리 보존
- 로컬 .js / appsscript.json으로 교체
- PUT으로 전송 (Secret.js 포함, 디스크 미기록)

사용법:
  1. SCRIPT_ID에 새 시트의 Apps Script 프로젝트 ID 입력
     (새 시트 → 확장 프로그램 → Apps Script → 프로젝트 설정 → 스크립트 ID)
  2. python3 apps-script-v2/push_safe.py
"""
import json, sys, time
from pathlib import Path
import requests

# ▼▼▼ 새 시트의 Script ID로 교체하세요 ▼▼▼
SCRIPT_ID = "1DC8llpWYz2ZvzsqVCaz60qomATwxP_CBzuHBitCf0uQT5NbBF-n7IHdZ"
# ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

PROTECTED = {"Secret"}
CLASPRC   = Path.home() / ".clasprc.json"


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
        print("  (token refreshed)")

    return token["access_token"]


def api(method: str, url: str, token: str, body=None):
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.request(method, url, headers=headers, json=body)
    if not r.ok:
        print(f"HTTP {r.status_code}: {r.text}")
        sys.exit(1)
    return r.json()


def main():
    if not SCRIPT_ID:
        print("❌ SCRIPT_ID가 비어있습니다.")
        print("   새 시트 → 확장 프로그램 → Apps Script → 프로젝트 설정에서 Script ID를 복사해")
        print("   push_safe.py의 SCRIPT_ID = \"\" 부분에 입력하세요.")
        sys.exit(1)

    script_dir = Path(__file__).parent
    token = get_token()
    base  = f"https://script.googleapis.com/v1/projects/{SCRIPT_ID}"

    remote_files = {f["name"]: f for f in api("GET", f"{base}/content", token).get("files", [])}

    pushed = []
    for js in sorted(script_dir.glob("*.js")):
        name = js.stem
        if name in PROTECTED:
            continue
        entry = remote_files.get(name, {"name": name, "type": "SERVER_JS"})
        entry["source"] = js.read_text()
        remote_files[name] = entry
        pushed.append(name)

    manifest = script_dir / "appsscript.json"
    if manifest.exists():
        remote_files["appsscript"] = {"name": "appsscript", "type": "JSON", "source": manifest.read_text()}

    api("PUT", f"{base}/content", token, {"files": list(remote_files.values())})

    protected_present = PROTECTED & set(remote_files.keys())
    print(f"Pushed {len(pushed)} files. Protected on remote: {protected_present or 'none'}")
    for name in pushed:
        print(f"  └─ {name}.js")


if __name__ == "__main__":
    main()
