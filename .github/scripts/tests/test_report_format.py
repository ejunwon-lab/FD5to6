#!/usr/bin/env python3
"""리포트 모양 시험 — 제목(이름표) `*[미국]*`, 글머리 `* `, 신호 이름·이유 묶음, 긴 줄표 없애기, 발송 때의 Markdown 변환.

실행: python3 .github/scripts/tests/test_report_format.py   (저장소 어디서 실행해도 된다. 네트워크·발송 없음)

무엇을 지키나
  1) signal_rules.title / reason_block / 신호 함수 — 제목 모양·이유 문장("실제 값: 기준")은 한 곳에서 만든다. 긴 줄표(—)가 없다.
  2) report_finalize.bracket_titles — 옛 모양·잘못 쓴 모양을 `*[제목]*`으로, 제목이 아닌 줄은 그대로.
  3) report_finalize 전체(파일 → 파일) — 새 모양이면 손대지 않고, 옛 모양·옛 이름(지켜보기, 지난번 본 것, `🟡 *[이유]*`)·긴 줄표는
     지금 모양으로 맞춘다.
  4) send_telegram.md_prepare — 변환한 글을 **텔레그램 옛 Markdown 해석기 이식본**(tg_render)에 넣어
     "화면에 보일 글자"를 대조한다. 발송하지 않고 발송 모양을 검증하는 유일한 수단이다.
     (이식 원본: tdlib td/telegram/MessageEntity.cpp parse_markdown. 실제 서버 확인은 실발송 로그 `[OK Markdown]`.)

여기 나오는 종목 이름은 전부 가짜다(저장소는 공개).
"""
import json
import os
import re
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.dirname(HERE)
sys.path.insert(0, SCRIPTS)
import report_finalize as F   # noqa: E402
import send_telegram as S     # noqa: E402
import signal_rules as R      # noqa: E402

ok = bad = 0


def chk(name, cond, show=None):
    global ok, bad
    if cond:
        ok += 1
    else:
        bad += 1
        print("FAIL", name)
        if show is not None:
            print("   ---\n   " + str(show).replace("\n", "\n   ") + "\n   ---")


def tg_render(text):
    """텔레그램 옛 Markdown 해석기 이식본 → (화면에 보일 글자, [(종류, 그 글자)]). 해석 실패(400)는 ValueError."""
    out, ents = [], []
    i, n = 0, len(text)

    def at(k):
        return text[k] if k < n else "\0"

    while i < n:
        c = text[i]
        if c == "\\" and at(i + 1) in "_*`[":
            out.append(text[i + 1])
            i += 2
            continue
        if c not in "_*`[":
            out.append(c)
            i += 1
            continue
        begin, end_ch, is_pre = i, ("]" if c == "[" else c), False
        i += 1
        if c == "`" and at(i) == "`" and at(i + 1) == "`":
            i += 2
            is_pre = True
            le = i
            while le < n and not text[le].isspace() and text[le] != "`":
                le += 1
            if i != le and le < n and text[le] != "`":
                i = le
            if at(i) in "\n\r":
                i += 2 if (at(i + 1) in "\n\r" and at(i) != at(i + 1)) else 1
        start = len(out)
        while i < n and (text[i] != end_ch or (is_pre and not (at(i + 1) == "`" and at(i + 2) == "`"))):
            out.append(text[i])
            i += 1
        if i == n:
            raise ValueError(f"400 Can't find end of the entity starting at offset {begin}")
        if len(out) != start:
            seg = "".join(out[start:])
            if c == "_":
                ents.append(("italic", seg))
            elif c == "*":
                ents.append(("bold", seg))
            elif c == "`":
                ents.append(("pre" if is_pre else "code", seg))
            else:
                url = seg
                if at(i + 1) == "(":
                    i += 2
                    url = ""
                    while i < n and text[i] != ")":
                        url += text[i]
                        i += 1
                if re.match(r"(https?://|tg://)\S+$", url):
                    ents.append(("link", seg))
        if is_pre:
            i += 2
        i += 1   # 닫는 표시를 넘긴다
    return "".join(out), ents


T = R.title
DV = F.DIVIDER

