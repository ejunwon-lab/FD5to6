#!/usr/bin/env python3
"""리포트 발송 전 마무리 — 신호 색·요약 뼈대를 코드 기준으로 맞추고, 모양을 다듬고, 신호 기록을 남긴다.

왜: 색·숫자·날짜는 코드가 정한다(signal_rules.py·사전 수집). AI가 쓴 글이 그것과 다르면 여기서 고친다.
  1) 신호 색 — 첫 줄의 색이 계산한 색과 다르면 계산한 색으로. AI가 올릴 수 있는 것은 🔴 하나뿐이고
     (보유 이유를 깨는 사건), 그때는 `🔴 *이유*` 묶음 안에 `근거:` 줄이 있어야 한다. 없으면 되돌린다.
  2) 요약 뼈대 묶음 — 첫 줄, 숫자 묶음(이름표 줄 + 그 아래 `* ` 줄들), 신호 이유 묶음을 사전 수집이 만든 글자 그대로.
  3) 모양 — 글머리표는 `* `(하이픈은 마이너스와 헷갈린다), 구분선은 한 가지, 요약은 세 덩어리(상황 / 다음 수 / 이유)로
     구분선이 들어가게, 날짜 뒤 요일은 달력으로 교정.
옛 형식 리포트(첫 줄에 색이 없고 나눔 표시도 없음)는 건드리지 않는다 — 신호 기록만 남긴다.

신호 기록 `_signals.jsonl`(비공개 리포트 저장소)은 **이력**이다(하루·종류당 한 줄, 같은 날 다시 만들면 그 줄을 바꾼다).
로그(공개)에는 색·개수만 쓴다. 어떤 경우에도 exit 0 — 마무리 실패가 발송을 막지 않는다.

사용: report_finalize.py <kr|us|weekly> <report.md> [--signal <signal.json>] [--log <_signals.jsonl>] [--dry]
"""
import datetime as dt
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import signal_rules as R   # noqa: E402

SPLIT_RE = re.compile(r"^\s*={3,}\s*근거\s*={3,}\s*$")
COLORS = (R.GREEN, R.YELLOW, R.RED)
DIVIDER = "─" * 14
DIVIDER_RE = re.compile(r"^\s*[─━—–\-=_~·]{5,}\s*$")
BULLET_RE = re.compile(r"^(\s*)([*\-•∙▪]|·)\s+(?=\S)")
REASON_RE = re.compile(r"^\s*(🟢|🟡|🔴)\s*\*?이유\*?\s*:?")
WEEKDAY_RE = re.compile(r"(?<![\d/])(?:(\d{4})-)?(\d{1,2})([/-])(\d{1,2})\(([월화수목금토일])\)")
WD = "월화수목금토일"
SUMMARY_MAX_LINES, SUMMARY_MAX_CHARS = 34, 900


def first_color(line):
    s = line.lstrip()
    return next((c for c in COLORS if s.startswith(c)), None)


def set_color(line, color):
    """첫 줄의 색과 신호 이름을 color에 맞춘다."""
    s = line.lstrip()
    old = first_color(s)
    rest = s[len(old):] if old else " " + s
    for lab in R.LABEL.values():
        if lab in rest:
            rest = rest.replace(lab, R.LABEL[color], 1)
            break
    return color + rest


def code_mask(lines):
    """줄마다 코드블록(```) 안이면 True — 표 안의 글자는 다듬지 않는다."""
    mask, inside = [], False
    for l in lines:
        fence = l.strip().startswith("```")
        mask.append(inside or fence)
        if fence:
            inside = not inside
    return mask


def split_at(lines):
    return next((i for i, l in enumerate(lines) if SPLIT_RE.match(l)), len(lines))


