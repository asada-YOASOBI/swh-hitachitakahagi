// 状態別の確認：スクロール後のヘッダー・固定CTA・メニュー展開・地図の実寸
import { mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '.tmp', 'shots'); mkdirSync(OUT, { recursive: true });
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const PORT = 8135;
const MIME = { html: 'text/html; charset=utf-8', css: 'text/css', js: 'text/javascript', woff2: 'font/woff2', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', ico: 'image/x-icon' };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  try { const d = await readFile(join(ROOT, p)); res.writeHead(200, { 'content-type': MIME[p.split('.').pop()] || 'application/octet-stream' }); res.end(d); } catch { res.writeHead(404); res.end(); }
}).listen(PORT);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars'] });
try {
  for (const [dev, vp] of [['pc', { width: 1440, height: 900 }], ['m', { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
    const page = await browser.newPage(); await page.setViewport(vp);
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });
    await sleep(3200);
    await page.screenshot({ path: join(OUT, `state-${dev}-fv-motion.png`) });
    await page.evaluate(() => window.scrollTo(0, 1400)); await sleep(900);
    await page.screenshot({ path: join(OUT, `state-${dev}-scrolled.png`) });
    const info = await page.evaluate(() => {
      const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
      return { header: document.querySelector('.header').className, body: document.body.className, cta: r('.cta-fixed'), spbar: r('.sp-bar'), map: r('.access__map iframe'), mapBox: r('.access__map') };
    });
    console.log(dev, JSON.stringify(info));
    await page.evaluate(() => window.scrollTo(0, 400)); await sleep(700);
    await page.screenshot({ path: join(OUT, `state-${dev}-up.png`) });
    await page.click('.pill--menu'); await sleep(800);
    await page.screenshot({ path: join(OUT, `state-${dev}-menu.png`) });
    console.log(dev, 'errors', errs);
    await page.close();
  }
} finally { await browser.close(); server.close(); }