# ── 1) 제목 모양 ─────────────────────────────────────────────
chk("title", T("미국") == "*[미국]*")
chk("신호 이름", R.LABEL == {"🟢": "평소대로", "🟡": "주의", "🔴": "꼭 확인"} and "지켜보기" in R.OLD_LABELS, R.LABEL)
c, rs = R.us_signal(-5.28, -2.67)
chk("미국 🟡 이유 = 실제 값: 기준", c == "🟡" and rs == ["미국 반도체지수 -5.3%: -3% 넘게 내리면 🟡", "나스닥100 -2.7%: -2% 넘게 내리면 🟡"], rs)
chk("reason_block = 제목 + 이유 줄 그대로", R.reason_block(c, rs) == "*[신호가 🟡인 이유]*\n* 미국 반도체지수 -5.3%: -3% 넘게 내리면 🟡\n* 나스닥100 -2.7%: -2% 넘게 내리면 🟡",
    R.reason_block(c, rs))
c, rs = R.us_signal(-7.5, -2.7)
chk("미국 🔴 이유(🔴 줄이 먼저, 🟡 줄은 🟡로)", c == "🔴" and rs == ["미국 반도체지수 -7.5%: -7% 넘게 내리면 🔴", "나스닥100 -2.7%: -2% 넘게 내리면 🟡"], rs)
chk("reason_block 🔴 제목", R.reason_block(c, rs).split("\n")[0] == "*[신호가 🔴인 이유]*")
chk("reason_block 🟢은 없음", R.reason_block("🟢", []) is None)
ROWS = [{"name": "가나전자", "kind": "국내주식", "pct": -12.0}, {"name": "다라설비 ETF", "kind": "ETF", "pct": -7.4}, {"name": "마바바이오", "kind": "국내주식", "pct": 1.0}]
c, rs, step = R.kr_signal(-3.2, -5.3, -0.5, ROWS, op_rate=-20.4, low_step=-15.0)
chk("한국 🔴·🟡 이유 문장", c == "🔴" and rs == [
    "가나전자 -12.0%: 시장(코스피 -0.5%)과 무관하게 -10% 넘게 내리면 🔴",
    "누적 수익률 -20.4%: -20% 선 아래로 처음 내려가면 🔴",
    "내 포트 하루 -3.2%: -3% 넘게 내리면 🟡",
    "주식 부분이 코스피보다 4.8%p 더 빠짐: 2%p 넘게 더 빠지면 🟡",
    "하루 -7% 넘게 내린 보유 종목 2개: 하나라도 있으면 🟡"], rs)
c, rs = R.week_signal(["🟢", "🟡", "🟢"], -1.0)
chk("주간 이유 문장", c == "🟡" and rs == ["이번 주 일일 신호 🔴 0일 · 🟡 1일 · 🟢 2일: 그중 가장 높은 색이 주간 신호"], rs)
c, rs = R.week_signal(["🟢"], -6.2)
chk("주간 대체 기준 문장", c == "🟡" and rs == ["내 포트 한 주 -6.2%: -5% 넘게 내리면 🟡"], rs)
ALL = R.us_signal(-7.5, -2.7)[1] + R.kr_signal(-3.2, -5.3, -0.5, ROWS, -20.4, -15.0)[1] + R.week_signal(["🟢"] * 3, 0)[1] + [R.key_text()]
chk("신호 문장·기준 줄에 긴 줄표·'(기준' 없음", not any("—" in x or "(기준" in x for x in ALL), ALL)

# ── 2) bracket_titles ───────────────────────────────────────
FIX = [("*미국*", "*[미국]*"), ("*왜*", "*[왜]*"),
       ("*내 포트*  -3.19%", "*[내 포트]*  -3.19%"),
       ("*내 포트* -3.2% (주식만 -5.3%)", "*[내 포트]* -3.2% (주식만 -5.3%)"),
       ("*종목별 한 주* (포트에 준 영향 큰 순)", "*[종목별 한 주]* (포트에 준 영향 큰 순)"),
       ("👉 *오늘 한국 장*", "👉 *[오늘 한국 장]*"), ("🟡 *이유*", "🟡 *[이유]*"), ("🔴 *이유*", "🔴 *[이유]*"),
       ("[미국]", "*[미국]*"), ("[내 포트]  -3.19%", "*[내 포트]*  -3.19%"), ("👉 [다음 수]", "👉 *[다음 수]*"),
       ("[*미국*]", "*[미국]*"), ("**미국**", "*[미국]*"), ("**[미국]**", "*[미국]*"),
       ("  *환율·금리*", "  *[환율·금리]*"), ("*일정* 11/18(수) 아침 실적", "*[일정]* 11/18(수) 아침 실적"),
       ("*[지난번 본 것]*", "*[지난 리포트의 조건 → 결과]*"), ("*지난번 본 것*", "*[지난 리포트의 조건 → 결과]*"), ("[지난번 본 것]", "*[지난 리포트의 조건 → 결과]*")]