def normalize_shape(lines):
    """글머리표를 `* `로, 구분선을 한 가지 모양으로. → (바꾼 글머리표 수, 바꾼 구분선 수)"""
    nb = nd = 0
    mask = code_mask(lines)
    for i, l in enumerate(lines):
        if mask[i] or SPLIT_RE.match(l):
            continue
        if DIVIDER_RE.match(l):
            if l != DIVIDER:
                lines[i] = DIVIDER
                nd += 1
            continue
        m = BULLET_RE.match(l)
        if m and m.group(2) != "*":
            lines[i] = m.group(1) + "* " + l[m.end():]
            nb += 1
    return nb, nd


def fix_weekdays(lines, ref):
    """`11/18(목)`·`2026-11-18(목)`의 요일을 달력으로 교정한다. 해가 없으면 ref(리포트 날짜)에 가장 가까운 해. → 고친 개수"""
    n = 0

    def sub(m):
        nonlocal n
        y, mo, d = m.group(1), int(m.group(2)), int(m.group(4))
        cands = []
        for yy in ([int(y)] if y else (ref.year - 1, ref.year, ref.year + 1)):
            try:
                cands.append(dt.date(yy, mo, d))
            except ValueError:
                pass
        if not cands:
            return m.group(0)
        day = min(cands, key=lambda c: abs((c - ref).days))
        good = WD[day.weekday()]
        if good == m.group(5):
            return m.group(0)
        n += 1
        return m.group(0)[: -2] + good + ")"

    for i, l in enumerate(lines):
        if "(" in l:
            lines[i] = WEEKDAY_RE.sub(sub, l)
    return n


def block_end(lines, start, stop):
    """start 줄(이름표) 아래로 이어지는 글머리표 줄들의 끝(다음 줄 번호)."""
    j = start + 1
    while j < stop and BULLET_RE.match(lines[j]) and not SPLIT_RE.match(lines[j]):
        j += 1
    return j


def enforce_blocks(lines, fi, spec, final, escalated):
    """요약의 뼈대 묶음을 사전 수집이 만든 글자 그대로 맞춘다. → 고친 항목 이름들.

    묶음 = 이름표 줄 + 그 아래 `* ` 줄들. AI는 이 묶음을 복사만 하게 돼 있다. 다르면 되돌리고, 빠졌으면 넣는다.
    사건으로 🔴이 된 경우 첫 줄의 색과 이유 묶음은 AI가 쓴 것을 둔다."""
    fixed = []
    last = fi   # 마지막으로 맞춘 묶음의 끝 줄
    for x in spec:
        want = x["text"].split("\n")
        if x["key"] == "head":
            w = set_color(want[0], final) if escalated else want[0]
            if lines[fi].strip() != w:
                lines[fi] = w
                fixed.append("head")
            continue
        if x["key"] == "reason":
            continue
        stop = split_at(lines)
        idx = next((i for i in range(fi + 1, stop) if any(lines[i].lstrip().startswith(l) for l in x["labels"])), None)
        if idx is None:   # 빠뜨린 묶음 — 앞 묶음 바로 다음(첫 번째면 결론 문장 다음)에 넣는다
            pos = last + 1
            if last == fi:
                pos = fi + 1
                while pos < stop and (DIVIDER_RE.match(lines[pos]) or not lines[pos].strip()):
                    pos += 1
                pos = min(pos + 1, stop)   # 결론 문장 한 줄 뒤
            lines[pos:pos] = [""] + want if (pos > 0 and lines[pos - 1].strip()) else want
            idx = pos + (1 if (pos > 0 and lines[pos - 1].strip()) else 0)
            fixed.append(x["key"] + "+")
        else:
            end = block_end(lines, idx, stop)
            if [l.rstrip() for l in lines[idx:end]] != want:
                lines[idx:end] = want
                fixed.append(x["key"])
        last = idx + len(want) - 1
    if not escalated:
        want = next((x["text"].split("\n") for x in spec if x["key"] == "reason"), None)
        stop = split_at(lines)
        have = [i for i in range(fi, stop) if REASON_RE.match(lines[i])]
        if want:
            if have:
                end = block_end(lines, have[0], stop)
                if [l.rstrip() for l in lines[have[0]:end]] != want:
                    lines[have[0]:end] = want
                    fixed.append("reason")
            else:
                e = stop
                while e > fi + 1 and not lines[e - 1].strip():   # 요약 끝의 빈 줄 앞에
                    e -= 1
                lines[e:e] = want
                fixed.append("reason+")
        elif have and any(x["key"] == "head" for x in spec):     # 🟢인데 이유 묶음이 있으면 지운다
            for i in have[::-1]:
                del lines[i:block_end(lines, i, split_at(lines))]
            fixed.append("reason-")
    return fixed


