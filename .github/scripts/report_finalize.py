#!/usr/bin/env python3
"""리포트 발송 전 마무리 — 신호 색을 코드 기준으로 맞추고, 형식을 점검하고, 신호 기록을 남긴다.

왜: 색은 코드가 정한다(signal_rules.py). AI가 쓴 첫 줄의 색이 사전 수집이 계산한 색과 다르면 여기서 고친다.
    AI가 올릴 수 있는 것은 🔴 하나뿐이고(보유 이유를 깨는 사건), 그때는 `🔴 이유:` 줄과 `근거:` 줄이 있어야 한다.
    없으면 계산한 색으로 되돌린다. 내리는 것, 🟢을 🟡로 올리는 것은 허용하지 않는다.
옛 형식 리포트(첫 줄에 색이 없고 나눔 표시도 없음)는 건드리지 않는다 — 신호 기록만 남긴다.

신호 기록 `_signals.jsonl`(비공개 리포트 저장소)은 **이력**이다(하루·종류당 한 줄, 같은 날 다시 만들면 그 줄을 바꾼다).
주간 리포트의 "이번 주 신호", 누적 수익률 계단 판정, 나중의 통계가 이 파일을 읽는다.

로그(공개)에는 색·개수만 쓴다. 어떤 경우에도 exit 0 — 마무리 실패가 발송을 막지 않는다.

사용: report_finalize.py <kr|us|weekly> <report.md> [--signal <signal.json>] [--log <_signals.jsonl>] [--dry]
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import signal_rules as R   # noqa: E402

SPLIT_RE = re.compile(r"^\s*={3,}\s*근거\s*={3,}\s*$")
COLORS = (R.GREEN, R.YELLOW, R.RED)
SUMMARY_MAX_LINES, SUMMARY_MAX_CHARS = 18, 800


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
    script = sig.get("color") if sig else None

    fi = next((i for i, l in enumerate(lines) if l.strip()), None)
    splits = [i for i, l in enumerate(lines) if SPLIT_RE.match(l)]
    wrote = first_color(lines[fi]) if fi is not None else None
    v2 = bool(wrote or splits)
    final, action, notes = wrote, "kept", []

    if v2 and fi is not None:
        summary = lines[fi:(splits[0] if splits else len(lines))]
        has_reason = any(l.strip().startswith("🔴 이유") for l in summary)
        has_basis = any(l.strip().startswith("근거:") for l in summary)
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
        if len(splits) > 1:                                      # 나눔 표시는 하나만
            for i in splits[1:][::-1]:
                del lines[i]
            notes.append("extra-split-removed")
        if not splits:
            notes.append("no-split")
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
        entry = {"date": (sig or {}).get("date") or os.environ.get("DATE_KST") or "", "type": typ, "color": final or script,
                 "script": script, "action": action}
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
