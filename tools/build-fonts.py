# -*- coding: utf-8 -*-
"""Zen Kaku Gothic New と Barlow を使用文字だけに絞って fonts/ に置く（太田ナウ・サンモールと同じ方式）。

Google Fonts の分割配信だとトップページで93ファイル・835KB（転送量の38%）だった。
実際に使う文字＋かな・英数・記号に絞った1ファイル/ウェイトへ畳んで自前配信する。
欧文の Barlow は英数字と記号だけの小さなサブセットにする（見出しの英字・数字専用）。

  python tools/build-fonts.py

本文を書き換えて新しい漢字が増えたら流し直す（漏れた字はフォールバック書体で出る）。
"""
import html
import os
import sys
import urllib.request

from fontTools.subset import Subsetter, Options
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "fonts")
CACHE_DIR = os.path.join(ROOT, "tools", "font-src")
CONTENT_FILES = ["index.html", "terms.html", "llms.txt"]

# Google Fonts が旧UAに返す非分割WOFF（css?family=...&subset=japanese で取る。
# subset 無しだと欧文だけの小さいファイルが返るので注意）。
# 日本語のウェイトは 400/500/700 をトップで、900 は terms.html が使う。
JAPANESE_SOURCES = {
    "zen-kaku-gothic-new-400": "https://fonts.gstatic.com/s/zenkakugothicnew/v18/gNMYW2drQpDw0GjzrVNFf_valaDBcznOojRoSg.woff",
    "zen-kaku-gothic-new-500": "https://fonts.gstatic.com/s/zenkakugothicnew/v18/gNMVW2drQpDw0GjzrVNFf_valaDBcznOqs9LWWvYSw.woff",
    "zen-kaku-gothic-new-700": "https://fonts.gstatic.com/s/zenkakugothicnew/v18/gNMVW2drQpDw0GjzrVNFf_valaDBcznOqodNWWvYSw.woff",
    "zen-kaku-gothic-new-900": "https://fonts.gstatic.com/s/zenkakugothicnew/v18/gNMVW2drQpDw0GjzrVNFf_valaDBcznOqr9PWWvYSw.woff",
}
LATIN_SOURCES = {
    "barlow-400": "https://fonts.gstatic.com/s/barlow/v13/7cHpv4kjgoGqM7E_DMs_.woff",
    "barlow-500": "https://fonts.gstatic.com/s/barlow/v13/7cHqv4kjgoGqM7E3_-gs51oq.woff",
    "barlow-600": "https://fonts.gstatic.com/s/barlow/v13/7cHqv4kjgoGqM7E30-8s51oq.woff",
}
LEGACY_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/25.0 Safari/537.36"
)
EXTRA_SYMBOLS = (
    "　、。，．・：；？！゛゜´｀¨＾￣＿ヽヾゝゞ〃仝々〆〇ー—‐／＼〜‖｜…‥"
    "（）〔〕［］｛｝〈〉《》「」『』【】＋－±×÷＝≠＜＞≦≧∞∴"
    "°′″℃￥＄％＃＆＊＠§☆★○●◎◇◆□■△▲▽▼※〒→←↑↓㎡"
)
LATIN_EXTRA_SYMBOLS = "¥–—‐·•×°±→←↑↓↗©"


def collect_used_characters():
    used = set()
    for relative_path in CONTENT_FILES:
        path = os.path.join(ROOT, relative_path)
        if not os.path.exists(path):
            print("  警告: %s が無いので飛ばした" % relative_path)
            continue
        used |= set(html.unescape(open(path, encoding="utf-8").read()))
    return {c for c in used if c.isprintable() and not c.isspace()}


def collect_safety_net_characters():
    kana = set(chr(c) for c in range(0x3041, 0x30FF + 1))
    ascii_printable = set(chr(c) for c in range(0x20, 0x7F))
    fullwidth = set(chr(c) for c in range(0xFF01, 0xFF5F))
    return kana | ascii_printable | fullwidth | set(EXTRA_SYMBOLS)


def collect_latin_characters():
    ascii_printable = set(chr(c) for c in range(0x20, 0x7F))
    latin1 = set(chr(c) for c in range(0xA0, 0x100))
    return ascii_printable | latin1 | set(LATIN_EXTRA_SYMBOLS)


def download_source(name, url):
    os.makedirs(CACHE_DIR, exist_ok=True)
    path = os.path.join(CACHE_DIR, name + ".woff")
    if not os.path.exists(path):
        request = urllib.request.Request(url, headers={"User-Agent": LEGACY_USER_AGENT})
        with urllib.request.urlopen(request, timeout=60) as response:
            open(path, "wb").write(response.read())
    return path


def build_subset(source_path, output_path, characters):
    font = TTFont(source_path)
    options = Options()
    options.flavor = "woff2"
    options.layout_features = ["kern", "liga", "palt", "tnum", "pnum"]
    options.desubroutinize = False
    options.notdef_outline = True
    subsetter = Subsetter(options=options)
    subsetter.populate(text="".join(sorted(characters)))
    subsetter.subset(font)
    font.flavor = "woff2"
    font.save(output_path)
    font.close()


def build_family(sources, characters):
    total = 0
    for name, url in sources.items():
        output_path = os.path.join(OUT_DIR, name + ".woff2")
        build_subset(download_source(name, url), output_path, characters)
        size = os.path.getsize(output_path)
        total += size
        print("  %-28s %7.1f KB" % (name + ".woff2", size / 1024))
    return total


def main():
    japanese_characters = collect_used_characters() | collect_safety_net_characters()
    print("日本語 文字数 %d" % len(japanese_characters))
    os.makedirs(OUT_DIR, exist_ok=True)
    total = build_family(JAPANESE_SOURCES, japanese_characters)
    total += build_family(LATIN_SOURCES, collect_latin_characters())
    print("合計 %.1f KB / %d ファイル" % (total / 1024, len(JAPANESE_SOURCES) + len(LATIN_SOURCES)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