def ensure_dividers(lines, fi):
    """요약을 세 덩어리로 — 첫 줄 아래, `👉` 줄 위, 신호 이유 묶음 위에 구분선. 구분선 곁의 빈 줄은 없앤다. → 넣은 개수"""
    added = 0

    def need_above(i):
        j = i - 1
        while j > fi and not lines[j].strip():
            j -= 1
        return not DIVIDER_RE.match(lines[j])

    if fi + 1 >= len(lines) or not DIVIDER_RE.match(lines[fi + 1]):
        lines.insert(fi + 1, DIVIDER)
        added += 1
    for pred in (lambda l: l.lstrip().startswith("👉"), lambda l: bool(REASON_RE.match(l))):
        stop = split_at(lines)
        i = next((k for k in range(fi + 2, stop) if pred(lines[k])), None)
        if i is not None and need_above(i):
            lines.insert(i, DIVIDER)
            added += 1
    tidy(lines)
    return added


def tidy(lines):
    """구분선·나눔 표시 곁의 빈 줄을 없애고, 겹친 구분선은 하나로, 덩어리 끝에 홀로 남은 구분선은 지운다(코드블록 밖)."""
    def is_div(i):
        return 0 <= i < len(lines) and not mask[i] and bool(DIVIDER_RE.match(lines[i]))

    def is_split(i):
        return 0 <= i < len(lines) and bool(SPLIT_RE.match(lines[i]))

    mask = code_mask(lines)
    drop = set()
    for i in range(len(lines)):
        if mask[i] or not (is_div(i) or is_split(i)):
            continue
        j = i - 1
        while j >= 0 and not lines[j].strip():
            drop.add(j)
            j -= 1
        j = i + 1
        while j < len(lines) and not lines[j].strip():
            drop.add(j)
            j += 1
    for i in sorted(drop, reverse=True):
        del lines[i]
    mask = code_mask(lines)
    i = 0
    while i < len(lines):
        if is_div(i) and (is_div(i + 1) or is_split(i + 1) or i + 1 >= len(lines)):
            del lines[i]
            mask = code_mask(lines)
            continue
        i += 1


def upsert_log(path, entry):
    lines = []
    try:
        lines = [x for x in open(path, encoding="utf-8").read().split("\n") if x.strip()]
    except Exception:
        pass
    keep = []
    for x in lines:
        try:
            e = json.loads(x)
            if e.get("type") == entry["type"] and e.get("date") == entry["date"]:
                continue
        except Exception:
            pass
        keep.append(x)
    keep.append(json.dumps(entry, ensure_ascii=False))
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(keep) + "\n")


