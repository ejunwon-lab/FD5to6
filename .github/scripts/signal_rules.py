#!/usr/bin/env python3
"""리포트 신호등 규칙 — 색은 코드가 정하고, AI는 글만 쓴다.

같은 숫자면 언제나 같은 색이 나와야 신호를 믿을 수 있다(기준이 날마다 달라지면 신호등은 장식이 된다).
🔴은 "정말 주의해야 하는 드문 경보"다 — 시장 전체가 내린 날은 아무리 크게 빠져도 🟡이다.
기준 숫자는 이 파일 한 곳에만 둔다. 설계·과거 대입 결과: docs/plans/2026-11-16-리포트-요약우선-신호등.md
"""
import math

GREEN, YELLOW, RED = "🟢", "🟡", "🔴"
RANK = {GREEN: 0, YELLOW: 1, RED: 2}
LABEL = {GREEN: "평소대로", YELLOW: "주의", RED: "꼭 확인"}
OLD_LABELS = ("지켜보기",)   # 옛 신호 이름(🟡, ~2026-11-17). 지난 리포트를 읽은 AI가 따라 쓰면 마무리가 지금 이름으로 바꾼다

KR = {
    "PORT_DAY": -3.0,            # 🟡 내 포트(현금 포함) 하루 등락이 이 값 이하
    "EXCESS_INV": -2.0,          # 🟡 주식 부분 − 코스피(%p)가 이 값 이하 (시장보다 더 빠짐)
    "ONE_HOLDING": -7.0,         # 🟡 보유 한 종목의 하루 등락이 이 값 이하
    "STOCK_SHOCK": -10.0,        # 🔴 국내주식 한 종목의 하루 등락이 이 값 이하이면서
    "STOCK_SHOCK_EXCESS": -8.0,  #    코스피 대비(%p)도 이 값 이하 — 시장과 무관한 급락(= 그 회사에 무슨 일이 생김)
    "LOSS_STEP": 5.0,            # 🔴 누적 수익률이 5%p 단위의 새 계단 아래로 처음 내려갈 때 (−15, −20, −25 …)
}
US = {
    "SOX_Y": -3.0, "NDX_Y": -2.0,   # 🟡 미국 반도체지수 / 나스닥100 하루 등락
    "SOX_R": -7.0, "NDX_R": -4.0,   # 🔴 폭락 수준 — 한국 개장 전에 꼭 확인
}
WEEK = {"PORT_WEEK": -5.0}        # 일일 신호 기록이 부족한 주의 대체 기준 (🟡)


def key_text():
    """신호 기준을 한 줄로 — 주간 리포트 끝에 싣는다(기준 숫자는 이 파일에서만 나온다)."""
    return (f"신호 기준 · 🔴 {LABEL[RED]}: 보유 주식 한 종목이 하루 {KR['STOCK_SHOCK']:.0f}% 넘게 내리면서 코스피보다 {abs(KR['STOCK_SHOCK_EXCESS']):.0f}%p 넘게 더 빠짐, "
            f"또는 누적 수익률이 {KR['LOSS_STEP']:.0f}% 단위의 새 선 아래로 처음 내려감, 또는 보유 이유를 깨는 사건. "
            f"🟡 {LABEL[YELLOW]}: 내 포트 하루 {KR['PORT_DAY']:.0f}% 이하, 한 종목 {KR['ONE_HOLDING']:.0f}% 이하, 주식 부분이 코스피보다 {abs(KR['EXCESS_INV']):.0f}%p 넘게 더 빠짐. "
            f"아침(미국): 🟡 반도체지수 {US['SOX_Y']:.0f}%·나스닥100 {US['NDX_Y']:.0f}% 이하, 🔴 {US['SOX_R']:.0f}%·{US['NDX_R']:.0f}% 이하.")


REASON_TITLE = "이유"   # 신호 이유 묶음의 제목에 들어가는 낱말 — 마무리(report_finalize)가 이 낱말로 묶음을 찾는다
WATCH_TITLE = "지난 리포트의 조건 → 결과"            # 지난 리포트가 건 조건을 판정하는 묶음의 제목 (AI가 쓴다)
OLD_TITLES = {"지난번 본 것": WATCH_TITLE}            # 옛 제목 → 지금 제목 (마무리가 바꾼다, 2026-11-17)


def title(name):
    """제목(이름표) 모양 — 대괄호 + 굵게: `*[미국]*` (2026-11-17 사용자 결정). 제목 모양은 이 함수 한 곳에서만 만든다.

    텔레그램 옛 Markdown은 굵게 표시(`*…*`) 안의 글자를 그대로 보여 주므로 대괄호가 보인다.
    별표 없이 `[미국]`만 쓰면 링크 문법으로 읽혀 대괄호가 사라진다 — 반드시 별표 안에 둔다.
    근거: docs/plans/2026-11-17-리포트-제목대괄호-일정날짜.md"""
    return f"*[{name}]*"


