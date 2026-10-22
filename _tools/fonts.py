# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "fonttools==4.67.0",
#   "brotli==1.2.1",
# ]
# ///
"""サイトで使う文字だけに絞ったフォントを assets/fonts/ に作る。

  uv run _tools/fonts.py          # 絞り直す（最後にチェックも走る）
  uv run _tools/fonts.py --check  # サイトの文字がフォントに入っているかだけ調べる

元のフォントは google/fonts のコミットを固定して取得し、ハッシュで照合する。
置き場所は ~/.cache/ksp-recruit-fonts/（コミットしない）。
"""

import argparse
import hashlib
import io
import json
import re
import sys
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "fonts"
CACHE = Path.home() / ".cache" / "ksp-recruit-fonts"
CHARS_FILE = ROOT / "_tools" / "fonts-chars.json"

GOOGLE_FONTS_COMMIT = "45e3d5269e4a17d823f6d84470bc084dc5ae46f6"
RAW = f"https://raw.githubusercontent.com/google/fonts/{GOOGLE_FONTS_COMMIT}/ofl/"

# (google/fonts 内のパス, sha256)
SOURCES = {
    "zen-400": ("zenkakugothicnew/ZenKakuGothicNew-Regular.ttf", "b840cd07a67d89cacca44249ae49aa99ee7640eb5ce623be8d8983d6aabac801"),
    "zen-500": ("zenkakugothicnew/ZenKakuGothicNew-Medium.ttf", "651a3f7280b7f36262601ee76d8388a8dc4372dcc67aff025a608939a562b525"),
    "zen-700": ("zenkakugothicnew/ZenKakuGothicNew-Bold.ttf", "0081cedabc4921982fcd061f845a005664ac7fb642af2dd34b4007bc63ccd235"),
    "zen-900": ("zenkakugothicnew/ZenKakuGothicNew-Black.ttf", "795819a979184981842994d8f4eb9e14ce443d687bd5e731d6ca67ded8f92261"),
    "zen-ofl": ("zenkakugothicnew/OFL.txt", "0fac78a235c98d640cb06332eb5362c211d86fa03c011df438c35005d22ad2c7"),
    "jost": ("jost/Jost%5Bwght%5D.ttf", "6343b70971000b04c5d401c96ae08ce371086135e999d5e1e1413039c0213076"),
    "jost-ofl": ("jost/OFL.txt", "1af3438a4d5f0ed2bdbc5751a5a67ebf6d537334161184b7fbb68503ef0ea0c5"),
}

ZEN_OUT = {w: OUT / f"zen-kaku-gothic-new-{w}.woff2" for w in (400, 500, 700, 900)}
JOST_OUT = OUT / "jost.woff2"
JOST_WGHT = (400, 700)  # サイトで使う太さの幅（Googleフォントで読み込んでいた 400〜700）
OFL_OUT = {"zen-ofl": OUT / "OFL-ZenKakuGothicNew.txt", "jost-ofl": OUT / "OFL-Jost.txt"}


def ranges(*pairs):
    return {chr(c) for a, b in pairs for c in range(a, b + 1)}


# 文章を少し直しただけで絞り直さなくて済むよう、いつも入れておく文字
ALWAYS = ranges(
    (0x0020, 0x007E),  # 半角英数字・記号
    (0x00A0, 0x00FF),  # ラテン1（×・© など）
    (0x2010, 0x2027),  # ダッシュ・引用符・…
    (0x2030, 0x2030), (0x203B, 0x203B),  # ‰ ※
    (0x3000, 0x303F),  # 和文の句読点・括弧
    (0x3041, 0x3096), (0x3099, 0x309F),  # ひらがな
    (0x30A0, 0x30FF),  # カタカナ
    (0xFF01, 0xFF65),  # 全角英数字・記号
)


# ---------------------------------------------------------------- 文字を集める

def site_files():
    return sorted([*ROOT.glob("*.html"), *ROOT.glob("voice/*.html")]), \
        sorted((ROOT / "assets" / "css").glob("*.css")), \
        sorted((ROOT / "assets" / "js").glob("*.js"))


