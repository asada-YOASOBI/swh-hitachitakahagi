// りり確認用のプレビュー（Artifact向け1枚HTML）を作る
// 使い方: node tools/make-preview.mjs <出力パス>
// Artifact は外部の画像・フォント・iframe を読めないので、CSS・JS・フォント・画像を全部 data: URI で同梱し、
// 地図の iframe と tripla の SDK は省く。<html><head><body> は Artifact 側が付けるので本文だけ出す。
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2];
if (!out) { console.error('出力パスを指定してください'); process.exit(1); }

const MIME = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', woff2: 'font/woff2' };
const dataUri = (relative) => {
  const path = join(ROOT, relative.replace(/^\//, '').split('?')[0]);
  const mime = MIME[extname(path).slice(1)] || 'application/octet-stream';
  return `data:${mime};base64,${readFileSync(path).toString('base64')}`;
};

let html = readFileSync(join(ROOT, 'index.html'), 'utf8');
let css = readFileSync(join(ROOT, 'css/style.css'), 'utf8');
const fontFaces = (html.match(/@font-face\{[^}]+\}/g) || []).map((rule) => rule.replace(/url\('([^']+)'\)/, (_, u) => `url('${dataUri(u)}')`)).join('\n');
css = css.replace(/url\('\/fonts\/[^']+'\)/g, '');

// 本文だけ取り出す
let body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'));
// 画像を同梱（src / srcset）
body = body.replace(/src="(images\/[^"]+)"/g, (_, u) => `src="${dataUri(u)}"`);
body = body.replace(/srcset="([^"]+)"/g, (_, list) => `srcset="${list.split(',').map((item) => { const [u, w] = item.trim().split(/\s+/); return `${dataUri(u)} ${w}`; }).join(', ')}"`);
// 地図は Artifact で読めないので、住所の板に置き換える
body = body.replace(/<iframe[\s\S]*?<\/iframe>/, '<div style="position:absolute;inset:0;display:grid;place-items:center;font-size:13px;letter-spacing:.1em;color:#5f646a">地図（公開時は Google マップが入ります）</div>');
// JS を同梱
const scripts = ['js/gsap.min.js', 'js/ScrollTrigger.min.js', 'js/lenis.min.js', 'js/main.js'].map((f) => `<script>${readFileSync(join(ROOT, f), 'utf8')}</script>`).join('\n');
body = body.replace(/<script src="js\/[^"]+" defer><\/script>\s*/g, '');

const page = `<title>スマートワークホテル日立高萩 新トップ</title>
<style>${fontFaces}\n${css}\n#claude-artifact-root,body{background:#f3f3f2}</style>
${body}
${scripts}`;
writeFileSync(out, page);
console.log('wrote', out, Math.round(page.length / 1024), 'KB');
