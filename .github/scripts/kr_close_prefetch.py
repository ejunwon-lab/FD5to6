#!/usr/bin/env python3
"""KR 마감 리포트 사전 수집 — 보유 종목의 **정규장 종가**·등락률과, 정규장 마감 직후 받아 둔 시장 숫자를 표로 만든다.

배경: 2026-09-14 거래소 애프터마켓(16:00~20:00) 개설 뒤 17시대의 네이버 표시가는 애프터마켓 진행가다.
     리포트가 그 값을 종가로 쓰지 않도록, 정규장 마감 +5~29분에 GAS가 잠근 기록을 쓰고
     네이버 분봉의 정규장 마감 값과 대조한다. 설계: docs/plans/2026-11-14-정규장종가-마감기록-애프터마켓알림.md

보유 종목 가격의 출처 (위에서부터):
  1) GAS portfolioMetrics 의 krClose — 오늘 날짜이고 잠긴 기록. 종목마다 네이버 분봉 마감 값과 대조하고, 다르면 분봉 값을 쓴다.
  2) 그 밖(잠금 실패·휴장일·GAS 응답 없음) — 네이버 분봉 마감 값 ÷ 기준가(전 거래일 정규장 종가).
보유 목록의 출처 (2026-11-16 — 지시문에 손으로 적은 목록을 없앰. 설계: docs/plans/2026-11-16-리포트-보유목록-GAS-단일출처.md):
  GAS 보유현황(krClose.items)이 유일한 원본이다. 지시문·이 스크립트 어디에도 종목 목록을 적어 두지 않는다.
  GAS 응답이 없을 때만 직전 성공 때 이 스크립트가 써 둔 사본(_kr_holdings.json, 비공개 리포트 저장소)을 쓴다 —
  사람이 고치는 파일이 아니라 성공할 때마다 덮어쓰는 캐시다. 표에 "구분"(국내주식/ETF) 칸을 넣어 지시문이 종목을 나열하지 않게 한다.
  투자 논리 파일(kr-theses.md, 사용자 소유)에 없는 보유 종목은 표 아래에 "논리 미등록"으로 적는다(리포트에 드러나게).

이 저장소의 실행 로그는 공개다 — 표준 출력에는 개수·상태만 쓰고 종목명·가격은 쓰지 않는다 (표는 러너의 임시 파일로만).
어떤 실패에도 exit 0: 리포트 에이전트는 표 머리의 상태 문구를 보고 대체 경로를 탄다.

요약 재료 (2026-11-16 — 설계: docs/plans/2026-11-16-리포트-요약우선-신호등.md):
  요약 메시지에 들어갈 숫자(내 포트·주식 부분·코스피·기여도 순위·5일·환율)와 **신호 색**을 여기서 계산해 표 위에 적는다.
  AI는 그 숫자와 색을 그대로 옮기고 글만 쓴다. 색 규칙은 signal_rules.py, 시세 도구는 mkt.py.
  이 부분이 실패해도 아래 보유 종목 표는 그대로 나간다(요약 재료만 "계산 실패"로 표시).

사용: kr_close_prefetch.py <gas_metrics.json> <out.md> <오늘 YYYY-MM-DD> [_kr_holdings.json] [kr-theses.md]
                          [--signals <_signals.jsonl>] [--signal-out <signal.json>]
"""
import json
import os
import re
import sys
import time
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mkt            # noqa: E402
import signal_rules   # noqa: E402

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
SHIFT_MIN = {"2026-11-19": 60}   # 정규장 마감이 늦는 날(분) — GAS MarketClose.js 의 MC.SHIFT_MIN 과 같이 고친다


