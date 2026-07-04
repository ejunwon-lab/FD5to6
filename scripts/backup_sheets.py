#!/usr/bin/env python3
"""
시트 전체 → 로컬 백업. GAS action=backupData POST → backups/YYYY-MM-DD_HHMM/<시트>.csv

- URL·토큰: post_trade.py의 clasp 토큰 → 고정 웹앱 URL 발견 재사용
- 시크릿: .env의 TG_WEBHOOK_SECRET
- backups/ 는 .gitignore — repo에 절대 커밋되지 않음 (사용자 결정 2026-07-04)
- 자동 실행: launchd ~/Library/LaunchAgents/com.fd5to6.sheet-backup.plist (주 1회 일 21:00)

사용법: python3 scripts/backup_sheets.py
설계: docs/plans/2026-07-04-시트백업-로컬.md
"""
import csv
import json
import sys
import time
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from post_trade import get_token, fixed_webapp_url, read_secret  # noqa: E402

import requests  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
BACKUP_ROOT = ROOT / "backups"
KEEP = 20  # 최근 20회분 보관, 초과분 오래된 것부터 삭제


def main():
    token = get_token()
    url = fixed_webapp_url(token)
    secret = read_secret()

    # GAS 대용량(수백 KB) 응답은 간헐적으로 구글 오류 HTML을 반환 → 재시도로 흡수
    data = None
    last_err = ""
    for attempt in range(1, 4):
        r = requests.post(url, json={"action": "backupData", "secret": secret},
                          timeout=120, allow_redirects=True)
        r.raise_for_status()
        try:
            data = r.json()
            break
        except ValueError:
            last_err = (f"attempt {attempt}: 비JSON 응답 status={r.status_code} "
                        f"len={len(r.text)} head={r.text[:120]!r}")
            print(last_err, file=sys.stderr)
            time.sleep(5 * attempt)
    if data is None:
        print(f"FAIL: 3회 모두 비JSON — {last_err}", file=sys.stderr)
        sys.exit(1)
    if not data.get("success"):
        print(f"FAIL: {data.get('error')}", file=sys.stderr)
        sys.exit(1)

    stamp = datetime.now().strftime("%Y-%m-%d_%H%M")
    outdir = BACKUP_ROOT / stamp
    outdir.mkdir(parents=True, exist_ok=True)

    total_rows = 0
    for name, rows in data["sheets"].items():
        safe = "".join(ch if ch not in '/\\:*?"<>|' else "_" for ch in name)
        with open(outdir / f"{safe}.csv", "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            for row in rows:
                w.writerow(row)
        total_rows += len(rows)

    # 원본 JSON도 1부 보존 (타입 손실 없는 완전본)
    (outdir / "_raw.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")

    # 보관 개수 초과분 정리 (오래된 것부터)
    dirs = sorted([d for d in BACKUP_ROOT.iterdir() if d.is_dir()])
    for old in dirs[:-KEEP]:
        for p in old.iterdir():
            p.unlink()
        old.rmdir()

    print(f"OK {stamp}: {len(data['sheets'])}시트 {total_rows}행 → {outdir}")


if __name__ == "__main__":
    main()
