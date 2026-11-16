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

사용: kr_close_prefetch.py <gas_metrics.json> <out.md> <오늘 YYYY-MM-DD> [_kr_holdings.json] [kr-theses.md]
"""
import json
import re
import sys
import time
import urllib.request

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


def main():
    gas_path, out_path, today = sys.argv[1], sys.argv[2], sys.argv[3]
    cache_path = sys.argv[4] if len(sys.argv) > 4 else None
    theses_path = sys.argv[5] if len(sys.argv) > 5 else None
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
    out = [f"# KR 마감 사전 수집 — {asof} 기준" + ("" if asof == today else f" (오늘 {today}은 새 기록 없음 — 직전 거래일 값)"), ""]
    if rows and got:
        out += [f"- 보유 종목 가격은 **정규장 종가**다(애프터마켓 가격 아님). 출처: {source}.",
                "- 아래 표의 종가·등락률을 **그대로** 쓴다. 이 시각에 네이버 `/basic`을 다시 부르면 애프터마켓 진행가가 나오므로 부르지 않는다.", "",
                "- **이 표가 보유 종목 목록의 유일한 기준이다** (GAS 보유현황에서 온 것). 표에 없는 종목은 보유가 아니다.",
                "- 구분이 `국내주식`인 종목만 회사 단위 뉴스·수급 대상이다. `ETF`는 등락만 본다."]
        if list_src == "cache":
            out += [f"- ⚠️ GAS 응답이 없어 **{cache_date or '이전'} 기준 보유 목록 사본**을 썼다 — 그 뒤의 매매는 반영되지 않았을 수 있다고 리포트에 한 줄 밝힌다."]
        out += ["", "## 보유 종목 (정규장 종가 기준)", "", "| 종목 | 코드 | 구분 | 정규장 종가 | 등락률 |", "|---|---|---|---|---|"]
        out += [f"| {n} | {c} | {k} | {('%s' % format(round(p), ',')) if p else '—'} | {pct(g)} |" for n, c, p, g, k in rows]
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
    print(f"prefetch: asof={asof} holdings={len(rows)} priced={got} source={'gas-lock' if use_gas else 'naver-minute'}"
          f" crosscheck={match}/{checked} replaced={replaced} market={mk_state}"
          f" list={list_src} stocks={sum(1 for r in rows if r[4] == '국내주식')} etf={sum(1 for r in rows if r[4] == 'ETF')}"
          f" no_thesis={len(no_thesis)}")


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