def get(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception:
        return None


def num(s):
    try:
        return float(str(s).replace(",", ""))
    except Exception:
        return 0.0


def hhmm(mins):
    return f"{mins // 60:02d}{mins % 60:02d}"


def close_min(date, gas_hhmm=None):
    if gas_hhmm and re.fullmatch(r"\d{4}", str(gas_hhmm)):
        return int(gas_hhmm[:2]) * 60 + int(gas_hhmm[2:])
    return 15 * 60 + 30 + SHIFT_MIN.get(date, 0)


def minute_close(code, date, cmin):
    """분봉에서 정규장 마감 값 — 마감 +9분까지의 마지막 체결가 (그 뒤 10분은 종가 거래, +30분부터 애프터마켓)."""
    ymd = date.replace("-", "")
    bars = get(f"https://api.stock.naver.com/chart/domestic/item/{code}/minute"
               f"?startDateTime={ymd}{hhmm(cmin - 120)}&endDateTime={ymd}{hhmm(cmin + 9)}")
    if not isinstance(bars, list):
        return None
    cut, last_at, last = f"{ymd}{hhmm(cmin + 9)}59", "", 0.0
    for b in bars:
        at, p = str(b.get("localDateTime", "")), num(b.get("currentPrice"))
        if p > 0 and last_at <= at <= cut:
            last_at, last = at, p
    return last or None


def naver_base(code):
    """기준가(전 거래일 정규장 종가) = 표시가 − 전일 대비. 표시가가 애프터마켓 가격이어도 이 차는 기준가다."""
    d = get(f"https://m.stock.naver.com/api/stock/{code}/basic")
    if not d:
        return None, None
    base = num(d.get("closePrice")) - num(d.get("compareToPreviousClosePrice"))
    return (base if base > 0 else None), d.get("stockName")


def norm(t):
    return re.sub(r"\s+", "", str(t or "")).upper()


def kind_of(cat):
    """GAS 분류 → 표의 구분. 회사 단위 뉴스·수급 대상은 '국내주식'뿐."""
    cat = str(cat or "")
    return "국내주식" if cat == "국내주식" else ("ETF" if "ETF" in cat.upper() else (cat or "—"))


def load_cache(path):
    """직전 성공 때의 보유 목록 사본 — [(code, name, kind)]. 없거나 깨졌으면 []."""
    try:
        d = json.load(open(path, encoding="utf-8"))
        return [(str(x["code"]), x.get("name"), x.get("kind") or "—") for x in d.get("items") or [] if x.get("code")], d.get("date")
    except Exception:
        return [], None


def save_cache(path, date, rows):
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"_": "kr_close_prefetch.py가 성공할 때마다 덮어쓰는 캐시 — 손으로 고치지 않는다. 원본은 GAS 보유현황.",
                       "date": date, "items": [{"code": c, "name": n, "kind": k} for n, c, _p, _g, k in rows]},
                      f, ensure_ascii=False, indent=1)
            f.write("\n")
    except Exception:
        pass


def pct(v):
    return "—" if v is None else f"{v:+.2f}%"


def disp_w(t):
    return sum(2 if ord(ch) > 0x1100 else 1 for ch in t)


def pad(t, w):
    return t + " " * max(0, w - disp_w(t))


def read_low_step(path, typ="kr"):
    """신호 기록(_signals.jsonl)에서 지금까지 가장 낮았던 누적 수익률 계단. 기록이 없으면 None."""
    low = None
    try:
        for line in open(path, encoding="utf-8"):
            try:
                e = json.loads(line)
            except Exception:
                continue
            if e.get("type") == typ and isinstance(e.get("step"), (int, float)):
                low = e["step"] if low is None else min(low, e["step"])
    except Exception:
        pass
    return low