def reason_title(color):
    """신호 이유 묶음의 제목 글자 — "신호가 🟡인 이유". 그냥 "이유"로는 무엇의 이유인지 알 수 없다는 지적(2026-11-17)."""
    return f"신호가 {color}인 {REASON_TITLE}"


def reason_block(color, reasons):
    """요약 끝의 신호 이유 묶음 — 제목 한 줄 + 이유마다 `* ` 한 줄. 🟢이면 None.

    이유 문장은 신호 함수가 **보이는 꼴 그대로** 만든다: "실제 값: 기준" (예: `미국 반도체지수 -5.3%: -3% 넘게 내리면 🟡`).
    긴 줄표(—)는 쓰지 않는다 — 음수 앞의 마이너스와 헷갈린다."""
    if color == GREEN or not reasons:
        return None
    return "\n".join([title(reason_title(color))] + ["* " + r for r in reasons])


def worst(*colors):
    return max((c for c in colors if c in RANK), key=lambda c: RANK[c], default=GREEN)


def loss_step(op_rate):
    """누적 수익률(%) → 그 값이 속한 계단(0, −5, −10 …). −16.2 → −15, −20.0 → −20, +3 → 0."""
    if op_rate is None or op_rate >= 0:
        return 0.0
    return -KR["LOSS_STEP"] * math.floor(-op_rate / KR["LOSS_STEP"] + 1e-9)


def kr_signal(port_pct, inv_pct, kospi_pct, rows, op_rate=None, low_step=None):
    """KR 마감 신호.
    rows: [{"name", "kind"(국내주식/ETF), "pct"}], op_rate: 오늘 누적 수익률%, low_step: 지금까지 기록된 가장 낮은 계단.
    → (색, [이유 문장], 오늘 계단)
    """
    red, yellow = [], []
    k = kospi_pct
    for r in rows:
        p = r.get("pct")
        if p is None:
            continue
        if (r.get("kind") == "국내주식" and p <= KR["STOCK_SHOCK"] and k is not None
                and p - k <= KR["STOCK_SHOCK_EXCESS"]):
            red.append(f"{r['name']} {p:+.1f}%: 시장(코스피 {k:+.1f}%)과 무관하게 {KR['STOCK_SHOCK']:.0f}% 넘게 내리면 {RED}")
    step = loss_step(op_rate)
    if op_rate is not None and low_step is not None and step < low_step:
        red.append(f"누적 수익률 {op_rate:+.1f}%: {step:.0f}% 선 아래로 처음 내려가면 {RED}")
    if port_pct is not None and port_pct <= KR["PORT_DAY"]:
        yellow.append(f"내 포트 하루 {port_pct:+.1f}%: {KR['PORT_DAY']:.0f}% 넘게 내리면 {YELLOW}")
    if inv_pct is not None and k is not None and inv_pct < 0 and inv_pct - k <= KR["EXCESS_INV"]:   # 내린 날에만 — 덜 오른 날은 대상 아님
        yellow.append(f"주식 부분이 코스피보다 {abs(inv_pct - k):.1f}%p 더 빠짐: {abs(KR['EXCESS_INV']):.0f}%p 넘게 더 빠지면 {YELLOW}")
    big = [r["name"] for r in rows if r.get("pct") is not None and r["pct"] <= KR["ONE_HOLDING"]]
    if big:
        yellow.append(f"하루 {KR['ONE_HOLDING']:.0f}% 넘게 내린 보유 종목 {len(big)}개: 하나라도 있으면 {YELLOW}")
    color = RED if red else (YELLOW if yellow else GREEN)
    return color, red + yellow, step


def us_signal(sox_pct, ndx_pct):
    red, yellow = [], []
    for name, v, y, r in (("미국 반도체지수", sox_pct, US["SOX_Y"], US["SOX_R"]), ("나스닥100", ndx_pct, US["NDX_Y"], US["NDX_R"])):
        if v is None:
            continue
        if v <= r:
            red.append(f"{name} {v:+.1f}%: {r:.0f}% 넘게 내리면 {RED}")
        elif v <= y:
            yellow.append(f"{name} {v:+.1f}%: {y:.0f}% 넘게 내리면 {YELLOW}")
    return (RED if red else (YELLOW if yellow else GREEN)), red + yellow


def week_signal(day_colors, port_week_pct):
    """주간 신호 = 그 주 일일 신호 중 가장 높은 색. 기록이 3일 미만이면 주간 수익률로 대체."""
    n = {c: sum(1 for x in day_colors if x == c) for c in (GREEN, YELLOW, RED)}
    if len(day_colors) >= 3:
        color = worst(*day_colors)
        return color, [f"이번 주 일일 신호 🔴 {n[RED]}일 · 🟡 {n[YELLOW]}일 · 🟢 {n[GREEN]}일: 그중 가장 높은 색이 주간 신호"]
    if port_week_pct is not None and port_week_pct <= WEEK["PORT_WEEK"]:
        return YELLOW, [f"내 포트 한 주 {port_week_pct:+.1f}%: {WEEK['PORT_WEEK']:.0f}% 넘게 내리면 {YELLOW}"]
    return GREEN, []
