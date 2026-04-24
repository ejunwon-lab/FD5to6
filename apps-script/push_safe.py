#!/usr/bin/env python3
"""
GAS push that preserves Secret.js on remote.
- GETs remote project content (Secret.js stays in memory only, never written to disk)
- Updates only local .js / appsscript.json files
- PUTs everything back, Secret.js untouched
"""
import json, sys, time
from pathlib import Path
import requests

SCRIPT_ID = "12MAcPpoVE39N_Sz0B79G0rjGvevJ8-S_ibVC1Ot61fyVPZnaSQmrJyiR"
PROTECTED = {"Secret"}   # never overwrite these on remote
CLASPRC   = Path.home() / ".clasprc.json"


def get_token() -> str:
    data  = json.loads(CLASPRC.read_text())
    token = list(data["tokens"].values())[0]

    # Refresh if expired (with 60s buffer)
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
        # persist refreshed token
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
    script_dir = Path(__file__).parent
    token = get_token()
    base  = f"https://script.googleapis.com/v1/projects/{SCRIPT_ID}"

    # 1. GET remote — Secret.js lives here, never touches disk
    remote_files = {f["name"]: f for f in api("GET", f"{base}/content", token).get("files", [])}

    # 2. Overwrite with local files (skip PROTECTED)
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

    # 3. PUT back — Secret.js is still in remote_files, unchanged
    api("PUT", f"{base}/content", token, {"files": list(remote_files.values())})

    protected_present = PROTECTED & set(remote_files.keys())
    print(f"Pushed {len(pushed)} files. Protected on remote: {protected_present or 'none'}")
    for name in pushed:
        print(f"  └─ {name}.js")


if __name__ == "__main__":
    main()