def summary_material(gas, rows, asof, today, signals_path):
    """요약 메시지의 재료 — (마크다운 줄들, 신호 dict, 종목별 부가 값 {code: {...}}, 로그용 상태 문자열)."""
    wsum = {}
    for h in gas.get("holdings") or []:
        wsum[norm(h.get("name"))] = wsum.get(norm(h.get("name")), 0.0) + (mkt.num(h.get("weight")) or 0.0)
    extra, tot_pre, tot_c, hist_ok = {}, 0.0, 0.0, 0
    for n, c, p, g, k in rows:
        w = wsum.get(norm(n))
        e = {"w": w, "contrib": None, "d5": None, "streak": None}
        if w and g is not None:
            w_pre = w / (1 + g / 100)
            e["contrib"] = w_pre * g / 100
            tot_pre += w_pre
            tot_c += e["contrib"]
        ser = mkt.official_series(c, asof, p) if p else []   # 정규장 종가만으로 만든 일별 값(오늘 = 표의 정규장 종가)
        time.sleep(0.12)
        if len(ser) >= 6:
            hist_ok += 1
            e["d5"] = mkt.chg(ser, 5, asof)
            e["streak"] = mkt.down_streak(ser)
        extra[c] = e
    inv = (tot_c / tot_pre * 100) if tot_pre > 0 else None
    approx = tot_c if tot_pre > 0 else None

    daily = next((x for x in reversed(gas.get("dailyReturns") or []) if x.get("date") == asof), None)
    port, port_src = (daily.get("dRatePct"), "gas") if daily and daily.get("dRatePct") is not None else (approx, "approx")
    op = next((x.get("opRatePct") for x in reversed(gas.get("recentReturns") or []) if x.get("date") == asof), None)
    pr = gas.get("portfolioReturn") or {}

    idx, idx_ok = {}, 0
    mk_idx = ((gas.get("marketClose") or {}).get("index") or {}) if (gas.get("marketClose") or {}).get("date") == asof else {}
    for code in ("KOSPI", "KOSDAQ"):
        ser = mkt.day_series(f"domestic/index/{code}", asof, 70)
        v = {"pct": mkt.chg(ser, 1, asof), "d5": mkt.chg(ser, 5, asof), "d20": mkt.chg(ser, 20, asof),
             "close": ser[-1][1] if ser and ser[-1][0] == mkt.ymd(asof) else None}
        if v["pct"] is None and (mk_idx.get(code) or {}).get("pct") is not None:   # 일봉을 못 받으면 마감 직후 저장분
            v["pct"], v["close"] = mk_idx[code]["pct"], mkt.num(mk_idx[code].get("close"))
        idx_ok += 1 if v["pct"] is not None else 0
        idx[code] = v
    fx = mkt.fx_usdkrw()

    low = read_low_step(signals_path) if signals_path else None
    if low is None:   # 첫 실행 — 최근 기록의 최저 계단에서 출발(첫날부터 "처음 내려감"이 뜨지 않게)
        past = [signal_rules.loss_step(x.get("opRatePct")) for x in (gas.get("recentReturns") or []) if x.get("opRatePct") is not None]
        low = min(past) if past else None
    sig_rows = [{"name": n, "kind": k, "pct": g} for n, c, p, g, k in rows]
    color, reasons, step = signal_rules.kr_signal(port, inv, idx["KOSPI"]["pct"], sig_rows, op, low)

    ranked = sorted(((extra[c]["contrib"], n, g) for n, c, p, g, k in rows if extra[c]["contrib"] is not None))
    drags = [x for x in ranked if x[0] <= -0.03][:3]
    lifts = [x for x in reversed(ranked) if x[0] >= 0.03][:2]
    mover = lambda x: f"{x[1]} {pct(x[2])} (포트 {x[0]:+.2f}%p)"
    kind_by = {n: k for n, c, p, g, k in rows}
    sn = lambda n: mkt.short_name(n, kind_by.get(n))
    up_day = port is not None and port >= 0
    if up_day:   # 오른 날은 끌어올린 것이 먼저
        ups = [x for x in reversed(ranked) if x[0] >= 0.03][:3]
        mover_lines = ["- 끌어올린 것 (포트에 준 영향이 큰 순): " + (" · ".join(mover(x) for x in ups) if ups else "없음"),
                       "- 발목 잡은 것: " + (" · ".join(mover(x) for x in drags[:2]) if drags else "없음")]
        fixed_movers = [("*끌어올린 것*", [sn(x[1]) for x in ups]), ("*발목 잡은 것*", [sn(x[1]) for x in drags[:2]])]
    else:
        least = [n for g, n in sorted(((g, n) for n, c, p, g, k in rows if g is not None), reverse=True)[:2]]
        mover_lines = ["- 끌어내린 것 (포트에 준 영향이 큰 순): " + (" · ".join(mover(x) for x in drags) if drags else "없음"),
                       ("- 받쳐 준 것: " + " · ".join(mover(x) for x in lifts)) if lifts else
                       ("- 덜 빠진 것 (포트를 받쳐 줄 만큼 오른 종목은 없음): "
                        + " · ".join(f"{n} {pct(g)}" for g, n in sorted(((g, n) for n, c, p, g, k in rows if g is not None), reverse=True)[:2]))]
        fixed_movers = [("*끌어내린 것*", [sn(x[1]) for x in drags]),
                        ("*받쳐 준 것*", [sn(x[1]) for x in lifts]) if lifts else ("*덜 빠진 것*", [sn(n) for n in least])]
    holiday = asof != today
    # GAS가 "입출금 의심"으로 표시한 날이라도, 보유 종목 등락으로 다시 계산한 값과 0.5%p 안에서 맞으면 시장 움직임이다 — 경고를 붙이지 않는다
    flow_note = ""
    if daily and daily.get("suspect") and port_src == "gas" and (approx is None or abs(port - approx) > 0.5):
        flow_note = " · ⚠️ 입출금이 섞였을 수 있음" + ("" if approx is None else f" — 보유 종목 등락만으로 계산하면 {approx:+.2f}%")
    P = mkt.pct
    L = ["## 요약 재료 — 코드가 계산한 값 (요약 메시지에 색·숫자·날짜 표기를 **글자 그대로** 쓴다. 다시 계산하지 않는다)", "",
         f"- 날짜 표기: {mkt.kdate(asof)}" + (f" — 오늘({mkt.kdate(today)})은 새 기록이 없어 직전 거래일 기준" if holiday else ""),
         f"- 신호: {color} {signal_rules.LABEL[color]}",
         "- 신호 이유: " + (" / ".join(reasons) if reasons else "없음 (기준에 걸린 것이 없다)"),
         f"- 내 포트 오늘: {P(port)} (현금까지 포함한 전체" + ("" if port_src == "gas" else " · 보유 종목 등락으로 계산한 근사값")
         + (flow_note) + (" · 입출금 보정값" if daily and daily.get("flowAdj") else "") + ")",
         f"- 주식 부분만: {P(inv)} · 코스피 {P(idx['KOSPI']['pct'])} · 코스닥 {P(idx['KOSDAQ']['pct'])}"
         + ("" if inv is None or idx["KOSPI"]["pct"] is None else
            f" → 주식 부분이 코스피보다 {abs(inv - idx['KOSPI']['pct']):.1f}%p " + ("덜 빠짐" if inv > idx["KOSPI"]["pct"] and inv < 0 else
                                                                         "더 빠짐" if inv < idx["KOSPI"]["pct"] and inv < 0 else
                                                                         "더 오름" if inv > idx["KOSPI"]["pct"] else "덜 오름")),
         *mover_lines,
         f"- 최근 5거래일: 내 포트 {P(pr.get('d5'))} · 코스피 {P(idx['KOSPI']['d5'])} · 코스닥 {P(idx['KOSDAQ']['d5'])} (같은 구간)",
         f"- 최근 20거래일: 내 포트 {P(pr.get('d20'))} · 코스피 {P(idx['KOSPI']['d20'])}",
         f"- 누적 수익률: {P(op)}",
         "- 자산 비중: " + " · ".join(f"{k} {v}%" for k, v in sorted((gas.get("assetClassWeights") or {}).items(), key=lambda x: -x[1]) if v),
         "- 지수: " + " · ".join(f"{c} {idx[c]['close']:,.2f} ({P(idx[c]['pct'])})" if idx[c]["close"] else f"{c} 미수신" for c in ("KOSPI", "KOSDAQ")),
         "- 원/달러: " + (f"{fx['close']:,.2f}원 ({fx['diff']:+.2f}원, {fx['at']} 고시)" if fx and fx.get("diff") is not None else "미수신"),
         "", "### 근거 표 초안 — 국내주식 (판단 칸만 채워서 쓴다)", "", "```", pad("종목", 11) + "  오늘    5일"]
    for n, c, p, g, k in rows:
        if k == "국내주식":
            L.append(pad(n, 11) + f"{pct(g):>7}" + f"{P(extra[c]['d5'], 1):>7}" + (f"  {extra[c]['streak']}일째↓" if (extra[c]["streak"] or 0) >= 3 else ""))
    L += ["```", ""]
    # 요약의 뼈대 줄 — 코드가 만든 그대로 들어간다(발송 전 마무리가 다르면 이 값으로 되돌린다)
    labels = signal_rules.LABEL
    head = (f"{color} *{labels[color]}* · KR 휴장 — {mkt.kdate(asof)} 기준" if holiday else f"{color} *{labels[color]}* · KR 마감 {mkt.kdate(asof)}")
    # 묶음 = 이름표 줄 + 그 아래 `* ` 줄. 글머리표는 `*`(하이픈은 마이너스와 헷갈린다)
    fixed = [{"key": "head", "text": head},
             {"key": "port", "labels": ["*내 포트*"], "text": f"*내 포트*  {P(port)}\n* 주식만 {P(inv)} · 코스피 {P(idx['KOSPI']['pct'])}"}]
    for key, (lab, names) in zip(("mover1", "mover2"), fixed_movers):
        fixed.append({"key": key, "labels": ["*끌어내린 것*", "*끌어올린 것*"] if key == "mover1" else ["*받쳐 준 것*", "*덜 빠진 것*", "*발목 잡은 것*"],
                      "text": f"{lab}\n* " + (" · ".join(names) if names else "없음")})
    rb = signal_rules.reason_block(color, reasons)
    if rb:
        fixed.append({"key": "reason", "text": rb})
    L += ["### 요약에 그대로 넣을 묶음 — 복사해서 쓴다 (한 글자도 고치지 않는다. 다르면 발송 단계가 이 값으로 되돌린다)", "", "```"]
    for x in fixed:
        L += x["text"].split("\n") + [""]
    L[-1] = "```"
    L.append("")
    stock_w = sum(v for k, v in (gas.get("assetClassWeights") or {}).items() if "주식" in k or "ETF" in k.upper())
    cash_w = (gas.get("assetClassWeights") or {}).get("현금성")
    L += ["### 근거에 그대로 넣을 묶음 — 복사해서 쓴다 (비중 묶음의 '반도체·AI'만 직접 더해 채운다)", "", "~~~",
          "*흐름*",
          f"* 5일 {P(pr.get('d5'))} (코스피 {P(idx['KOSPI']['d5'])})",
          f"* 20일 {P(pr.get('d20'))} · 누적 {P(op)}",
          "",
          "*비중*",
          f"* 주식 {stock_w:.0f}% · 현금 {cash_w:.0f}%" if cash_w is not None else "* 주식 — · 현금 —",
          "* 반도체·AI 약 {N}%",
          "",
          "*시장*",
          "```"]
    for label, code in (("코스피", "KOSPI"), ("코스닥", "KOSDAQ")):
        v = idx[code]
        L.append(pad(label, 8) + (f"{v['close']:>9,.2f}" if v["close"] else f"{'미수신':>7}") + f"{P(v['pct']):>8}")
    L.append(pad("원/달러", 8) + (f"{fx['close']:>9,.2f}{fx['diff']:>+8.2f}" if fx and fx.get("diff") is not None else f"{'미수신':>7}"))
    L += ["```", "~~~", ""]
    sig = {"type": "kr", "date": asof, "header": mkt.kdate(asof), "color": color, "label": signal_rules.LABEL[color], "reasons": reasons,
           "port": port, "inv": None if inv is None else round(inv, 2), "kospi": None if idx["KOSPI"]["pct"] is None else round(idx["KOSPI"]["pct"], 2),
           "step": step, "lowStep": low, "portSource": port_src, "lines": fixed}
    diff = "" if (approx is None or port_src != "gas" or port is None) else f" port_diff={abs(port - approx):.2f}"
    status = f"signal={color} reasons={len(reasons)} port_src={port_src}{diff} idx={idx_ok}/2 fx={'ok' if fx else 'none'} hist={hist_ok}/{len(rows)}"
    return L, sig, extra, status


