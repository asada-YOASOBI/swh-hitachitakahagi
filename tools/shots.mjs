// 目視確認用スクリーンショット（puppeteer-core＋ローカルChrome）
// 使い方: node tools/shots.mjs  → .tmp/shots/*.png（PC 1440 / スマホ 390・DPR2、いずれもフルページ＋ファーストビュー）
// node_modules は tomori-hp へのジャンクション（puppeteer-core を共用）
import { mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '.tmp', 'shots');
mkdirSync(OUT, { recursive: true });

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const PORT = 8134;
const MIME = { html: 'text/html; charset=utf-8', css: 'text/css', js: 'text/javascript', woff2: 'font/woff2', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', ico: 'image/x-icon', xml: 'application/xml', txt: 'text/plain' };

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  try {
    const data = await readFile(join(ROOT, p));
    res.writeHead(200, { 'content-type': MIME[p.split('.').pop()] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('nf'); }
}).listen(PORT);

const PAGES = process.argv[2] ? process.argv[2].split(',') : ['/', '/terms.html'];
const name = (p, dev) => (p === '/' ? 'index' : p.replace(/^\//, '').replace(/\.html$/, '')) + (dev === 'm' ? '-m' : '');
const errors = [];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars'] });
try {
  for (const [dev, viewport] of [['pc', { width: 1440, height: 900 }], ['m', { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${dev}] ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`[${dev}] ${e.message}`));
    // 出現アニメを止めて全要素を写す（OS の reduce 設定は無視する設計なので、検証用クラスで止める）
    await page.evaluateOnNewDocument((() => {
      const add = () => { if (document.documentElement) { document.documentElement.classList.add('no-motion'); return true; } return false; };
      if (!add()) new MutationObserver((_, o) => { if (add()) o.disconnect(); }).observe(document, { childList: true });
    }));
    for (const p of PAGES) {
      await page.goto(`http://localhost:${PORT}${p}`, { waitUntil: 'networkidle0' });
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(async () => {
        const step = window.innerHeight;
        for (let y = 0; y < document.body.scrollHeight; y += step) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
        window.scrollTo(0, 0);
      });
      await page.waitForNetworkIdle({ idleTime: 300 }).catch(() => {});
      await page.screenshot({ path: join(OUT, `${name(p, dev)}.png`), fullPage: true });
      console.log('shot', name(p, dev));
    }
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });
    await page.screenshot({ path: join(OUT, `fv-${dev}.png`) });
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
if (errors.length) { console.log('console errors:'); errors.forEach((e) => console.log(' ', e)); }
