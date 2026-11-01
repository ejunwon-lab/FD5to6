#!/usr/bin/env python3
"""watchdog 일별 기록(JSONL 이력) + 월간 통계.

설계: docs/plans/2026-11-01-watchdog-이상시만-알림-월간통계.md
기록 파일: FD5to6-reports(private)/_watchdog/daily.jsonl — 대상일당 1줄(같은 날짜는 덮어씀, 멱등).

usage:
  watchdog_log.py upsert  <daily.jsonl> <result.json>         # watchdog_check.sh JSON_FILE 출력 반영
  watchdog_log.py due     <daily.jsonl> <YYYY-MM-DD> <dir>    # 보낼 월간 통계 월(YYYY-MM)을 줄마다 출력
  watchdog_log.py monthly <daily.jsonl> <YYYY-MM>             # 월간 통계 텔레그램 문구 출력
"""
import calendar
import json
import os
import re
import sys
from datetime import date, datetime, timedelta, timezone

DOW_KO = '월화수목금토일'
TIME_RE = re.compile(r'^\d{2}:\d{2}$')   # 리포트 정상 커밋 = "HH:MM"


def load(path):
    rows = {}
    if os.path.exists(path):
        with open(path, encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    r = json.loads(line)
                except json.JSONDecodeError:
                    continue   # 깨진 줄은 무시 — 기록 1줄 손상이 통계 전체를 막지 않게
                if isinstance(r, dict) and 'date' in r:
                    rows[r['date']] = r
    return rows


def save(path, rows):
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        for d in sorted(rows):
            f.write(json.dumps(rows[d], ensure_ascii=False, separators=(',', ':')) + '\n')
    os.replace(tmp, path)


def cmd_upsert(log_path, result_path):
    with open(result_path, encoding='utf-8') as f:
        r = json.loads(f.read())
    rows = load(log_path)
    rows[r['date']] = r
    save(log_path, rows)
    print(f"기록: {r['date']} (총 {len(rows)}일)")


def month_of(d):
    return f'{d.year:04d}-{d.month:02d}'


def cmd_due(log_path, target, out_dir):
    """대상일이 월말이면 그 달, 그리고 (월말 run 누락 폴백) 직전 달 — 요약 파일이 없고 기록이 있는 달만."""
    t = date.fromisoformat(target)
    prev = month_of(t.replace(day=1) - timedelta(days=1))
    cands = [prev]
    if t.day == calendar.monthrange(t.year, t.month)[1]:
        cands.append(month_of(t))
    rows = load(log_path)
    for m in cands:
        if os.path.exists(os.path.join(out_dir, f'monthly-{m}.md')):
            continue
        if not any(d.startswith(m + '-') for d in rows):
            continue   # 기록 없는 달(도입 이전)은 통계 안 냄
        print(m)


def md(d):
    return f'{int(d[5:7])}/{int(d[8:10])}'


def cmd_monthly(log_path, month):
    y, mo = int(month[:4]), int(month[5:7])
    ndays = calendar.monthrange(y, mo)[1]
    rows = {d: r for d, r in load(log_path).items() if d.startswith(month + '-')}
    today = datetime.now(timezone(timedelta(hours=9))).date().isoformat()
    all_days = [f'{month}-{i:02d}' for i in range(1, ndays + 1)]
    missing = [d for d in all_days if d not in rows and d <= today]   # 월중 미리보기 시 미래일 제외

    trading = [rows[d] for d in sorted(rows) if rows[d].get('trading')]
    sents = [(r['date'], r.get('sent', 0)) for r in trading]
    http_err = sum(r.get('http_err', 0) for r in rows.values())
    http_403 = sum(r.get('http_403', 0) for r in rows.values())
    err_days = [d for d in sorted(rows) if rows[d].get('http_err', 0) > 0]

    def rep_count(key, pred):
        exp = [r for r in rows.values() if pred(r)]
        ok = [r for r in exp if TIME_RE.match(str(r.get('reports', {}).get(key, '')))]
        return len(ok), len(exp)

    weekday = lambda r: r.get('dow', 0) <= 5
    us = rep_count('US', weekday)
    kr = rep_count('KR', weekday)
    wk = rep_count('WEEK', lambda r: r.get('dow') == 7)

    red_days = [d for d in sorted(rows) if rows[d].get('red')]
    warn_days = [d for d in sorted(rows) if rows[d].get('warn')]

    L = [f'📊 자동화 월간 통계 ({y}년 {mo}월)']
    miss = ', '.join(md(d) for d in missing[:10]) + (f' 외 {len(missing) - 10}일' if len(missing) > 10 else '')
    L.append(f'• 점검 기록 {len(rows)}/{ndays}일' + (f' — 미기록 {miss}' if missing else ''))
    if sents:
        avg = sum(s for _, s in sents) / len(sents)
        lo_d, lo = min(sents, key=lambda x: x[1])
        L.append(f'• 거래일 {len(sents)}일 — 텔레그램 푸시 일평균 {avg:.1f}건 (최저 {md(lo_d)} {lo}건)')
    else:
        L.append('• 거래일 기록 없음')
    if http_err:
        L.append(f"• GAS 응답 오류 {http_err}건 (403 {http_403}건) — {', '.join(md(d) for d in err_days)}")
    else:
        L.append('• GAS 응답 오류 0건')
    L.append(f'• 리포트 US {us[0]}/{us[1]} · KR {kr[0]}/{kr[1]} · 주간 {wk[0]}/{wk[1]}')
    if red_days:
        L.append(f'• 이상 발생 {len(red_days)}일')
        for d in red_days[:8]:
            first = rows[d]['red'][0].lstrip('🔴').strip()
            more = f" 외 {len(rows[d]['red']) - 1}건" if len(rows[d]['red']) > 1 else ''
            L.append(f'  - {md(d)}({DOW_KO[rows[d]["dow"] - 1]}) {first}{more}')
        if len(red_days) > 8:
            L.append(f'  - … 외 {len(red_days) - 8}일')
    else:
        L.append('• 이상 발생 없음')
    if warn_days:
        L.append(f'• 확인 불가(⚠️) 있었던 날 {len(warn_days)}일')
    print('\n'.join(L))


def main(argv):
    if len(argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2
    cmd, args = argv[1], argv[2:]
    if cmd == 'upsert' and len(args) == 2:
        cmd_upsert(*args)
    elif cmd == 'due' and len(args) == 3:
        cmd_due(*args)
    elif cmd == 'monthly' and len(args) == 2:
        cmd_monthly(*args)
    else:
        print(__doc__, file=sys.stderr)
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