def main():
    argv, opt = [], {}
    it = iter(sys.argv[1:])
    for a in it:
        if a.startswith("--"):
            opt[a[2:]] = next(it, None)
        else:
            argv.append(a)
    gas_path, out_path, today = argv[0], argv[1], argv[2]
    cache_path = argv[3] if len(argv) > 3 else None
    theses_path = argv[4] if len(argv) > 4 else None
    try:
        gas = json.load(open(gas_path, encoding="utf-8"))
    except Exception:
        gas = {}
    kc = gas.get("krClose") or {}
    items = [x for x in (kc.get("items") or []) if x.get("code")]
    asof = kc.get("date") or today
    cmin = close_min(asof, kc.get("closeHHMM"))
    use_gas = bool(items) and kc.get("date") == today and kc.get("locked") is True
    cat_of = {norm(h.get("name")): h.get("category") for h in (gas.get("holdings") or [])}
    kind = lambda name: kind_of(cat_of.get(norm(name)))
    list_src = "gas" if items else "cache"
    cached, cache_date = ([], None) if items else load_cache(cache_path or "")
    if not items and not cached:
        list_src = "none"

    rows, match, checked, replaced = [], 0, 0, 0
    if use_gas:
        source = "GAS 잠금 기록(정규장 마감 직후) — 네이버 분봉과 대조"
        for x in items:
            close, chg = num(x.get("close")), x.get("changePct")
            mc = minute_close(x["code"], asof, cmin)
            time.sleep(0.15)
            if mc:
                checked += 1
                if abs(mc - close) < 0.5:
                    match += 1
                else:   # 잠금 값이 분봉의 정규장 마감 값과 다르면 분봉 값 — 등락률도 기준가로 다시 계산
                    base, _ = naver_base(x["code"])
                    close, chg = mc, ((mc / base - 1) * 100 if base else None)
                    replaced += 1
            rows.append((x.get("name") or x["code"], x["code"], close, chg, kind(x.get("name"))))
    else:
        source = "네이버 분봉의 정규장 마감 값 ÷ 기준가"
        codes = [(x["code"], x.get("name"), kind(x.get("name"))) for x in items] or cached
        for code, name, kd in codes:
            mc = minute_close(code, asof, cmin)
            base, nm = naver_base(code)
            time.sleep(0.15)
            rows.append((name or nm or code, code, mc, ((mc / base - 1) * 100) if (mc and base) else None, kd))

    # 투자 논리 파일에 없는 보유 종목 — 종목명 또는 코드가 파일 어디에도 없으면 미등록
    try:
        theses = open(theses_path, encoding="utf-8").read() if theses_path else None
    except Exception:
        theses = None
    no_thesis = [] if theses is None else [n for n, c, _p, _g, _k in rows if c not in theses and norm(n) not in norm(theses)]

    got = sum(1 for r in rows if r[2])
    material, sig, extra, sig_status = [], None, {}, "signal=none"
    if rows and got:
        try:
            material, sig, extra, sig_status = summary_material(gas, rows, asof, today, opt.get("signals"))
        except Exception as e:   # 요약 재료가 실패해도 표는 나간다
            material = ["## 요약 재료 — **계산 실패**", "",
                        "- 요약의 숫자는 아래 표에서 직접 읽고, 신호 색은 지시문의 기준표로 직접 판정한다. 날짜·요일은 Bash `date`로 확인한다.", ""]
            sig_status = f"signal=error:{type(e).__name__}"
    out = [f"# KR 마감 사전 수집 — {asof} 기준" + ("" if asof == today else f" (오늘 {today}은 새 기록 없음 — 직전 거래일 값)"), ""]
    if rows and got:
        out += [f"- 보유 종목 가격은 **정규장 종가**다(애프터마켓 가격 아님). 출처: {source}.",
                "- 아래 표의 종가·등락률을 **그대로** 쓴다. 이 시각에 네이버 `/basic`을 다시 부르면 애프터마켓 진행가가 나오므로 부르지 않는다.", "",
                "- **이 표가 보유 종목 목록의 유일한 기준이다** (GAS 보유현황에서 온 것). 표에 없는 종목은 보유가 아니다.",
                "- 구분이 `국내주식`인 종목만 회사 단위 뉴스·수급 대상이다. `ETF`는 등락만 본다."]
        if list_src == "cache":
            out += [f"- ⚠️ GAS 응답이 없어 **{cache_date or '이전'} 기준 보유 목록 사본**을 썼다 — 그 뒤의 매매는 반영되지 않았을 수 있다고 리포트에 한 줄 밝힌다."]
        out += [""] + material
        ex = lambda c, key, fmt: "—" if (extra.get(c) or {}).get(key) is None else fmt(extra[c][key])
        out += ["## 보유 종목 (정규장 종가 기준)", "",
                "| 종목 | 코드 | 구분 | 정규장 종가 | 등락률 | 비중 | 포트 기여 | 5일 | 연속 하락 |", "|---|---|---|---|---|---|---|---|---|"]
        out += [f"| {n} | {c} | {k} | {('%s' % format(round(p), ',')) if p else '—'} | {pct(g)} | {ex(c, 'w', lambda v: f'{v:.1f}%')} | "
                f"{ex(c, 'contrib', lambda v: f'{v:+.2f}%p')} | {ex(c, 'd5', lambda v: f'{v:+.1f}%')} | {ex(c, 'streak', lambda v: f'{v}일' if v else '—')} |"
                for n, c, p, g, k in rows]
        out += ["", "비중 = 현금까지 포함한 전체 자산 대비. 포트 기여 = 그 종목이 오늘 내 포트 전체를 몇 %p 움직였나. 5일 = 최근 5거래일 변화율."]
        if no_thesis:
            out += ["", f"**논리 미등록 {len(no_thesis)}종목**: " + " · ".join(no_thesis)
                    + " — 투자 논리 파일에 없다. 리포트의 논리 칸에 `(논리 미등록)`이라고 쓰고, 논리 점검 끝에 \"논리 미등록 n종목 — 투자 논리 파일에 추가 필요\" 한 줄을 넣는다. 논리를 지어내지 않는다."]
    else:
        out += ["- **보유 종목 사전 수집 실패**" + (" (보유 목록도 받지 못함 — 가장 최근 `docs/reports/KR-*.md`의 포트 표에 나온 종목을 보유 목록으로 쓰고, 리포트에 \"보유 목록은 직전 리포트 기준\"이라고 밝힌다)" if not rows else "")
                + " — 지시문의 대체 경로(1-B)로 가격을 받는다. 16시 이후의 네이버 표시가는 애프터마켓 가격이므로, "
                "분봉 API의 정규장 마감 값을 쓰거나 리포트에 \"애프터마켓 반영가\"라고 밝힌다."]
        if rows:   # 가격은 못 받았어도 보유 목록은 넘긴다
            out += ["", "## 보유 종목 (가격 없음 — 목록만)", "", "| 종목 | 코드 | 구분 |", "|---|---|---|"]
            out += [f"| {n} | {c} | {k} |" for n, c, _p, _g, k in rows]
    if list_src == "gas" and rows and cache_path:
        save_cache(cache_path, asof, rows)

    mk = gas.get("marketClose") or {}
    mk_state = "없음"
    if mk.get("date") == asof and mk.get("sectors"):
        mk_state = f"{mk.get('at')} 수집" + (" (늦음)" if mk.get("late") else "")
        out += ["", "## 시장 숫자 — " + (f"{mk.get('at')}에 받아 둔 값" + (" ⚠️ 애프터마켓 시작 뒤에 받은 값 — 리포트에 \"업종·순위는 장 마감 뒤 값\"이라고 밝힌다"
                                                                if mk.get("late") else " (정규장 마감 직후)")), ""]
        idx = mk.get("index") or {}
        out += ["| 지수 | 종가 | 등락률 | 거래대금 |", "|---|---|---|---|"]
        for k in ("KOSPI", "KOSDAQ"):
            v = idx.get(k) or {}
            out.append(f"| {k} | {v.get('close', '—')} | {pct(v.get('pct'))} | {v.get('value') or '—'} |")
        sec = mk["sectors"]
        out += ["", f"### 업종 등락 (전체 {len(sec)}개, 높은 순)", "", " · ".join(f"{n} {r:+.2f}%" for n, r in sec)]
        for title, key in (("급등 상위", "up"), ("급락 상위", "down")):
            out += ["", f"### {title}", "", " · ".join(f"{n}({c}) {r:+.2f}%" for n, c, r in (mk.get(key) or []))]
    else:
        out += ["", "## 시장 숫자 — **사전 수집분 없음**", "",
                "- 지수·업종·순위는 지시문의 주소(1-A·1-D)로 받는다. 지수는 정규장 마감 뒤 움직이지 않는다. "
                "업종 등락·급등락 순위는 16시 이후 값에 애프터마켓이 섞일 수 있으니 리포트에 \"장 마감 뒤 값\"이라고 밝힌다."]

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")
    if sig and opt.get("signal-out"):
        try:
            with open(opt["signal-out"], "w", encoding="utf-8") as f:
                json.dump(sig, f, ensure_ascii=False)
        except Exception:
            pass
    print(f"prefetch: asof={asof} holdings={len(rows)} priced={got} source={'gas-lock' if use_gas else 'naver-minute'}"
          f" crosscheck={match}/{checked} replaced={replaced} market={mk_state}"
          f" list={list_src} stocks={sum(1 for r in rows if r[4] == '국내주식')} etf={sum(1 for r in rows if r[4] == 'ETF')}"
          f" no_thesis={len(no_thesis)} {sig_status}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:   # 리포트 생성은 계속 — 에이전트가 대체 경로를 탄다
        try:
            with open(sys.argv[2], "w", encoding="utf-8") as f:
                f.write("# KR 마감 사전 수집 — 실패\n\n- 사전 수집 스크립트 오류. 지시문의 대체 경로로 수집한다. "
                        "16시 이후의 네이버 표시가는 애프터마켓 가격이다.\n")
        except Exception:
            pass
        print(f"prefetch: error {type(e).__name__}")
    sys.exit(0)