def main():
    argv, opt = [], {}
    it = iter(sys.argv[1:])
    for a in it:
        if a == "--dry":
            opt["dry"] = True
        elif a.startswith("--"):
            opt[a[2:]] = next(it, None)
        else:
            argv.append(a)
    typ, path = argv[0], argv[1]
    text = open(path, encoding="utf-8").read()
    lines = text.split("\n")
    sig = None
    if opt.get("signal"):
        try:
            sig = json.load(open(opt["signal"], encoding="utf-8"))
        except Exception:
            sig = None
    if sig and sig.get("stale"):   # 사전 수집이 어젯밤 기록을 못 받음 — 그 색·숫자로 강제하지 않는다
        sig = None
    script = sig.get("color") if sig else None
    date_s = (sig or {}).get("date") or os.environ.get("DATE_KST") or ""
    try:
        ref = dt.date(int(date_s[:4]), int(date_s[5:7]), int(date_s[8:10]))
    except Exception:
        ref = dt.date.today()

    fi = next((i for i, l in enumerate(lines) if l.strip()), None)
    wrote = first_color(lines[fi]) if fi is not None else None
    v2 = bool(wrote or any(SPLIT_RE.match(l) for l in lines))
    final, action, notes = wrote, "kept", []

    if v2 and fi is not None:
        nb, nd = normalize_shape(lines)
        summary = lines[fi:split_at(lines)]
        has_reason = any(l.lstrip().startswith("🔴") and REASON_RE.match(l) for l in summary)
        has_basis = any(BULLET_RE.sub("", l).strip().startswith("근거:") for l in summary)
        if script:
            if wrote is None:
                final, action = script, "inserted"
                lines.insert(fi, f"{script} *{R.LABEL[script]}* · {sig.get('header', '')}".rstrip(" ·"))
            elif wrote != script:
                if wrote == R.RED and has_reason and has_basis:
                    final, action = R.RED, "escalated"          # 사건으로 올림 — 이유·근거 줄 확인됨
                else:
                    final = script
                    action = "raised" if R.RANK[script] > R.RANK[wrote] else ("escalation-rejected" if wrote == R.RED else "lowered")
                    lines[fi] = set_color(lines[fi], script)
        elif wrote is None:
            notes.append("no-color")
        if sig and sig.get("lines") and final:                    # 뼈대 묶음을 사전 수집 값 그대로
            fx = enforce_blocks(lines, fi, sig["lines"], final, action == "escalated")
            if fx:
                notes.append("fixed=" + "/".join(fx))
        splits = [i for i, l in enumerate(lines) if SPLIT_RE.match(l)]
        if len(splits) > 1:                                      # 나눔 표시는 하나만
            for i in splits[1:][::-1]:
                del lines[i]
            notes.append("extra-split-removed")
        if not splits:
            notes.append("no-split")
        div = ensure_dividers(lines, fi)
        wk = fix_weekdays(lines, ref)
        if nb or nd or div:
            notes.append(f"shape=bullets:{nb}/dividers:{nd}+{div}")
        if wk:
            notes.append(f"weekday-fixed={wk}")
        summary = lines[fi:split_at(lines)]
        body = [l for l in summary if l.strip()]
        chars = sum(len(l) for l in body)
        if len(body) > SUMMARY_MAX_LINES or chars > SUMMARY_MAX_CHARS:
            notes.append("summary-long")
        if "```" in "\n".join(summary):
            notes.append("summary-codeblock")
        new = "\n".join(lines)
        if new != text:
            with open(path, "w", encoding="utf-8") as f:
                f.write(new)
        stat = f"summary_lines={len(body)} summary_chars={chars} total_chars={len(new)}"
    else:
        final, action = script, "legacy"
        stat = f"total_chars={len(text)}"

    if opt.get("log") and not opt.get("dry") and (sig or final):
        entry = {"date": date_s, "type": typ, "color": final or script, "script": script, "action": action}
        for k in ("header", "reasons", "port", "inv", "kospi", "step", "sox", "ndx", "usDate"):
            if sig and sig.get(k) is not None:
                entry[k] = sig[k]
        if entry["date"] and entry["color"]:
            try:
                upsert_log(opt["log"], entry)
            except Exception as e:
                notes.append(f"log-fail:{type(e).__name__}")
    print(f"finalize: type={typ} format={'v2' if v2 else 'legacy'} color={final or '-'} script={script or '-'} action={action} {stat}"
          + (f" notes={','.join(notes)}" if notes else ""))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"finalize: error {type(e).__name__}")
    sys.exit(0)
