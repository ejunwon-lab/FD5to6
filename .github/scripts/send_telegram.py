#!/usr/bin/env python3
"""
Telegram Bot API로 시장 리포트 발송.
- 두 chat_id에 각각 sendMessage
- 1차 Markdown parse_mode → 400(parse 실패)이면 plain text fallback
- 결과 stdout 출력 (성공/실패 chat 갯수)
- 본문에 `===근거===` 한 줄이 있으면 그 줄에서 **두 통으로 나눠** 보낸다(2026-11-16): 1통째 = 요약(알림 울림),
  2통째 = 근거(알림 없이). 표시 줄 자체는 보내지 않는다. 표시가 없으면 예전처럼 한 통.
- 로그는 공개다 — chat_id를 찍지 않고 순번(chat#1…)만 찍는다.
- 일시적 실패(연결 끊김·5xx·429)는 2초·5초 뒤 다시 보낸다(2026-11-16 — 첫 실발송에서 한 대상이
  `Connection reset by peer` 한 번에 통째로 빠진 뒤). 400(Markdown 해석 실패)은 재시도 대상이 아니다.
- `TG_ONLY`(예: "1" 또는 "1,2") — 그 순번의 대상에게만 보낸다. 일부 대상만 못 받았을 때의 재발송용.

환경변수:
  TG_BOT_TOKEN  — 봇 토큰
  TG_CHAT_IDS   — 콤마 구분 chat_id 리스트 (예: "123,456")
  TG_ONLY       — (선택) 보낼 대상의 순번, 콤마 구분. 비우면 전원

사용:
  python3 send_telegram.py <report_file_path>
"""
import json
import os
import re
import sys
import time
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


SPLIT_RE = re.compile(r"^\s*={3,}\s*근거\s*={3,}\s*$", re.M)


def split_parts(body):
    """`===근거===` 줄에서 메시지를 나눈다 → [요약, 근거]. 표시가 없으면 [본문]."""
    return [p.strip() for p in SPLIT_RE.split(body) if p.strip()] or [body]


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


RETRY_WAITS = (2, 5)   # 일시적 실패 뒤 기다리는 초 — 총 3번까지 시도


def post_retry(url, payload):
    """일시적 실패(연결 오류 -1 · 5xx · 429)는 다시 보낸다. 그 밖의 응답은 그대로 돌려준다."""
    status, resp = post(url, payload)
    for wait in RETRY_WAITS:
        if not (status == -1 or status == 429 or status >= 500):
            break
        if status == 429:   # 텔레그램이 알려 준 대기 시간(최대 15초)
            try:
                wait = min(15, max(wait, int(json.loads(resp)["parameters"]["retry_after"]) + 1))
            except Exception:
                pass
        print(f"  일시적 실패(HTTP {status}) — {wait}초 뒤 다시 보냄")
        time.sleep(wait)
        status, resp = post(url, payload)
    return status, resp


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

    parts = split_parts(body)
    # (조각, 알림 끔 여부) — 첫 통(요약)만 알림을 울리고 근거는 조용히 보낸다
    chunks = [(c, pi > 0) for pi, part in enumerate(parts) for c in split_message(part)]
    print(f"본문 {len(body)}자 → 메시지 {len(parts)}통" + (f" (조각 {len(chunks)}개)" if len(chunks) != len(parts) else ""))

    only = {int(x) for x in os.environ.get("TG_ONLY", "").replace(" ", "").split(",") if x.isdigit()}
    targets = [(n, c) for n, c in enumerate(chat_ids, 1) if not only or n in only]
    if only:
        print(f"대상 제한 — {', '.join(f'chat#{n}' for n, _ in targets) or '없음'}에게만 보냄")

    sent = 0
    failed = []
    for n, chat_id in targets:
        ok = True
        for idx, (chunk, silent) in enumerate(chunks):
            tag = f"chat#{n}" + (f" [{idx+1}/{len(chunks)}]" if len(chunks) > 1 else "")
            if idx:
                time.sleep(0.6)   # 순서 보장 — 요약이 먼저 도착하게
            # 1차: Markdown
            status, resp = post_retry(url, {
                "chat_id": chat_id,
                "text": chunk,
                "parse_mode": "Markdown",
                "disable_notification": silent,
            })
            if status == 200:
                print(f"[OK Markdown] {tag}")
                continue
            # 2차: plain text fallback (Markdown parse 실패 시)
            if status == 400:
                status2, resp2 = post_retry(url, {
                    "chat_id": chat_id,
                    "text": chunk,
                    "disable_notification": silent,
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

    print(f"\nresult: sent={sent}/{len(targets)}")
    if failed:
        print("failures:")
        for f in failed:
            print(f"  - {f}")
        sys.exit(1)


if __name__ == "__main__":
    main()
