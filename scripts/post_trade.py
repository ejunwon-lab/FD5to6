#!/usr/bin/env python3
"""
카톡 매매 → GAS *거래_원장* 기록. action=addTrade POST.
URL은 deployments API로 자동 획득(고정 WEB_APP 익명 배포), secret은 .env에서.

사용법: python3 scripts/post_trade.py '<trade JSON>'
  예: python3 scripts/post_trade.py '{"type":"매도","code":"257720","name":"실리콘투","broker":"미래에셋투자증권","account":"종합_랩","qty":430,"price":34900,"amount":15007000,"fee":0,"orderNo":"6396"}'
환경:
  POST_TRADE_SECRET 환경변수 또는 .env의 TG_WEBHOOK_SECRET
  --dummy : 더미 시크릿으로 forbidden 동작 확인
"""
import json, sys, time, os
from pathlib import Path
import requests

SCRIPT_ID = "1DC8llpWYz2ZvzsqVCaz60qomATwxP_CBzuHBitCf0uQT5NbBF-n7IHdZ"
CLASPRC = Path.home() / ".clasprc.json"
ROOT = Path(__file__).resolve().parent.parent


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
    return tok["access_token"]


def fixed_webapp_url(token):
    deps = requests.get(f"https://script.googleapis.com/v1/projects/{SCRIPT_ID}/deployments",
                        headers={"Authorization": f"Bearer {token}"}).json().get("deployments", [])
    for d in deps:  # 버전 고정(익명 배포)만 — HEAD는 401
        if d.get("deploymentConfig", {}).get("versionNumber") is None:
            continue
        for e in d.get("entryPoints", []):
            if e.get("entryPointType") == "WEB_APP":
                return e["webApp"]["url"]
    return None


def read_secret():
    if os.environ.get("POST_TRADE_SECRET"):
        return os.environ["POST_TRADE_SECRET"]
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if line.strip().startswith("TG_WEBHOOK_SECRET="):
                return line.split("=", 1)[1].strip()
    print("❌ secret 없음 (.env TG_WEBHOOK_SECRET)"); sys.exit(1)


def main():
    args = [a for a in sys.argv[1:] if a != "--dummy"]
    dummy = "--dummy" in sys.argv
    trade = json.loads(args[0]) if args else {}
    token = get_token()
    url = fixed_webapp_url(token)
    if not url:
        print("❌ 고정 WEB_APP URL 못 찾음"); sys.exit(1)
    secret = "WRONG_DUMMY" if dummy else read_secret()
    payload = {"action": "addTrade", "secret": secret, "trade": trade}
    r = requests.post(url, headers={"Content-Type": "application/json"},
                      data=json.dumps(payload), allow_redirects=True, timeout=120)
    print("HTTP", r.status_code)
    try:
        print(json.dumps(r.json(), ensure_ascii=False, indent=2))
    except Exception:
        print(r.text[:300])


if __name__ == "__main__":
    main()
