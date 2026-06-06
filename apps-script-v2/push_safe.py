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
import json, subprocess, sys, time
from pathlib import Path
import requests

# ▼▼▼ 새 시트의 Script ID로 교체하세요 ▼▼▼
SCRIPT_ID = "1DC8llpWYz2ZvzsqVCaz60qomATwxP_CBzuHBitCf0uQT5NbBF-n7IHdZ"
# ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

PROTECTED = {"Secret"}
CLASPRC   = Path.home() / ".clasprc.json"


def get_token() -> str:
    data = json.loads(CLASPRC.read_text())

    # ~/.clasprc.json 두 형식 지원:
    #  A (구): {"tokens": {key: {client_id, client_secret, refresh_token, access_token, expiry_date}}}
    #  B (clasp v2): {"token": {access_token, refresh_token, expiry_date}, "oauth2ClientSettings": {clientId, clientSecret}}
    if "tokens" in data:
        key = list(data["tokens"].keys())[0]
        tok = data["tokens"][key]
        client_id, client_secret = tok["client_id"], tok["client_secret"]
    elif "token" in data:
        key = None
        tok = data["token"]
        oc = data.get("oauth2ClientSettings", {})
        client_id, client_secret = oc["clientId"], oc["clientSecret"]
    else:
        print("❌ ~/.clasprc.json 형식 인식 실패 (tokens/token 키 없음) — clasp login 재시도")
        sys.exit(1)

    if tok.get("expiry_date", 0) / 1000 - time.time() < 60:
        r = requests.post("https://oauth2.googleapis.com/token", data={
            "client_id":     client_id,
            "client_secret": client_secret,
            "refresh_token": tok["refresh_token"],
            "grant_type":    "refresh_token",
        })
        new = r.json()
        if "access_token" not in new:
            print(f"❌ 토큰 갱신 실패: {new}")
            sys.exit(1)
        tok["access_token"] = new["access_token"]
        tok["expiry_date"]  = int((time.time() + new["expires_in"]) * 1000)
        if key is not None:
            data["tokens"][key] = tok
        else:
            data["token"] = tok
        CLASPRC.write_text(json.dumps(data, indent=2))
        print("  (token refreshed)")

    return tok["access_token"]


def syntax_check(script_dir: Path) -> bool:
    """*.js 문법(node --check) + appsscript.json 유효성 검사. 통과 시 True."""
    try:
        subprocess.run(['node', '--version'], capture_output=True, check=True)
    except (FileNotFoundError, subprocess.CalledProcessError):
        print("⚠ node 없음 — 문법 검사 건너뜀 (Node.js 설치 권장)")
        return True

    errors = []
    js_files = sorted(script_dir.glob("*.js"))
    for js in js_files:
        r = subprocess.run(['node', '--check', str(js)], capture_output=True, text=True)
        if r.returncode != 0:
            errors.append(f"  ✗ {js.name}\n{r.stderr.strip()}")

    manifest = script_dir / "appsscript.json"
    if manifest.exists():
        try:
            json.loads(manifest.read_text())
        except json.JSONDecodeError as e:
            errors.append(f"  ✗ appsscript.json: {e}")

    if errors:
        print("❌ 문법 오류 — push 중단:")
        for err in errors:
            print(err)
        return False
    print(f"✓ 문법 검사 통과 ({len(js_files)}개 .js + appsscript.json)")
    return True


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
    if not syntax_check(script_dir):
        sys.exit(1)
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