for src, want in FIX:
    ls = [src]
    n = F.bracket_titles(ls)
    chk(f"제목 맞춤: {src}", ls == [want] and n == 1, ls)
KEEP = ["*[미국]*", "*[내 포트]*  -3.19%", "👉 *[다음 수]*", "🟡 *[이유]*", "*[신호가 🟡인 이유]*", "*[지난 리포트의 조건 → 결과]*",
        "🟡 *주의* · 미국 11/16(월) 마감", "📎 *근거* · 미국 11/16(월) 마감", "🟢 *평소대로* · KR 휴장 · 11/16(월) 기준", "🟡 *주의*",
        "🟡 *지켜보기* · 미국 11/16(월) 마감", "🟡 *지켜보기*",
        "* 나스닥100 -2.67%", "   * 반도체지수 3일째 하락", "* 가나전자: *중요* 공시", "1. 오늘 팔 이유는 없다",
        "   → 내일 추가 매수는 미룬다", "_보유 이유는 초안 기준_", "반도체가 함께 급락 — 팔 이유는 없다", DV, "===근거===", ""]
ls = list(KEEP)
chk("제목이 아닌 줄은 그대로", F.bracket_titles(ls) == 0 and ls == KEEP, "\n".join(ls))
ls = ["```", "*미국*  -1.0%", "[표]", "```"]
chk("코드블록 안은 그대로", F.bracket_titles(ls) == 0 and ls == ["```", "*미국*  -1.0%", "[표]", "```"])

# ── 3) 마무리 전체 (파일 → 파일) ─────────────────────────────
HEAD = "🟡 *주의* · KR 마감 11/16(월)"
RSN = ["내 포트 하루 -3.2%: -3% 넘게 내리면 🟡", "하루 -7% 넘게 내린 보유 종목 5개: 하나라도 있으면 🟡"]
SPEC = [{"key": "head", "text": HEAD},
        {"key": "port", "labels": [T("내 포트")], "text": f"{T('내 포트')}  -3.19%\n* 주식만 -5.34% · 코스피 -3.59%"},
        {"key": "mover1", "labels": [T("끌어내린 것"), T("끌어올린 것")], "text": f"{T('끌어내린 것')}\n* 가나전자 · 다라설비 · 마바소부장"},
        {"key": "mover2", "labels": [T("받쳐 준 것"), T("덜 빠진 것"), T("발목 잡은 것")], "text": f"{T('덜 빠진 것')}\n* 사아채권혼합 · 자차미국채혼합"},
        {"key": "reason", "text": R.reason_block("🟡", RSN)}]
GOOD = "\n".join([
    HEAD, DV, "반도체가 함께 급락 → 팔 이유는 없다", "",
    SPEC[1]["text"], "", T("왜"), "* 반도체업종 -6.15% (전 업종 중 가장 약함)", "",
    SPEC[2]["text"], SPEC[3]["text"], "", T(R.WATCH_TITLE), "* 가나전자가 -3% 넘게 내리면 보유 이유를 다시 본다 → 해당 (-7.9%)", DV,
    "👉 " + T("다음 수"), "1. 오늘 팔 이유는 없다", "   * 공식 확인된 것이 없다", "2. 오늘 밤 미국 반도체지수가 -2% 넘게 더 내리면", "   → 내일 추가 매수는 미룬다", DV,
    SPEC[4]["text"], "===근거===",
    "📎 *근거* · KR 마감 11/16(월)", DV, T("종목별"), "```", "종목         오늘    5일   판단", "가나전자    -7.89%  -1.4%  경고", "```", "* 가나전자: 수요에 직접 타격", DV,
    T("흐름"), "* 5일 +0.32% (코스피 -1.0%)", T("비중"), "* 주식 59% · 현금 41%", DV,
    T("일정"), "* 11/18(수) 아침 엔비디아 실적 발표 (미국 현지 11/17 장 마감 뒤)", DV, "_보유 이유는 초안 기준_"])
TMP = tempfile.mkdtemp(prefix="fmt_")


