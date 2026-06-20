#!/usr/bin/env python3
"""
Telegram Bot API로 시장 리포트 발송.
- 두 chat_id에 각각 sendMessage
- 1차 Markdown parse_mode → 400(parse 실패)이면 plain text fallback
- 결과 stdout 출력 (성공/실패 chat 갯수)

환경변수:
  TG_BOT_TOKEN  — 봇 토큰
  TG_CHAT_IDS   — 콤마 구분 chat_id 리스트 (예: "123,456")

사용:
  python3 send_telegram.py <report_file_path>
"""
import json
import os
import sys
import urllib.error
import urllib.request


def split_message(body, limit=4000):
    """텔레그램 4096자 한도(여유 4000)로 줄 경계 분할. PB 리포트 길이 대비 안전망."""
    if len(body) <= limit:
        return [body]
    chunks, cur = [], ""
    for line in body.split("\n"):
        while len(line) > limit:               # 한 줄이 한도 초과면 강제 컷
            if cur:
                chunks.append(cur)
                cur = ""
            chunks.append(line[:limit])
            line = line[limit:]
        if cur and len(cur) + 1 + len(line) > limit:
            chunks.append(cur)
            cur = line
        else:
            cur = (cur + "\n" + line) if cur else line
    if cur:
        chunks.append(cur)
    return chunks


def post(url, payload):
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        return e.code, body
    except Exception as e:
        return -1, str(e)


def main():
    if len(sys.argv) < 2:
        print("usage: send_telegram.py <report_file>", file=sys.stderr)
        sys.exit(2)

    report_path = sys.argv[1]
    if not os.path.isfile(report_path):
        print(f"report file not found: {report_path}", file=sys.stderr)
        sys.exit(0)  # 휴장일 등으로 파일이 없으면 정상 종료

    with open(report_path, "r", encoding="utf-8") as f:
        body = f.read().strip()
    if not body:
        print(f"report empty: {report_path}", file=sys.stderr)
        sys.exit(0)

    token = os.environ.get("TG_BOT_TOKEN", "").strip()
    chat_ids_raw = os.environ.get("TG_CHAT_IDS", "").strip()
    if not token:
        print("TG_BOT_TOKEN missing", file=sys.stderr)
        sys.exit(1)
    chat_ids = [c.strip() for c in chat_ids_raw.split(",") if c.strip()]
    if not chat_ids:
        print("TG_CHAT_IDS empty", file=sys.stderr)
        sys.exit(1)

    url = f"https://api.telegram.org/bot{token}/sendMessage"

    chunks = split_message(body)
    if len(chunks) > 1:
        print(f"본문 {len(body)}자 → {len(chunks)}개로 분할 발송")

    sent = 0
    failed = []
    for chat_id in chat_ids:
        ok = True
        for idx, chunk in enumerate(chunks):
            tag = f"{chat_id}" + (f" [{idx+1}/{len(chunks)}]" if len(chunks) > 1 else "")
            # 1차: Markdown
            status, resp = post(url, {
                "chat_id": chat_id,
                "text": chunk,
                "parse_mode": "Markdown",
                "disable_notification": False,
            })
            if status == 200:
                print(f"[OK Markdown] {tag}")
                continue
            # 2차: plain text fallback (Markdown parse 실패 시)
            if status == 400:
                status2, resp2 = post(url, {
                    "chat_id": chat_id,
                    "text": chunk,
                    "disable_notification": False,
                })
                if status2 == 200:
                    print(f"[OK plain fallback] {tag} (Markdown 400)")
                    continue
                failed.append(f"{tag}: plain HTTP {status2} {resp2[:200]}")
                print(f"[FAIL plain] {tag} HTTP {status2}", file=sys.stderr)
                ok = False
                break
            # 그 외 에러
            failed.append(f"{tag}: Markdown HTTP {status} {resp[:200]}")
            print(f"[FAIL Markdown] {tag} HTTP {status}: {resp[:200]}", file=sys.stderr)
            ok = False
            break
        if ok:
            sent += 1

    print(f"\nresult: sent={sent}/{len(chat_ids)}")
    if failed:
        print("failures:")
        for f in failed:
            print(f"  - {f}")
        sys.exit(1)


if __name__ == "__main__":
    main()
