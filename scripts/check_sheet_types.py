#!/usr/bin/env python3
"""
시트 덤프 타입 계약 검증 — 백업 `_raw.json`(타입 보존 완전본)에 컬럼별 기대 타입을 assert.

배경: "시트에 쓴 타입 ≠ 읽은 타입" 클래스 버그(errors.md 2026-07-16 % 셀 비대칭 —
음수 % 문자열이 numeric 분수로 자동 파싱돼 d5가 100배 왜곡)를 백업 시점마다 조기 검출.

계약 (docs/code-map.md 시트 스키마 기준):
  *추이 기록*   S·Y·AC·AF(0-based 18·24·28·31)는 number 또는 빈칸 — % "문자열" 발견 = 위반
  *보유현황*    종목코드 있는 행의 수량~손익(6~11) number (KIS_SKIP 예금 행은 코드 빈칸 → 제외)
  *현재가_이력* 2행~ 날짜가 주말·*휴장일* 아님(거래일 행만 — errors.md 2026-05-26) + 가격 number/빈칸
  *거래_원장*   구분 ∈ {매수,매도,입금,출금}, 매수/매도 행의 수량·단가·금액 number
  *실현손익*    매도일 있는 행의 6~12 number

사용: python3 scripts/check_sheet_types.py [백업디렉토리]   (기본: backups/ 최신)
      backup_sheets.py가 백업 직후 자동 호출 (경고만 — 백업 자체는 실패 안 함)
exit 0=계약 전부 통과, 1=위반 존재, 2=덤프 없음/읽기 실패
"""
import json
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ISO_RE = re.compile(r"^\d{4}-\d{2}-\d{2}")

violations = []


def report(sheet, row, col, msg, val):
    violations.append(f"  {sheet} 행{row + 1} 열{col + 1}: {msg} — {repr(val)[:40]}")


def kst_date(v):
    """셀 값 → yyyy-MM-dd (KST). Date 셀은 JSON에서 UTC ISO 문자열로 와서 +9h 보정 필요."""
    if not isinstance(v, str) or not ISO_RE.match(v):
        return None
    if "T" in v:  # '2026-07-15T15:00:00.000Z' = KST 2026-07-16 00:00
        try:
            dt = datetime.fromisoformat(v.replace("Z", "+00:00")) + timedelta(hours=9)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            return None
    return v[:10]


def is_num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def num_or_empty(v):
    return v == "" or is_num(v)


def cell(row, i):
    return row[i] if i < len(row) else ""


def check_trend(rows):
    for r, row in enumerate(rows[1:], start=1):
        if not kst_date(cell(row, 20)):  # U열=날짜 아닌 행(헤더 등)은 제외
            continue
        for c in (18, 24, 28, 31):  # S·Y·AC·AF
            v = cell(row, c)
            if not num_or_empty(v):
                report("*추이 기록*", r, c, "% 문자열(숫자여야 함 — v31 계약)", v)


def check_position(rows):
    for r, row in enumerate(rows[1:], start=1):
        if cell(row, 0) == "":  # 종목코드 빈칸(예금·펀드·집계 행) 제외
            continue
        for c in (6, 7, 8):      # 수량·평단·매입금액 — 필수 number
            if not is_num(cell(row, c)):
                report("*보유현황*", r, c, "number 아님", cell(row, c))
        for c in (9, 10, 11, 12):  # 현재단가~수익률 — number 또는 빈칸
            if not num_or_empty(cell(row, c)):
                report("*보유현황*", r, c, "number/빈칸 아님", cell(row, c))


def check_price_history(rows, holidays):
    for r, row in enumerate(rows[1:], start=1):
        d = kst_date(cell(row, 0))
        if not d:
            report("*현재가_이력*", r, 0, "날짜 파싱 불가", cell(row, 0))
            continue
        wd = datetime.strptime(d, "%Y-%m-%d").weekday()  # 0=월
        if wd >= 5:
            report("*현재가_이력*", r, 0, "주말 행 존재(거래일만 허용)", d)
        elif d in holidays:
            report("*현재가_이력*", r, 0, "휴장일 행 존재(거래일만 허용)", d)
        for c in range(1, len(row)):
            if not num_or_empty(cell(row, c)):
                report("*현재가_이력*", r, c, "가격이 number/빈칸 아님", cell(row, c))


def check_ledger(rows):
    for r, row in enumerate(rows[1:], start=1):
        if not kst_date(cell(row, 0)):
            continue
        kind = cell(row, 1)
        if kind not in ("매수", "매도", "입금", "출금"):
            report("*거래_원장*", r, 1, "구분 값 미상", kind)
        if kind in ("매수", "매도"):
            for c in (7, 8, 9):
                if not is_num(cell(row, c)):
                    report("*거래_원장*", r, c, "number 아님", cell(row, c))


def check_realized(rows):
    for r, row in enumerate(rows[1:], start=1):
        if not kst_date(cell(row, 0)):
            continue
        for c in range(6, 13):
            if not is_num(cell(row, c)):
                report("*실현손익*", r, c, "number 아님", cell(row, c))


def main():
    if len(sys.argv) > 1:
        outdir = Path(sys.argv[1])
    else:
        dirs = sorted(d for d in (ROOT / "backups").glob("*") if d.is_dir()) \
            if (ROOT / "backups").is_dir() else []
        if not dirs:
            print("타입계약: backups/ 덤프 없음 — skip", file=sys.stderr)
            sys.exit(2)
        outdir = dirs[-1]
    raw = outdir / "_raw.json"
    if not raw.is_file():
        print(f"타입계약: {raw} 없음 — skip", file=sys.stderr)
        sys.exit(2)

    sheets = json.loads(raw.read_text(encoding="utf-8"))["sheets"]
    holidays = {kst_date(cell(row, 0)) for row in sheets.get("*휴장일*", [])} - {None}

    checkers = [
        ("*추이 기록*", lambda rows: check_trend(rows)),
        ("*보유현황*", lambda rows: check_position(rows)),
        ("*현재가_이력*", lambda rows: check_price_history(rows, holidays)),
        ("*거래_원장*", lambda rows: check_ledger(rows)),
        ("*실현손익*", lambda rows: check_realized(rows)),
    ]
    seen = 0
    for name, fn in checkers:
        if name in sheets:
            seen += 1
            fn(sheets[name])

    if violations:
        print(f"🔴 타입계약 위반 {len(violations)}건 ({outdir.name}, {seen}시트 검사):")
        for v in violations[:20]:
            print(v)
        if len(violations) > 20:
            print(f"  … 외 {len(violations) - 20}건")
        sys.exit(1)
    print(f"✓ 타입계약 통과 ({outdir.name}, {seen}시트)")


if __name__ == "__main__":
    main()
