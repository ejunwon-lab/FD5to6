#!/usr/bin/env python3
"""시장 숫자 공용 도구 — 리포트 사전 수집 스크립트들이 같이 쓴다 (표준 라이브러리만).

원칙: 리포트의 숫자는 코드가 한 곳(네이버 금융 공개 API)에서 받아 계산하고, AI는 글만 쓴다.
  - 등락률은 "오늘 종가 ÷ 바로 앞 거래일 종가"로 직접 계산한다. 응답에 들어 있는 '전일 종가'류 필드는
    범위에 따라 뜻이 달라질 수 있어 쓰지 않는다(2026-11-16 US 리포트가 5거래일 전 종가를 전일 종가로 써서
    하루 등락 −3.43%를 +8.05%로 적은 사고).
  - N거래일 변화율은 언제나 "마지막 종가 ÷ 뒤에서 (N+1)번째 종가"다. 내 포트 d5·d20과 같은 구간이 된다.
  - 받지 못한 값은 None — 지어내지 않는다. 호출하는 쪽이 "미수신"으로 적는다.
이 저장소의 실행 로그는 공개다 — 이 모듈은 아무것도 출력하지 않는다.
"""
import datetime as dt
import json
import time
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
API = "https://api.stock.naver.com"
WD = "월화수목금토일"


def get(url, tries=2, timeout=12):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                return json.loads(r.read().decode("utf-8", "ignore"))
        except Exception:
            if i + 1 < tries:
                time.sleep(1.5)
    return None


def num(s):
    try:
        return float(str(s).replace(",", "").replace("+", "").replace("%", "").strip())
    except Exception:
        return None


def kdate(ymd):
    """'2026-11-16' 또는 '20261116' → '11/16(월)'. 요일은 달력에서 계산한다(AI에게 맡기지 않는다)."""
    s = str(ymd).replace("-", "")[:8]
    d = dt.date(int(s[:4]), int(s[4:6]), int(s[6:8]))
    return f"{d.month}/{d.day}({WD[d.weekday()]})"


def ymd(s):
    return str(s).replace("-", "")[:8]


def day_series(path, end, days=70):
    """네이버 일봉 → [(YYYYMMDD, 종가)] 오름차순. path 예: 'domestic/index/KOSPI', 'domestic/item/005930',
    'foreign/index/.SOX', 'foreign/item/AVGO.O'. end(YYYYMMDD 또는 YYYY-MM-DD)까지 달력 days일."""
    e = ymd(end)
    start = (dt.date(int(e[:4]), int(e[4:6]), int(e[6:8])) - dt.timedelta(days=days)).strftime("%Y%m%d")
    d = get(f"{API}/chart/{path}/day?startDateTime={start}&endDateTime={e}")
    out = []
    for x in d if isinstance(d, list) else []:
        c = num(x.get("closePrice"))
        if c and x.get("localDate"):
            out.append((str(x["localDate"]), c))
    out.sort()
    return out


def official_series(code, last_date=None, last_close=None, n=30):
    """국내 종목의 **정규장 종가** 일별 값 → [(YYYYMMDD, 종가)] 오름차순.

    네이버의 일별 종가(일봉·일별 시세)는 애프터마켓(16:00~20:00) 체결가가 섞인 값이다(2026-11-16 실측:
    11/13 일봉 종가 ≠ 그날 정규장 종가). 그래서 D일의 정규장 종가는 **다음 거래일의 기준가**
    (= 다음 날 종가 − 다음 날 전일 대비)로 되찾는다. 가장 최근 날은 다음 날이 없으므로 호출하는 쪽이
    따로 가진 정규장 종가(GAS 잠금 값)를 last_date·last_close로 넘긴다(없으면 그날은 빠진다)."""
    d = get(f"https://m.stock.naver.com/api/stock/{code}/price?pageSize={n}&page=1")
    rows = []
    for x in d if isinstance(d, list) else []:
        c, diff = num(x.get("closePrice")), num(x.get("compareToPreviousClosePrice"))
        if c and diff is not None and x.get("localTradedAt"):
            rows.append((ymd(x["localTradedAt"]), c, diff))
    rows.sort()
    out = [(rows[i][0], rows[i + 1][1] - rows[i + 1][2]) for i in range(len(rows) - 1)]
    if last_date and last_close:
        out = [x for x in out if x[0] < ymd(last_date)] + [(ymd(last_date), float(last_close))]
    return out