def run(name, body, script="🟡", spec=SPEC, typ="kr", date="2026-11-16"):
    p = os.path.join(TMP, name + ".md")
    open(p, "w", encoding="utf-8").write(body)
    sp = os.path.join(TMP, name + ".sig.json")
    json.dump({"type": typ, "date": date, "header": "KR 마감 11/16(월)", "color": script, "label": R.LABEL[script], "reasons": ["x"], "lines": spec},
              open(sp, "w", encoding="utf-8"), ensure_ascii=False)
    out = subprocess.run([sys.executable, os.path.join(SCRIPTS, "report_finalize.py"), typ, p, "--signal", sp, "--dry"],
                         capture_output=True, text=True, env={**os.environ, "DATE_KST": date}).stdout.strip()
    return out, open(p, encoding="utf-8").read()


def old_shape(s):   # 새 모양 → 11/16 모양(`*제목*`)
    return re.sub(r"\*\[([^\]\n]+)\]\*", r"*\1*", s)


o, t = run("ok", GOOD)
chk("새 모양이면 손대지 않음", "notes=" not in o and t == GOOD and "action=kept" in o, o + "\n" + t)
o, t = run("old", old_shape(GOOD))
chk("옛 모양(*제목*) → 새 모양", t == GOOD and "titles-fixed=" in o and "fixed=" not in o.replace("titles-fixed=", ""), o + "\n" + t)
o, t = run("bare", re.sub(r"\*\[([^\]\n]+)\]\*", r"[\1]", GOOD))
chk("별표 없는 [제목] → 새 모양", t == GOOD and "titles-fixed=" in o, o + "\n" + t)
o, t = run("double", re.sub(r"\*\[([^\]\n]+)\]\*", r"**\1**", GOOD).replace("*주의*", "**주의**").replace("*근거*", "**근거**"))
chk("별표 두 개(**제목**) → 새 모양", t == GOOD, o + "\n" + t)
o, t = run("mv", GOOD.replace("* 가나전자 · 다라설비 · 마바소부장", "* 가나전자 · 소부장 ETF\n* 타파전기"))
chk("이름 바꾼 묶음 되돌림", "mover1" in o and t == GOOD, o + "\n" + t)
o, t = run("pt", old_shape(GOOD).replace("*내 포트*  -3.19%\n* 주식만 -5.34% · 코스피 -3.59%", "*내 포트* -3.2% (주식만 -5.3% · 코스피 -3.6%)"))
chk("옛 모양 + 한 줄로 쓴 숫자 묶음 되돌림", "port" in o and t == GOOD, o + "\n" + t)
o, t = run("miss", GOOD.replace(SPEC[1]["text"] + "\n\n", ""))
chk("빠진 숫자 묶음 넣음", "port+" in o and SPEC[1]["text"] in t and t.index(T("내 포트")) < t.index(T("왜")), o + "\n" + t)
o, t = run("rs", GOOD.replace(SPEC[4]["text"], "🟡 이유: 반도체 급락"))
chk("옛 꼴 이유 줄을 묶음으로", "reason" in o and t == GOOD, o + "\n" + t)
o, t = run("norsn", GOOD.replace(DV + "\n" + SPEC[4]["text"], "").replace("미룬다\n===", "미룬다\n==="))
chk("빠진 이유 묶음 넣음(구분선 포함)", "reason+" in o and t == GOOD, o + "\n" + t)
esc = GOOD.replace(HEAD, "🔴 *꼭 확인* · KR 마감 11/16(월)").replace(SPEC[4]["text"], "🔴 *이유*\n* 가나전자 주요 고객사 계약 해지\n* 근거: 계약 해지 공시 (가나일보, 11/16)")
o, t = run("esc", esc)
chk("사건으로 올린 🔴 유지 + 옛 꼴 이유 제목 맞춤", "action=escalated" in o and "*[신호가 🔴인 이유]*\n* 가나전자 주요 고객사 계약 해지" in t
    and t.startswith("🔴 *꼭 확인*") and "🔴 *[이유]*" not in t, o + "\n" + t)
o, t2 = run("escnew", esc.replace("🔴 *이유*", "*[신호가 🔴인 이유]*"))
chk("사건으로 올린 🔴 — 지금 꼴 제목으로 써도 인정", "action=escalated" in o and t2 == t and "names-fixed" not in o, o + "\n" + t2)
o, t = run("escbad", esc.replace("* 근거: 계약 해지 공시 (가나일보, 11/16)\n", ""))
chk("근거 줄 없는 🔴은 되돌림", "action=escalation-rejected" in o and t.startswith(HEAD) and SPEC[4]["text"] in t, o + "\n" + t)
o, t = run("green", GOOD.replace(HEAD, "🟢 *평소대로* · KR 마감 11/16(월)"), script="🟢",
           spec=[{"key": "head", "text": "🟢 *평소대로* · KR 마감 11/16(월)"}] + SPEC[1:4])
