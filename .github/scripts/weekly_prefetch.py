#!/usr/bin/env python3
"""주간 리포트 사전 수집 — 지난 한 주의 숫자(지수·내 포트·종목별 기여)와 주간 신호를 코드가 계산해 넘긴다.

배경: 주간 리포트의 지수·종목 주간 등락이 야후 수신 실패로 대부분 "(추정)"이었다(2026-11-15 리포트).
     네이버 일봉으로 직접 계산하고, 내 포트 d5와 **같은 구간**(직전 주 마지막 거래일 종가 → 이번 주 마지막 거래일 종가)으로 맞춘다.
     설계: docs/plans/2026-11-16-리포트-요약우선-신호등.md

보유 목록의 원본은 GAS 보유현황(krClose.items) 하나 — 여기 종목을 적지 않는다. 로그(공개)에는 개수·상태만.
어떤 실패에도 exit 0.

사용: weekly_prefetch.py <gas_metrics.json> <out.md> <오늘 KST YYYY-MM-DD> [--signals <_signals.jsonl>] [--signal-out <signal.json>]
"""
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mkt            # noqa: E402
import signal_rules   # noqa: E402


def norm(t):
    return re.sub(r"\s+", "", str(t or "")).upper()


def kind_of(cat):
    cat = str(cat or "")
    return "국내주식" if cat == "국내주식" else ("ETF" if "ETF" in cat.upper() else (cat or "—"))


def read_signals(path):
    out = []
    try:
        for line in open(path, encoding="utf-8"):
            try:
                out.append(json.loads(line))
            except Exception:
                pass
    except Exception:
        pass
    return out


def fx_week():
    d = mkt.get(f"{mkt.API}/marketindex/exchange/FX_USDKRW/prices?page=1&pageSize=8")
    rows = [(str(x.get("localTradedAt") or "")[:10], mkt.num(x.get("closePrice"))) for x in d] if isinstance(d, list) else []
    rows = sorted((a, b) for a, b in rows if a and b)
    if len(rows) < 6:
        return None
    return {"close": rows[-1][1], "week": (rows[-1][1] / rows[-6][1] - 1) * 100, "date": rows[-1][0]}