def chg(series, n=1, asof=None):
    """series의 asof(없으면 마지막) 종가가 n거래일 전 종가에서 몇 % 변했나. 자료가 모자라면 None."""
    s = [x for x in series if asof is None or x[0] <= ymd(asof)]
    if asof is not None and (not s or s[-1][0] != ymd(asof)):
        return None
    if len(s) <= n:
        return None
    return (s[-1][1] / s[-1 - n][1] - 1) * 100


def down_streak(series):
    """마지막 날까지 며칠 연속 내렸나 (마지막 날 올랐으면 0)."""
    n = 0
    for i in range(len(series) - 1, 0, -1):
        if series[i][1] < series[i - 1][1]:
            n += 1
        else:
            break
    return n


def kr_index(code, asof=None):
    """KOSPI/KOSDAQ 오늘 종가·등락률 — 일봉의 끝 두 값으로 계산. asof 날짜의 값이 없으면 None."""
    s = day_series(f"domestic/index/{code}", asof or dt.date.today().strftime("%Y%m%d"), 20)
    if asof and (not s or s[-1][0] != ymd(asof)):
        return None
    if len(s) < 2:
        return None
    return {"close": s[-1][1], "pct": (s[-1][1] / s[-2][1] - 1) * 100, "date": s[-1][0]}


def fx_usdkrw():
    d = get(f"{API}/marketindex/exchange/FX_USDKRW")
    e = (d or {}).get("exchangeInfo") or {}
    c = num(e.get("closePrice"))
    if not c:
        return None
    return {"close": c, "diff": num(e.get("fluctuations")), "pct": num(e.get("fluctuationsRatio")), "at": str(e.get("localTradedAt") or "")[:16]}


def last_day(path, end, n_back=(1, 5)):
    """해외 지수·종목: 마지막 거래일 종가와 1거래일·5거래일 변화율. → {date, close, d1, d5} 또는 None."""
    s = day_series(path, end, 40)
    if len(s) < 2:
        return None
    out = {"date": s[-1][0], "close": s[-1][1]}
    for n in n_back:
        out[f"d{n}"] = chg(s, n)
    return out


def disp_w(t):
    """화면 칸 수 — 한글·전각은 2칸."""
    return sum(2 if ord(ch) > 0x1100 else 1 for ch in str(t))


def short_name(name, kind=None, width=26):
    """요약 줄에 넣을 짧은 이름. ETF는 맨 앞의 운용사 상표(영문·숫자로만 된 첫 낱말)와 끝의 상품 꼬리말을 떼고,
    그래도 길면 width칸에서 자른다. 종목별 규칙은 두지 않는다(새로 산 ETF도 같은 규칙으로 줄어든다)."""
    n = str(name or "").strip()
    if kind == "ETF":
        parts = n.split()
        if len(parts) > 1 and parts[0].isascii():
            n = " ".join(parts[1:])
        for tail in ("타겟커버드콜", "커버드콜", "액티브", "(H)", "(합성)"):
            if n.endswith(tail) and len(n) - len(tail) >= 4:   # 떼고 나서 이름이 너무 짧아지면 그대로 둔다
                n = n[: -len(tail)].strip()
    if disp_w(n) > width:
        out = ""
        for ch in n:
            if disp_w(out + ch) > width - 1:
                break
            out += ch
        n = out.rstrip() + "…"
    return n


def pct(v, digits=2):
    return "—" if v is None else f"{v:+.{digits}f}%"