chk("🟢이면 이유 묶음 지움", "reason-" in o and "이유]*" not in t, o + "\n" + t)
o, t = run("wd", GOOD.replace("11/18(수) 아침", "11/18(목) 아침"))
chk("요일 교정은 그대로 동작", "weekday-fixed=1" in o and t == GOOD, o + "\n" + t)


# ── 3-2) 옛 이름·옛 제목 → 지금 것 (AI는 지난 리포트를 읽으므로 옛 모양을 따라 쓸 수 있다) ──
OLD_RSN = "🟡 *[이유]*\n* 내 포트가 하루 -3.2%\n* 하루 -7% 넘게 내린 보유 종목 5개"
o, t = run("oldlabel", GOOD.replace("*주의*", "*지켜보기*"))
chk("옛 신호 이름(지켜보기) → 주의", t == GOOD and "지켜보기" not in t, o + "\n" + t)
o, t = run("oldreason", GOOD.replace(SPEC[4]["text"], OLD_RSN))
chk("옛 꼴 이유 묶음(🟡 *[이유]*) → 지금 묶음", "reason" in o and t == GOOD, o + "\n" + t)
o, t = run("oldwatch", GOOD.replace(T(R.WATCH_TITLE), T("지난번 본 것")))
chk("옛 제목(지난번 본 것) → 지금 제목", "titles-fixed=1" in o and t == GOOD, o + "\n" + t)
o, t = run("nospec", GOOD.replace("*주의*", "*지켜보기*").replace(SPEC[4]["text"], OLD_RSN), spec=[])
chk("뼈대 값이 없는 날(휴장·자료 지연)에도 옛 이름·옛 이유 제목을 바꿈", "names-fixed=2" in o and t.startswith(HEAD)
    and "*[신호가 🟡인 이유]*\n* 내 포트가 하루 -3.2%" in t and "지켜보기" not in t and "🟡 *[이유]*" not in t, o + "\n" + t)

# ── 3-3) 긴 줄표(—) 없애기 ───────────────────────────────────
ls = [HEAD, DV, "반도체가 함께 급락 — 팔 이유는 없다", "", T("왜"),
      "* 반도체업종 -6.15% — 전 업종 중 가장 약함", "* 미국 반도체지수 -5.3% — -3% 넘게 내리면 🟡", "* 가나전자 -3% 넘게 하락? — 예 (-7.9%)",
      "1. 없음 — 그대로 둔다", "* 11/10(화)—11/14(토) 한 주", "* 주식 — · 현금 —", "— 줄표로 시작한 글머리", "_자료 지연 — 숫자를 직접 받음_",
      DV, "* 코스피 -3.59% · 원/달러 -3.40", "```", "가나전자    —  -1.4%  경고", "```", "===근거===", "📎 *근거* · KR 휴장 — 11/16(월) 기준"]
want = [HEAD, DV, "반도체가 함께 급락 → 팔 이유는 없다", "", T("왜"),
        "* 반도체업종 -6.15%: 전 업종 중 가장 약함", "* 미국 반도체지수 -5.3%: -3% 넘게 내리면 🟡", "* 가나전자 -3% 넘게 하락? 예 (-7.9%)",
        "1. 없음: 그대로 둔다", "* 11/10(화)~11/14(토) 한 주", "* 주식 없음 · 현금 없음", "* 줄표로 시작한 글머리", "_자료 지연: 숫자를 직접 받음_",
        DV, "* 코스피 -3.59% · 원/달러 -3.40", "```", "가나전자    없음  -1.4%  경고", "```", "===근거===", "📎 *근거* · KR 휴장: 11/16(월) 기준"]
n = F.no_long_dash(ls, 0)
chk("긴 줄표: 결론 줄은 →, 글은 콜론, 날짜 사이는 ~, 빈 칸은 없음 (구분선·마이너스는 그대로)", ls == want and n == 11,
    "\n".join(f"{a}   ◀ {b}" if a != b else a for a, b in zip(ls, want)) + f"\n n={n}")