def main():
    argv, opt = [], {}
    it = iter(sys.argv[1:])
    for a in it:
        if a.startswith("--"):
            opt[a[2:]] = next(it, None)
        else:
            argv.append(a)
    gas_path, out_path, today = argv[0], argv[1], argv[2]
    try:
        gas = json.load(open(gas_path, encoding="utf-8"))
    except Exception:
        gas = {}
    P = mkt.pct
    kospi = mkt.day_series("domestic/index/KOSPI", today, 70)
    if len(kospi) < 7:
        with open(out_path, "w", encoding="utf-8") as f:
            f.write("# 주간 사전 수집 — 실패\n\n- 지수 일봉을 받지 못했다. 지시문의 대체 경로로 직접 받는다.\n")
        print("weekly-prefetch: failed (kospi series)")
        return
    week = [d for d, _ in kospi[-5:]]                  # 이번 주(가장 최근 5거래일)
    base = kospi[-6][0]                                # 비교 기준일 = 그 앞 거래일
    kday = {kospi[i][0]: (kospi[i][1] / kospi[i - 1][1] - 1) * 100 for i in range(1, len(kospi))}
    idx = {"코스피": {"week": mkt.chg(kospi, 5), "d20": mkt.chg(kospi, 20), "close": kospi[-1][1]}}
    for name, path in (("코스닥", "domestic/index/KOSDAQ"), ("S&P500", "foreign/index/.INX"), ("나스닥100", "foreign/index/.NDX"), ("미국 반도체지수", "foreign/index/.SOX")):
        s = mkt.day_series(path, today, 70)
        idx[name] = {"week": mkt.chg(s, 5), "d20": mkt.chg(s, 20), "close": s[-1][1] if s else None, "last": s[-1][0] if s else None}
        time.sleep(0.1)
    fx = fx_week()

    # 내 포트 — GAS
    daily = {mkt.ymd(x.get("date")): x for x in (gas.get("dailyReturns") or [])}
    pr = gas.get("portfolioReturn") or {}
    op = (gas.get("recentReturns") or [{}])[-1].get("opRatePct")
    have = [d for d in week if d in daily]
    port_week = None
    if have:
        acc = 1.0
        for d in have:
            acc *= 1 + (daily[d].get("dRatePct") or 0) / 100
        port_week = (acc - 1) * 100
    missing = [d for d in week if d not in daily]

    # 종목별 주간 등락 × 비중
    wsum, cat = {}, {}
    for h in gas.get("holdings") or []:
        k = norm(h.get("name"))
        wsum[k] = wsum.get(k, 0.0) + (mkt.num(h.get("weight")) or 0.0)
        cat[k] = h.get("category")
    rows, hist = [], 0
    kc = gas.get("krClose") or {}
    kc_ok = mkt.ymd(kc.get("date") or "") == kospi[-1][0]   # GAS의 마지막 기록일이 이번 주 마지막 거래일인가 (그 종가 = 정규장 종가)
    for x in (kc.get("items") or []):
        if not x.get("code"):
            continue
        last = mkt.num(x.get("close")) if kc_ok else None
        s = mkt.official_series(x["code"], kospi[-1][0], last) if last else []   # 정규장 종가만으로 만든 일별 값
        time.sleep(0.12)
        wk = mkt.chg(s, 5, kospi[-1][0]) if len(s) >= 6 else None
        hist += 1 if wk is not None else 0
        w = wsum.get(norm(x.get("name")))
        c = (w / (1 + wk / 100) * wk / 100) if (w and wk is not None) else None
        rows.append({"name": x.get("name"), "code": x["code"], "kind": kind_of(cat.get(norm(x.get("name")))), "week": wk, "w": w, "contrib": c})
    ranked = sorted((r for r in rows if r["contrib"] is not None), key=lambda r: r["contrib"])
    inv_w = sum(r["w"] / (1 + r["week"] / 100) for r in ranked)
    inv_week = (sum(r["contrib"] for r in ranked) / inv_w * 100) if inv_w > 0 else None

    approx_week = sum(r["contrib"] for r in ranked) if ranked else None
    gap_note = ""
    if approx_week is not None and port_week is not None and abs(approx_week - port_week) > 1.0:
        gap_note = (f" · ⚠️ 종목별 기여를 다 더하면 {approx_week:+.2f}%로 차이가 크다 — 기록이 빠진 날이 구간에 끼었거나 주중 매매가 있었을 수 있다."
                    " 두 숫자를 섞어 쓰지 말고 이 사실을 근거에 한 줄 밝힌다")
    # 신호 기록
    sigs = read_signals(opt.get("signals")) if opt.get("signals") else []
    kr_week = {mkt.ymd(e.get("date")): e for e in sigs if e.get("type") == "kr" and mkt.ymd(e.get("date")) in week}
    us_week = [e for e in sigs if e.get("type") == "us" and base < mkt.ymd(e.get("date")) <= mkt.ymd(today)]
    color, reasons = signal_rules.week_signal([e.get("color") for e in kr_week.values()], port_week)
    reds = [f"{e.get('header')} — " + " / ".join(e.get("reasons") or []) for e in kr_week.values() if e.get("color") == signal_rules.RED]

    header = f"{mkt.kdate(week[0])}~{mkt.kdate(week[-1])}"
    k_week = idx["코스피"]["week"]
    L = [f"# 주간 사전 수집 — {header} (기준일 {mkt.kdate(base)} 종가 대비)", "",
         "- 아래 숫자는 코드가 받아 계산한 값이다. 지수·종목·내 포트 모두 **같은 구간**(기준일 종가 → 이번 주 마지막 거래일 종가)이다. 그대로 쓴다.", "",
         "## 요약 재료 — 코드가 계산한 값 (요약 메시지에 색·숫자·날짜 표기를 **글자 그대로** 쓴다)", "",
         f"- 날짜 표기: {header}",
         f"- 신호: {color} {signal_rules.LABEL[color]}",
         "- 신호 이유: " + (" / ".join(reasons) if reasons else "없음"),
         *( [f"- 이번 주 🔴: " + " | ".join(reds)] if reds else [] ),
         f"- 내 포트 한 주: {P(port_week)} (현금까지 포함한 전체" + (f" · ⚠️ 기록이 없는 날 {len(missing)}일({', '.join(mkt.kdate(d) for d in missing)}) 제외" if missing else "") + ")" + gap_note,
         f"- 주식 부분만 (지금 보유·지금 비중 기준 근사): {P(inv_week)} · 코스피 {P(k_week)} · 코스닥 {P(idx['코스닥']['week'])}"
         + ("" if inv_week is None or k_week is None else f" → 주식 부분이 코스피보다 {abs(inv_week - k_week):.1f}%p " + ("앞섬" if inv_week > k_week else "뒤짐")),
         "- 끌어내린 것 (포트에 준 영향이 큰 순): " + (" · ".join(f"{r['name']} {P(r['week'], 1)} (포트 {r['contrib']:+.2f}%p)" for r in ranked[:3] if r["contrib"] <= -0.03) or "없음"),
         "- 끌어올린 것: " + (" · ".join(f"{r['name']} {P(r['week'], 1)} (포트 {r['contrib']:+.2f}%p)" for r in ranked[::-1][:3] if r["contrib"] >= 0.03) or "없음"),
         f"- 최근 20거래일: 내 포트 {P(pr.get('d20'))} · 코스피 {P(idx['코스피']['d20'])}",
         f"- 누적 수익률: {P(op)}",
         "- 자산 비중: " + (" · ".join(f"{k} {v}%" for k, v in sorted((gas.get("assetClassWeights") or {}).items(), key=lambda x: -x[1]) if v) or "미수신"),
         "- 미국 (한 주): " + " · ".join(f"{n} {P(idx[n]['week'])}" for n in ("S&P500", "나스닥100", "미국 반도체지수")),
         "- 원/달러: " + (f"{fx['close']:,.2f}원 (한 주 {P(fx['week'])})" if fx else "미수신"),
         "- " + signal_rules.key_text()]
    # 요약의 뼈대 줄 — 코드가 만든 그대로 들어간다(발송 전 마무리가 다르면 이 값으로 되돌린다)
    sn = lambda r: mkt.short_name(r["name"], r["kind"])
    ups = [sn(r) for r in ranked[::-1][:3] if r["contrib"] >= 0.03]
    downs = [sn(r) for r in ranked[:3] if r["contrib"] <= -0.03]
    fixed = [{"key": "head", "text": f"{color} *{signal_rules.LABEL[color]}* · 주간 {header}"},
             {"key": "port", "labels": ["*내 포트 한 주*", "*내 포트*"], "text": f"*내 포트 한 주* {P(port_week)} (주식만 {P(inv_week)} · 코스피 {P(k_week)})"}]
    if ups:
        fixed.append({"key": "up", "labels": ["*끌어올린 것*"], "text": "*끌어올린 것* " + " · ".join(ups)})
    if downs:
        fixed.append({"key": "down", "labels": ["*끌어내린 것*"], "text": "*끌어내린 것* " + " · ".join(downs)})
    if len(kr_week) >= 3:
        cnt = lambda c: sum(1 for e in kr_week.values() if e.get("color") == c)
        fixed.append({"key": "tally", "labels": ["*이번 주 신호*"],
                      "text": f"*이번 주 신호* 🔴 {cnt(signal_rules.RED)}일 · 🟡 {cnt(signal_rules.YELLOW)}일 · 🟢 {cnt(signal_rules.GREEN)}일"})
    L += ["", "### 요약에 그대로 넣을 줄 — 복사해서 쓴다 (한 글자도 고치지 않는다. 다르면 발송 단계가 이 값으로 되돌린다)", "", "```"] + [x["text"] for x in fixed] + ["```"]
    L += ["", "## 날짜별", "", "| 날짜 | 내 포트 | 코스피 | 그날 신호 |", "|---|---|---|---|"]
    for d in week:
        e = daily.get(d)
        flag = "" if not e else (" (입출금 보정)" if e.get("flowAdj") else "")
        s = kr_week.get(d)
        L.append(f"| {mkt.kdate(d)} | {P(e.get('dRatePct')) + flag if e else '기록 없음'} | {P(kday.get(d))} | {(s.get('color') + ' ' + '; '.join(s.get('reasons') or [])[:60]) if s else '—'} |")
    L += ["", "## 종목별 (한 주 등락 × 비중 → 포트 기여, 기여 낮은 순)", "", "| 종목 | 구분 | 한 주 | 비중 | 포트 기여 |", "|---|---|---|---|---|"]
    for r in ranked:
        L.append(f"| {r['name']} | {r['kind']} | {P(r['week'], 1)} | {r['w']:.1f}% | {r['contrib']:+.2f}%p |")
    for r in rows:
        if r["contrib"] is None:
            L.append(f"| {r['name']} | {r['kind']} | {P(r['week'], 1)} | {('%.1f%%' % r['w']) if r['w'] else '—'} | — |")
    L += ["", "포트 기여 = 그 종목이 한 주 동안 내 포트 전체를 몇 %p 움직였나(지금 비중 기준 근사 — 주중 매매는 반영되지 않는다).",
          "", "## 지수 (한 주)", "", "| 지표 | 종가 | 한 주 | 20거래일 |", "|---|---|---|---|"]
    for n in ("코스피", "코스닥", "S&P500", "나스닥100", "미국 반도체지수"):
        v = idx[n]
        L.append(f"| {n} | {v['close']:,.2f} | {P(v['week'])} | {P(v['d20'])} |" if v.get("close") else f"| {n} | 미수신 | — | — |")
    if us_week:
        L += ["", "이번 주 미국 아침 신호: " + " · ".join(f"{e.get('header', e.get('date'))} {e.get('color')}" for e in us_week)]
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(L) + "\n")
    if opt.get("signal-out"):
        with open(opt["signal-out"], "w", encoding="utf-8") as f:
            json.dump({"type": "weekly", "date": today, "header": header, "color": color, "label": signal_rules.LABEL[color], "reasons": reasons,
                       "port": None if port_week is None else round(port_week, 2), "kospi": None if k_week is None else round(k_week, 2),
                       "lines": fixed}, f, ensure_ascii=False)
    print(f"weekly-prefetch: week={week[0]}~{week[-1]} daily={len(have)}/5 holdings={hist}/{len(rows)} idx={sum(1 for v in idx.values() if v.get('week') is not None)}/5"
          f" fx={'ok' if fx else 'none'} kr_signals={len(kr_week)} signal={color}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        try:
            with open(sys.argv[2], "w", encoding="utf-8") as f:
                f.write("# 주간 사전 수집 — 실패\n\n- 사전 수집 스크립트 오류. 지시문의 대체 경로로 직접 받는다.\n")
        except Exception:
            pass
        print(f"weekly-prefetch: error {type(e).__name__}")
    sys.exit(0)