class TextCollector(HTMLParser):
    """画面に出る文字（本文と alt・title など）を、行番号つきで集める。"""

    SKIP = {"script", "style"}
    ATTRS = {"alt", "title", "placeholder", "value"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skip = 0
        self.found = []  # (行, 文字列)

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.skip += 1
        line = self.getpos()[0]
        for k, v in attrs:
            if k in self.ATTRS and v:
                self.found.append((line, v))

    def handle_endtag(self, tag):
        if tag in self.SKIP and self.skip:
            self.skip -= 1

    def handle_data(self, data):
        if not self.skip:
            self.found.append((self.getpos()[0], data))


def js_strings(src):
    """JS の文字列（'…' "…" `…`）を行番号つきで取り出す。コメントは飛ばす。"""
    out, i, line, n = [], 0, 1, len(src)
    while i < n:
        c = src[i]
        if c == "\n":
            line += 1
        if src.startswith("//", i):
            j = src.find("\n", i)
            i = n if j < 0 else j
            continue
        if src.startswith("/*", i):
            j = src.find("*/", i + 2)
            j = n if j < 0 else j + 2
            line += src.count("\n", i, j)
            i = j
            continue
        if c in "'\"`":
            start_line, j, buf = line, i + 1, []
            while j < n and src[j] != c:
                if src[j] == "\\" and j + 1 < n:
                    buf.append(src[j + 1])
                    j += 2
                    continue
                if src[j] == "\n":
                    line += 1
                buf.append(src[j])
                j += 1
            out.append((start_line, "".join(buf)))
            i = j + 1
            continue
        i += 1
    return out


CSS_CONTENT = re.compile(r"content\s*:\s*(\"(?:[^\"\\]|\\.)*\"|'(?:[^'\\]|\\.)*')")
CSS_ESCAPE = re.compile(r"\\([0-9a-fA-F]{1,6})\s?|\\(.)")


def css_strings(src):
    out = []
    for m in CSS_CONTENT.finditer(src):
        s = CSS_ESCAPE.sub(lambda e: chr(int(e[1], 16)) if e[1] else e[2], m[1][1:-1])
        out.append((src.count("\n", 0, m.start()) + 1, s))
    return out


def collect():
    """{文字: [(ファイル, 行, 前後の文章), …]} を返す。"""
    html, css, js = site_files()
    pieces = []  # (ファイル, 行, 文字列)
    for f in html:
        p = TextCollector()
        p.feed(f.read_text(encoding="utf-8"))
        pieces += [(f, ln, s) for ln, s in p.found]
    for f in css:
        pieces += [(f, ln, s) for ln, s in css_strings(f.read_text(encoding="utf-8"))]
    for f in js:
        pieces += [(f, ln, s) for ln, s in js_strings(f.read_text(encoding="utf-8"))]

    where = {}
    for f, ln, s in pieces:
        line = ln
        for k, ch in enumerate(s):
            if ch == "\n":
                line += 1
                continue
            if ch.isspace() and ch != "\u3000":
                continue
            ctx = re.sub(r"\s+", " ", s[max(0, k - 12):k + 13]).strip()
            where.setdefault(ch, []).append((f.relative_to(ROOT).as_posix(), line, ctx))
    return where


# ---------------------------------------------------------------- 絞る

def fetch(key):
    path, sha = SOURCES[key]
    dest = CACHE / path.replace("/", "-").replace("%5B", "[").replace("%5D", "]")
    if not dest.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        print(f"取得: {path}")
        with urllib.request.urlopen(RAW + path) as r:
            dest.write_bytes(r.read())
    got = hashlib.sha256(dest.read_bytes()).hexdigest()
    if got != sha:
        sys.exit(f"ハッシュが合いません: {dest}\n  期待 {sha}\n  実際 {got}")
    return dest


def subset_options():
    from fontTools import subset
    o = subset.Options()
    o.layout_features = ["*"]   # フォントの機能はすべて残す
    o.name_IDs = ["*"]          # 著作権・ライセンスの情報を残す
    o.name_languages = ["*"]
    o.name_legacy = True
    o.notdef_outline = True
    return o


def build(where):
    from fontTools import subset
    from fontTools.ttLib import TTFont
    from fontTools.varLib import instancer

    OUT.mkdir(parents=True, exist_ok=True)
    wanted = set(where) | ALWAYS

    src = {k: fetch(k) for k in SOURCES}
    zen_cmap = set(chr(c) for c in TTFont(src["zen-400"]).getBestCmap())
    not_in_source = sorted(c for c in where if c not in zen_cmap)
    zen_chars = sorted(c for c in wanted if c in zen_cmap)

    for w, out in ZEN_OUT.items():
        font = TTFont(src[f"zen-{w}"], recalcTimestamp=False)  # 保存した日時を入れない（作り直しても同じファイルになる）
        s = subset.Subsetter(subset_options())
        s.populate(unicodes=[ord(c) for c in zen_chars])
        s.subset(font)
        font.flavor = "woff2"
        font.save(out)

    jost = TTFont(src["jost"], recalcTimestamp=False)
    jost = instancer.instantiateVariableFont(jost, {"wght": JOST_WGHT})
    buf = io.BytesIO()  # いったん書き出して読み直す（そのままだと絞るときに gvar が読めない）
    jost.save(buf)
    buf.seek(0)
    jost = TTFont(buf, recalcTimestamp=False)
    jost_cmap = set(chr(c) for c in jost.getBestCmap())
    s = subset.Subsetter(subset_options())
    s.populate(unicodes=[ord(c) for c in wanted if c in jost_cmap])
    s.subset(jost)
    jost.flavor = "woff2"
    jost.save(JOST_OUT)

    for key, out in OFL_OUT.items():
        out.write_bytes(src[key].read_bytes())

    prev = set()
    if CHARS_FILE.exists():
        prev = set(json.loads(CHARS_FILE.read_text(encoding="utf-8"))["chars"])
    CHARS_FILE.write_text(json.dumps({
        "source": f"google/fonts@{GOOGLE_FONTS_COMMIT}",
        "chars": "".join(zen_chars),
        "not_in_source": "".join(not_in_source),
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    site_ja = [c for c in where if ord(c) > 0x7E]
    print(f"サイトの文字 {len(where)}（うち半角英数字以外 {len(site_ja)}）／フォントに入れた文字 {len(zen_chars)}")
    added, removed = sorted(set(zen_chars) - prev), sorted(prev - set(zen_chars))
    if prev:
        print(f"前回から増えた文字 {len(added)}：{''.join(added)}")
        print(f"前回から減った文字 {len(removed)}：{''.join(removed)}")
    total = 0
    for out in [*ZEN_OUT.values(), JOST_OUT]:
        size = out.stat().st_size
        total += size
        print(f"  {out.relative_to(ROOT)}  {size / 1024:.1f}KB")
    print(f"  計 {total / 1024:.1f}KB")


# ---------------------------------------------------------------- チェック

def check(where):
    from fontTools.ttLib import TTFont

    missing_files = [p for p in [*ZEN_OUT.values(), JOST_OUT, *OFL_OUT.values()] if not p.exists()]
    if missing_files:
        sys.exit("ファイルがありません：" + "、".join(str(p.relative_to(ROOT)) for p in missing_files)
                 + "\n→ uv run _tools/fonts.py で作ってください")

    known_absent = set()
    if CHARS_FILE.exists():
        known_absent = set(json.loads(CHARS_FILE.read_text(encoding="utf-8"))["not_in_source"])

    zen = [set(chr(c) for c in TTFont(p).getBestCmap()) for p in ZEN_OUT.values()]
    jost = set(chr(c) for c in TTFont(JOST_OUT).getBestCmap())

    errors, notices = [], []
    for ch, locs in sorted(where.items()):
        if all(ch in z for z in zen):
            continue
        (notices if ch in known_absent else errors).append((ch, locs))
    jost_missing = sorted(c for c in map(chr, range(0x21, 0x7F)) if c not in jost)

    def show(ch, locs):
        print(f"  「{ch}」U+{ord(ch):04X}")
        for f, ln, ctx in locs[:5]:
            print(f"      {f}:{ln}  …{ctx}…")
        if len(locs) > 5:
            print(f"      ほか {len(locs) - 5} か所")

    if notices:
        print(f"お知らせ：元のフォントにもない文字 {len(notices)}（端末の文字で表示される）")
        for ch, locs in notices:
            show(ch, locs)
    if errors:
        print(f"エラー：フォントに入っていない文字 {len(errors)}")
        for ch, locs in errors:
            show(ch, locs)
    if jost_missing:
        print(f"エラー：Jost に入っていない半角英数字・記号 {''.join(jost_missing)}")
    if errors or jost_missing:
        sys.exit("→ uv run _tools/fonts.py でフォントを絞り直してください")
    print(f"チェックOK：サイトの文字 {len(where)} がすべてフォントに入っています")


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--check", action="store_true", help="サイトの文字がフォントに入っているかだけ調べる")
    args = ap.parse_args()
    where = collect()
    if not args.check:
        build(where)
    check(where)


if __name__ == "__main__":
    main()