ls = [HEAD, DV, T("내 포트") + "  -3.19%", "* 주식만 — · 코스피 -3.59%"]
F.no_long_dash(ls, 0)
chk("긴 줄표: 결론 줄이 없으면(바로 제목) 화살표를 쓰지 않음", ls[2] == T("내 포트") + "  -3.19%" and ls[3] == "* 주식만 없음 · 코스피 -3.59%", ls)
o, t = run("dash", GOOD.replace("급락 → 팔", "급락 — 팔").replace("-6.15% (전 업종 중 가장 약함)", "-6.15% — 전 업종 중 가장 약함")
           .replace("* 가나전자: 수요에 직접 타격", "* 가나전자 — 수요에 직접 타격"))
chk("긴 줄표: 마무리 전체에서 교정", "dash-fixed=3" in o and "—" not in t and "급락 → 팔 이유는 없다" in t
    and "* 반도체업종 -6.15%: 전 업종 중 가장 약함" in t and "* 가나전자: 수요에 직접 타격" in t, o + "\n" + t)
chk("새 모양(GOOD)에는 긴 줄표가 없다", "—" not in GOOD)

# ── 4) 발송 변환 → 화면에 보일 글자 ──────────────────────────
summary, detail = S.split_parts(GOOD)
for nm, part in (("요약", summary), ("근거", detail)):
    try:
        shown, ents = tg_render(S.md_prepare(part))
    except ValueError as e:
        shown, ents = str(e), []
    titles = re.findall(r"\*(\[[^\]\n]+\])\*", part)
    chk(f"{nm}: 해석 성공·역슬래시가 화면에 새지 않음", "\\" not in shown and "400" not in shown, shown)
    chk(f"{nm}: 제목 {len(titles)}개가 대괄호째 굵게", titles and all(("bold", t_) in ents and t_ in shown for t_ in titles), ents)
    chk(f"{nm}: 글머리 별표가 글자로 보임", all(("\n" + l) in ("\n" + shown) for l in part.split("\n") if l.lstrip().startswith("* ") and "```" not in l), shown)
    chk(f"{nm}: 굵은 글씨는 제목·머리줄 낱말뿐", all(k != "bold" or v.startswith("[") or v in F.HEAD_WORDS for k, v in ents), ents)
    chk(f"{nm}: 화면에 별표+대괄호(`*[`)가 남지 않음", "*[" not in shown and "]*" not in shown, shown)
shown, ents = tg_render(S.md_prepare(detail))
chk("근거: 표는 코드블록으로", any(k == "pre" and "가나전자    -7.89%" in v for k, v in ents), ents)
chk("근거: 기울임 줄", ("italic", "보유 이유는 초안 기준") in ents, ents)

shown, ents = tg_render(S.md_prepare("오늘 [속보] 발표\n* 가격 [미정]"))
chk("본문 속 대괄호가 사라지지 않음", shown == "오늘 [속보] 발표\n* 가격 [미정]" and not ents, (shown, ents))
shown, ents = tg_render(S.md_prepare("* 출처 [기사](https://example.com/a_b) 참고"))
chk("실제 링크는 링크로", shown == "* 출처 기사 참고" and ents == [("link", "기사")], (shown, ents))
shown, ents = tg_render(S.md_prepare("가격 [미정"))
chk("닫는 괄호 없는 [ 도 해석 실패 없이", shown == "가격 [미정", (shown, ents))
chk("이미 역슬래시가 붙은 것은 두 번 붙이지 않음", S.md_prepare("\\[x] \\* y") == "\\[x] \\* y", S.md_prepare("\\[x] \\* y"))
chk("굵게 안의 대괄호에는 손대지 않음", S.md_prepare("*[미국]*\n* a") == "*[미국]*\n\\* a", S.md_prepare("*[미국]*\n* a"))
chk("코드블록 안의 대괄호·별표는 그대로", S.md_prepare("```\n[표] * 1\n```") == "```\n[표] * 1\n```")
# 함정 기록 — 변환 없이 보내면 이렇게 된다(그래서 변환이 필요하다)
shown, ents = tg_render("[미국]\n내용")
chk("(함정) 별표 없는 [제목]은 대괄호가 사라진다", shown == "미국\n내용", (shown, ents))
try:
    tg_render("* 글머리\n내용")
    chk("(함정) 글머리 별표를 그대로 보내면 400", False)
except ValueError:
    chk("(함정) 글머리 별표를 그대로 보내면 400", True)

print(f"\n{ok} passed, {bad} failed")
sys.exit(1 if bad else 0)
