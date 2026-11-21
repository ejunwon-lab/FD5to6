#!/usr/bin/env python3
"""US 마감 리포트 사전 수집 — 미국 시장 숫자와 신호 색을 코드가 계산해 표로 넘긴다.

배경: 2026-11-16 아침 리포트가 5거래일 전 종가를 전일 종가로 써서 미국 반도체지수 −3.43%를 +8.05%로,
     보유 종목 −4.76%를 +18.15%로 적었다(AI가 응답 필드를 골라 계산하던 방식). 숫자와 날짜·요일은 코드가 정하고
     AI는 글만 쓴다. 설계: docs/plans/2026-11-16-리포트-요약우선-신호등.md

출처: 네이버 금융 공개 API(해외 지수·종목 일봉과 현재가). 하루 등락 = 마지막 종가 ÷ 바로 앞 거래일 종가.
로그(공개)에는 개수·상태만 쓴다. 어떤 실패에도 exit 0 — 표 머리에 "실패"라고 적으면 AI가 지시문의 대체 경로를 탄다.

사용: us_prefetch.py <gas_metrics.json> <out.md> <오늘 KST YYYY-MM-DD> [--signals <_signals.jsonl>] [--signal-out <signal.json>]
"""
import datetime as dt
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mkt            # noqa: E402
import signal_rules   # noqa: E402

T = signal_rules.title   # 제목(이름표) 모양 — `*[내 포트]*`

INDEX = [("S&P500", ".INX"), ("나스닥100", ".NDX"), ("미국 반도체지수", ".SOX"), ("다우", ".DJI"), ("변동성지수(VIX)", ".VIX")]
BIG7 = [("애플", "AAPL.O"), ("마이크로소프트", "MSFT.O"), ("알파벳", "GOOGL.O"), ("아마존", "AMZN.O"), ("메타", "META.O"), ("엔비디아", "NVDA.O"), ("테슬라", "TSLA.O")]
SECTOR = [("기술", "XLK"), ("금융", "XLF"), ("에너지", "XLE"), ("헬스케어", "XLV"), ("임의소비재", "XLY"), ("필수소비재", "XLP"),
          ("산업재", "XLI"), ("소재", "XLB"), ("유틸리티", "XLU"), ("부동산", "XLRE.K"), ("통신서비스", "XLC")]
# 부동산만 네이버 코드에 접미사가 붙는다(.K) — `XLRE`로는 일봉이 0건이라 2026-11-17~20 리포트에서 `sectors=10/11`로 빠졌다(네이버 검색 API의 reutersCode로 확인).
US_HOLD_CAT = "해외주식"   # GAS 분류 — 이 분류의 보유 종목을 "보유 미국 주식"으로 본다(종목을 여기 적지 않는다)


def basic(kind, code):
    d = mkt.get(f"{mkt.API}/{kind}/{code}/basic")
    if not isinstance(d, dict):
        return None
    c, r = mkt.num(d.get("closePrice")), mkt.num(d.get("fluctuationsRatio"))
    if c is None:
        return None
    return {"close": c, "d1": r, "date": mkt.ymd(str(d.get("localTradedAt") or "")[:10]), "name": d.get("stockName") or d.get("indexName"),
            "symbol": d.get("symbolCode"), "closed": str(d.get("marketStatus") or "").upper() == "CLOSE"}


def series_quote(kind_path, code, end, use_basic=True, max_date=None):
    """일봉으로 하루·5거래일 변화율 (마지막 종가 ÷ 앞 거래일 종가).

    현재가 응답(basic)은 **장이 끝난 상태(CLOSE)일 때만** 보조로 쓴다 — 일봉에 아직 없는 마지막 날을 뒤에 붙인다.
    개장 전(PREOPEN)에는 현재가 응답의 등락률이 0으로 초기화되고 날짜가 오늘로 바뀌므로 쓰면 안 된다(2026-11-16 실측)."""
    s = mkt.day_series(f"foreign/{kind_path}/{code}", end, 40)
    if max_date:   # 이 리포트가 다루는 미국 마감일보다 뒤의 값(거의 24시간 거래되는 지표의 진행 중 값 등)은 버린다
        s = [x for x in s if x[0] <= max_date]
    b = basic("index" if kind_path == "index" else "stock", code) if use_basic else None
    if b and b["closed"] and b["date"] and (not s or b["date"] > s[-1][0]) and (not max_date or b["date"] <= max_date):
        s = s + [(b["date"], b["close"])]
    if len(s) < 2:
        return None
    return {"close": s[-1][1], "d1": mkt.chg(s, 1), "d5": mkt.chg(s, 5), "date": s[-1][0]}


