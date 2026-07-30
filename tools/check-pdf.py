"""Verify a sheets PDF is Letter and at true size.

    python3 tools/check-pdf.py sheets/wieringa-sheets.pdf

Scale is the only thing in this pipeline that can silently go wrong. Every angle and
length is exact up to the point a print driver decides to be helpful, so the PDF gets
measured rather than trusted: the rhombus edges must come out at exactly the side
lengths the sheets were generated at.

Walks the page content streams honouring the q/Q graphics-state stack, so segment
lengths are converted to points through the real current transform. Two traps, both
of which bit while writing this: PDF numbers may be written with a leading dot
(".24"), and font and image streams decompress into binary that parses as nonsense
path data unless filtered out.
"""

import collections
import math
import re
import sys
import zlib

MM_PER_IN = 25.4
# Side lengths make-sheets.mjs emits, in inches.
EXPECTED_SIDES_IN = [1, 0.7, 0.5]
TOL_PT = 0.02

TOK = re.compile(r"(-?(?:\d+\.?\d*|\.\d+))|([A-Za-z*'\"]+)")


def content_streams(raw):
    """Decompressed page content streams only."""
    out = []
    for m in re.finditer(rb"stream\r?\n", raw):
        start = m.end()
        end = raw.find(b"endstream", start)
        if end < 0:
            continue
        try:
            text = zlib.decompress(raw[start:end]).decode("latin-1")
        except Exception:
            continue
        head = text[:4000]
        if not head:
            continue
        printable = sum(1 for ch in head if ch in " \r\n\t" or 32 <= ord(ch) < 127)
        if printable / len(head) < 0.95:
            continue
        if " cm" not in text and " re" not in text:
            continue
        out.append(text)
    return out


def segments(text):
    """Straight-line path segment lengths, in points."""
    scale = 1.0
    stack = []
    ops = []
    cur = start = None
    segs = []
    for m in TOK.finditer(text):
        num, op = m.group(1), m.group(2)
        if num is not None:
            ops.append(float(num))
            continue
        if op == "q":
            stack.append(scale)
        elif op == "Q":
            scale = stack.pop() if stack else scale
        elif op == "cm" and len(ops) >= 6:
            a, b, c, d, _e, _f = ops[-6:]
            scale *= math.sqrt(abs(a * d - b * c))
        elif op == "m" and len(ops) >= 2:
            cur = start = (ops[-2], ops[-1])
        elif op == "l" and len(ops) >= 2:
            p = (ops[-2], ops[-1])
            if cur:
                segs.append(math.hypot(p[0] - cur[0], p[1] - cur[1]) * scale)
            cur = p
        elif op == "h" and cur and start:
            segs.append(math.hypot(start[0] - cur[0], start[1] - cur[1]) * scale)
            cur = start
        ops = []
    return segs


def main(path):
    raw = open(path, "rb").read()
    problems = []

    pages = len(re.findall(rb"/Type\s*/Page[^s]", raw))
    print(f"{path}: {len(raw) / 1024:.0f} KB, {pages} pages")

    for box in sorted(set(re.findall(rb"/MediaBox\s*\[([^\]]+)\]", raw))):
        v = [float(x) for x in box.split()]
        w, h = v[2] - v[0], v[3] - v[1]
        print(f"  page {w:.0f} x {h:.0f} pt = {w / 72:.2f} x {h / 72:.2f} in")
        if abs(w - 612) > 1 or abs(h - 792) > 1:
            problems.append(f"page is {w:.0f}x{h:.0f} pt, expected 612x792 (Letter)")

    segs = []
    for text in content_streams(raw):
        segs += segments(text)
    counts = collections.Counter(round(s, 2) for s in segs if s > 2)

    print("  rhombus edges found:")
    for side_in in EXPECTED_SIDES_IN:
        want = side_in * 72
        hits = sum(n for L, n in counts.items() if abs(L - want) <= TOL_PT)
        status = "ok" if hits else "MISSING"
        print(
            f"    {side_in} in  = {want:6.2f} pt = {side_in * MM_PER_IN:6.3f} mm  "
            f"x{hits:<5d} {status}"
        )
        if not hits:
            problems.append(f"no edges at {side_in} in ({want:.2f} pt)")

    if problems:
        print("\nFAILED:")
        for p in problems:
            print("  -", p)
        return 1
    print("\nPDF is Letter and at true size.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "sheets/wieringa-sheets.pdf"))
