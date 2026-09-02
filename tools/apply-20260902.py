# -*- coding: utf-8 -*-
"""2026-09-02 の改修を index.html / terms.html / sitemap.xml / llms.txt に当てる（1回限り・冪等）。

1. Zen Kaku Gothic New を Google Fonts から自前配信（fonts/）へ切り替え
2. terms.html に PART 4「特定商取引法に基づく表記」を追加
3. index.html のドロワーとフッターに表記へのリンクを追加
4. sitemap.xml の lastmod、llms.txt の法的表記リンク
"""
import io
import re

BLOCK = """<!-- 日本語書体は使用文字だけに絞って自前配信（tools/build-fonts.py で生成）。
     Google Fonts の分割配信だと93ファイル・835KB で転送量の38%を占めていた。
     日本語書体は preload しない（ヒーロー画像と帯域を奪い合う）。 -->
<style>
@font-face{font-family:'Zen Kaku Gothic New';font-style:normal;font-weight:400;font-display:swap;src:url('/fonts/zen-kaku-gothic-new-400.woff2') format('woff2')}
@font-face{font-family:'Zen Kaku Gothic New';font-style:normal;font-weight:500;font-display:swap;src:url('/fonts/zen-kaku-gothic-new-500.woff2') format('woff2')}
@font-face{font-family:'Zen Kaku Gothic New';font-style:normal;font-weight:700;font-display:swap;src:url('/fonts/zen-kaku-gothic-new-700.woff2') format('woff2')}
@font-face{font-family:'Zen Kaku Gothic New';font-style:normal;font-weight:900;font-display:swap;src:url('/fonts/zen-kaku-gothic-new-900.woff2') format('woff2')}
</style>
"""

SECTION = """
    <section id="tokusho">
      <h2><span class="no en">PART 4</span>特定商取引法に基づく表記</h2>
      <p>各予約サイトでの事前クレジットカード決済（通信販売）に関する表記です。</p>
      <table>
        <tbody>
        <tr><th>販売業者</th><td>株式会社Now Resort（スマートワークホテル日立高萩）</td></tr>
        <!-- 確認後に追記する行：
        <tr><th>運営責任者</th><td>（氏名）</td></tr>
        <tr><th>本社所在地</th><td>（登記上の住所）</td></tr>
        <tr><th>旅館業許可</th><td>（許可番号・許可年月日）</td></tr>
        -->
        <tr><th>施設所在地</th><td>〒318-0002 茨城県高萩市高戸387-12</td></tr>
        <tr><th>電話番号</th><td><a href="tel:05017920601">050-1792-0601</a>（日中のみ・夜間の対応はいたしかねます）</td></tr>
        <tr><th>メールアドレス</th><td><a href="mailto:info@smartworkhotel.jp">info@smartworkhotel.jp</a></td></tr>
        <tr><th>販売価格</th><td>各予約サイトのプラン画面に表示する宿泊料金（消費税込み）</td></tr>
        <tr><th>宿泊料金以外に必要な費用</th><td>ありません。駐車場は無料です。予約サイトの閲覧に要する通信費はお客さまのご負担となります</td></tr>
        <tr><th>お支払い方法</th><td>各予約サイトでのクレジットカード決済のみ。現金・電子マネー・QRコード決済を含め、現地でのお支払いはお受けしていません</td></tr>
        <tr><th>お支払い時期</th><td>ご予約確定時（各予約サイトの規定に従います）</td></tr>
        <tr><th>サービスの提供時期</th><td>ご予約いただいた宿泊日のチェックイン時刻（16:00）から</td></tr>
        <tr><th>キャンセル・返金</th><td>第6条「別表 違約金（キャンセル料）」のとおりです。ご予約のプランに個別のキャンセルポリシーが表示されている場合はそちらが優先されます。返金は、お支払いに使われた予約サイトを通じて同じクレジットカードへ行います</td></tr>
        </tbody>
      </table>
    </section>
"""


def read(path):
    return io.open(path, encoding="utf-8", newline="").read()


def write(path, text):
    io.open(path, "w", encoding="utf-8", newline="").write(text)


def apply_fonts(path):
    source = read(path)
    source, removed = re.subn(r"family=Zen\+Kaku\+Gothic\+New:wght@[0-9;]+&", "", source)
    if "/fonts/zen-kaku-gothic-new-" not in source:
        anchor = source.index("<style>")
        source = source[:anchor] + BLOCK + source[anchor:]
    write(path, source)
    print("%s: Google Fonts の Zen Kaku を外した=%d" % (path, removed))


def apply_tokusho():
    path = "terms.html"
    source = read(path)
    if 'id="tokusho"' not in source:
        anchor = "\n  </div>\n</main>"
        assert anchor in source
        source = source.replace(anchor, SECTION + anchor, 1)
        write(path, source)
        print("terms.html: PART 4 を追加")
    path = "index.html"
    source = read(path)
    link = '<a href="terms.html">宿泊約款・利用規則</a>'
    added = '<a href="terms.html">宿泊約款・利用規則</a>\n      <a href="terms.html#tokusho">特定商取引法に基づく表記</a>'
    if "terms.html#tokusho" not in source:
        count = source.count(link)
        source = source.replace(link, added)
        write(path, source)
        print("index.html: 表記へのリンクを %d 箇所に追加" % count)


def apply_meta():
    path = "sitemap.xml"
    write(path, read(path).replace("<lastmod>2026-07-02</lastmod>", "<lastmod>2026-09-02</lastmod>"))
    path = "llms.txt"
    source = read(path)
    if "特定商取引法" not in source:
        source = source.rstrip() + (
            "\n\n## 規約・法的表記\n"
            "- 宿泊約款・利用規則: https://www.smartworkhotel.jp/terms.html\n"
            "- 特定商取引法に基づく表記: https://www.smartworkhotel.jp/terms.html#tokusho\n"
        )
        write(path, source)
    print("sitemap.xml / llms.txt 更新")


if __name__ == "__main__":
    apply_fonts("index.html")
    apply_fonts("terms.html")
    apply_tokusho()
    apply_meta()