def find_us_code(name):
    """보유 미국 주식 이름(시트 표기) → 네이버 종목 코드. 검색 API의 첫 미국 주식 결과."""
    d = mkt.get(f"https://m.stock.naver.com/front-api/search/autoComplete?query={urllib_quote(name)}&target=stock")
    for x in (((d or {}).get("result") or {}).get("items") or []):
        if str(x.get("nationCode") or "").upper() == "USA" and x.get("reutersCode"):
            return x["reutersCode"]
    return None


def urllib_quote(t):
    import urllib.parse
    return urllib.parse.quote(str(t))


def last_kr(path):
    last = None
    try:
        for line in open(path, encoding="utf-8"):
            try:
                e = json.loads(line)
            except Exception:
                continue
            if e.get("type") == "kr" and (last is None or str(e.get("date")) >= str(last.get("date"))):
                last = e
    except Exception:
        pass
    return last


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
    t = dt.date(int(today[:4]), int(today[5:7]), int(today[8:10]))
    exp = t - dt.timedelta(days=1)                       # 한국 아침에 보는 미국 마감 = 하루 전(현지), 주말이면 금요일
    while exp.weekday() >= 5:
        exp -= dt.timedelta(days=1)
    cap = exp.strftime("%Y%m%d")
    idx = {}
    for name, code in INDEX:
        idx[name] = series_quote("index", code, today, max_date=cap)
        time.sleep(0.1)
    got_idx = sum(1 for v in idx.values() if v and v.get("d1") is not None)
    dates = sorted(v["date"] for v in idx.values() if v and v.get("date"))
    us_date = dates[len(dates) // 2] if dates else None   # 지수들의 마감일(중앙값 — 한 지표만 늦게 갱신돼도 흔들리지 않게)
    out = []
    if not us_date or idx["미국 반도체지수"] is None or idx["나스닥100"] is None:
        out = ["# US 마감 사전 수집: 실패", "", "- 미국 시장 숫자를 받지 못했다. 지시문의 대체 경로(1-A)로 직접 받고, 신호 색은 지시문의 기준표로 판정한다."]
        with open(out_path, "w", encoding="utf-8") as f:
            f.write("\n".join(out) + "\n")
        print(f"us-prefetch: failed idx={got_idx}/{len(INDEX)}")
        return

    holiday = us_date < cap

    big = []
    for name, code in BIG7:
        b = series_quote("item", code, today, use_basic=False, max_date=cap)
        time.sleep(0.08)
        if b and b["d1"] is not None and b["date"] == us_date:   # 지수와 같은 마감일의 값만
            big.append((b["d1"], name))
    sec = []
    for name, code in SECTOR:
        b = series_quote("item", code, today, use_basic=False, max_date=cap)
        time.sleep(0.08)
        if b and b["d1"] is not None and b["date"] == us_date:
            sec.append((b["d1"], name))
    sec.sort(reverse=True)
    nvda = series_quote("item", "NVDA.O", today, max_date=cap)

    # 보유 미국 주식 — 목록의 원본은 GAS 보유현황(분류=해외주식). 여기에 종목을 적어 두지 않는다.
    held = []
    for h in gas.get("holdings") or []:
        if h.get("category") == US_HOLD_CAT and h.get("name"):
            code = find_us_code(h["name"])
            q = series_quote("item", code, today, max_date=cap) if code else None
            held.append({"name": h["name"], "weight": h.get("weight"), "q": q})
            time.sleep(0.1)

    # 내 한국 주식 — 미국 소식이 어디에 닿는지 판단할 재료. 같은 종목이 여러 계좌에 있으면 비중을 더한다.
    agg = {}
    for h in gas.get("holdings") or []:
        if str(h.get("category") or "").startswith("국내") and h.get("name"):
            agg[h["name"]] = agg.get(h["name"], 0.0) + (mkt.num(h.get("weight")) or 0.0)
    kr_hold = sorted(((w, n) for n, w in agg.items()), reverse=True)

    fx = mkt.fx_usdkrw()
    dxy = mkt.get(f"{mkt.API}/marketindex/exchange/.DXY") or {}
    tnx = mkt.get(f"{mkt.API}/marketindex/bond/US10YT=RR") or {}
    sox, ndx = idx["미국 반도체지수"]["d1"], idx["나스닥100"]["d1"]
    color, reasons = signal_rules.us_signal(sox, ndx)
    kr = last_kr(opt.get("signals")) if opt.get("signals") else None
    pr = gas.get("portfolioReturn") or {}
    op = (gas.get("recentReturns") or [{}])[-1].get("opRatePct")
    header = f"미국 {mkt.kdate(us_date)} 마감"

    L = [f"# US 마감 사전 수집: {header} (한국 {mkt.kdate(today)} 아침)", "",
         "- 아래 숫자는 코드가 받아 계산한 값이다. **하루 등락 = 마지막 종가 ÷ 바로 앞 거래일 종가.** 그대로 쓰고 다시 받거나 계산하지 않는다.", "",
         "## 요약 재료: 코드가 계산한 값 (요약 메시지에 색·숫자·날짜 표기를 **글자 그대로** 쓴다)", "",
         f"- 날짜 표기: {header}" + (f" · ⚠️ 어젯밤(현지 {mkt.kdate(cap)}) 기록이 없다: 미국 휴장이거나 자료가 아직 안 들어온 것. 지시문 Step 5를 따른다" if holiday else ""),
         f"- 신호: {color} {signal_rules.LABEL[color]}",
         "- 신호 이유: " + (" / ".join(reasons) if reasons else "없음 (기준에 걸린 것이 없다)"),
         "- 미국 시장 (하루): " + " · ".join(f"{n} {P(idx[n]['d1'])}" for n in ("S&P500", "나스닥100", "미국 반도체지수", "다우") if idx.get(n)),
         "- 엔비디아: " + (P(nvda["d1"]) if nvda else "미수신"),
         "- 보유 미국 주식: " + (" · ".join(f"{h['name']} {P(h['q']['d1']) if h['q'] else '미수신'} (전체 자산의 {h['weight']}%)" for h in held) if held else "없음 또는 목록 미수신"),
         "- 대형 기술주 7개: " + (f"오른 것 {sum(1 for d, _ in big if d > 0)}개 · 내린 것 {sum(1 for d, _ in big if d < 0)}개 · 가장 ▲ {max(big)[1]} {P(max(big)[0])} · 가장 ▼ {min(big)[1]} {P(min(big)[0])}" if big else "미수신"),
         "- 업종: " + (f"강한 곳 {' · '.join(f'{n} {P(d, 1)}' for d, n in sec[:3])} / 약한 곳 {' · '.join(f'{n} {P(d, 1)}' for d, n in sec[-3:][::-1])}" if len(sec) >= 6 else "미수신"),
         "- 최근 5거래일 (하루 등락과 혼동 금지): " + " · ".join(f"{n} {P(idx[n]['d5'])}" for n in ("나스닥100", "미국 반도체지수") if idx.get(n)),
         "- 변동성지수(VIX): " + (f"{idx['변동성지수(VIX)']['close']:.2f} ({P(idx['변동성지수(VIX)']['d1'])})" if idx.get("변동성지수(VIX)") else "미수신"),
         "- 원/달러: " + (f"{fx['close']:,.2f}원 ({fx['diff']:+.2f}원)" if fx and fx.get("diff") is not None else "미수신")
         + " · 달러지수: " + (f"{mkt.num(dxy.get('closePrice')):.2f}" if mkt.num(dxy.get("closePrice")) else "미수신")
         + " · 미국 10년 금리: " + (f"{mkt.num(tnx.get('closePrice')):.2f}%" if mkt.num(tnx.get("closePrice")) else "미수신") + " (셋 다 지금 시세)",
         "- 내 포트 (직전 한국장 마감 기준): " + (f"최근 5거래일 {P(pr.get('d5'))} · 20거래일 {P(pr.get('d20'))} · 누적 {P(op)}" if pr else "미수신"),
         "- 자산 비중: " + (" · ".join(f"{k} {v}%" for k, v in sorted((gas.get("assetClassWeights") or {}).items(), key=lambda x: -x[1]) if v) or "미수신"),
         "- 내 한국 주식 (비중 큰 순, 전체 자산 대비): " + (" · ".join(f"{n} {w:.1f}%" for w, n in kr_hold[:8]) or "미수신"),
         "- 지난 한국장: " + (f"{kr.get('header')} {kr.get('color')} 내 포트 {P(kr.get('port'))} · 코스피 {P(kr.get('kospi'))}" if kr else "기록 없음"),
         "", "## 미국 시장 표", "", "| 지표 | 종가 | 하루 | 5거래일 |", "|---|---|---|---|"]
    for n, _ in INDEX:
        v = idx.get(n)
        if v:
            L.append(f"| {n} | {v['close']:,.2f} | {P(v['d1'])} | {P(v['d5'])} |")
    # 요약의 뼈대 줄 — 어젯밤 기록이 없을 때(휴장 또는 자료 지연)는 만들지 않는다(지시문 Step 5가 처리)
    fixed = []
    if not holiday:
        fixed = [{"key": "head", "text": f"{color} *{signal_rules.LABEL[color]}* · {header}"},
                 {"key": "us", "labels": [T("미국")], "text": f"{T('미국')}\n* 나스닥100 {P(ndx)}\n* 반도체지수 {P(sox)}"}]
        rb = signal_rules.reason_block(color, reasons)
        if rb:
            fixed.append({"key": "reason", "text": rb})
        blk = ["### 요약에 그대로 넣을 묶음: 복사해서 쓴다 (한 글자도 고치지 않는다. 다르면 발송 단계가 이 값으로 되돌린다)", "", "```"]
        for x in fixed:
            blk += x["text"].split("\n") + [""]
        blk[-1] = "```"
        w = lambda t: t + " " * max(0, 12 - mkt.disp_w(t))
        blk += ["", "### 근거에 그대로 넣을 묶음: 복사해서 쓴다", "", "~~~", T("미국 시장"), "```"]
        for n, short in (("S&P500", "S&P500"), ("나스닥100", "나스닥100"), ("미국 반도체지수", "반도체지수"), ("다우", "다우")):
            if idx.get(n):
                blk.append(w(short) + f"{P(idx[n]['d1']):>8}")
        blk += ["```", "~~~", ""]
        i = L.index("## 미국 시장 표")
        L[i:i] = blk
    if nvda:
        L.append(f"| 엔비디아 | {nvda['close']:,.2f} | {P(nvda['d1'])} | {P(nvda['d5'])} |")
    for h in held:
        if h["q"]:
            L.append(f"| {h['name']} (보유) | {h['q']['close']:,.2f} | {P(h['q']['d1'])} | {P(h['q']['d5'])} |")
    if big:
        L += ["", "대형 기술주 7개 (하루): " + " · ".join(f"{n} {P(d)}" for d, n in sorted(big, reverse=True))]
    if sec:
        L += ["", "업종 ETF 11개 (하루, 높은 순): " + " · ".join(f"{n} {P(d)}" for d, n in sec)]
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(L) + "\n")
    if opt.get("signal-out"):
        with open(opt["signal-out"], "w", encoding="utf-8") as f:
            json.dump({"type": "us", "date": today, "usDate": us_date, "header": header, "color": color, "label": signal_rules.LABEL[color],
                       "reasons": reasons, "sox": None if sox is None else round(sox, 2), "ndx": None if ndx is None else round(ndx, 2),
                       "stale": holiday, "lines": fixed}, f, ensure_ascii=False)
    print(f"us-prefetch: us_date={us_date} holiday={'yes' if holiday else 'no'} idx={got_idx}/{len(INDEX)} big7={len(big)}/7 sectors={len(sec)}/11"
          f" held={sum(1 for h in held if h['q'])}/{len(held)} fx={'ok' if fx else 'none'} signal={color} reasons={len(reasons)}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        try:
            with open(sys.argv[2], "w", encoding="utf-8") as f:
                f.write("# US 마감 사전 수집: 실패\n\n- 사전 수집 스크립트 오류. 지시문의 대체 경로(1-A)로 직접 받고, 신호 색은 지시문의 기준표로 판정한다.\n")
        except Exception:
            pass
        print(f"us-prefetch: error {type(e).__name__}")
    sys.exit(0)
