// 公式HPのビルド：src/pages/*.html（本文＋先頭のメタ）を src/layout.html と partials で包み、
// CSS を最小化して同梱し、構造化データ・sitemap.xml・llms-full.txt を生成する。
//   node tools/build.mjs
// 出力はリポジトリ直下（index.html・rooms/index.html …）。Vercel は cleanUrls/trailingSlash でそのまま配信する。
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const ORIGIN = 'https://www.smartworkhotel.jp';
const TODAY = new Date().toISOString().slice(0, 10);
const VERSION = TODAY.replace(/-/g, '');

const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const site = JSON.parse(read('src/site.json'));
const faq = JSON.parse(read('src/faq.json'));

// ---------- CSS を最小化（csso）。失敗したら素のまま同梱する ----------
let css = read('css/style.css');
try {
  css = execFileSync('npx', ['--yes', 'csso-cli', '--input', join(ROOT, 'css/style.css')], { encoding: 'utf8', shell: true, windowsHide: true });
} catch (e) { console.warn('csso をスキップ:', e.message.split('\n')[0]); }

// ---------- 構造化データ ----------
const hotelId = `${ORIGIN}/#hotel`;
const orgId = `${ORIGIN}/#organization`;
const hotel = {
  '@type': 'Hotel', '@id': hotelId,
  name: site.name, alternateName: site.nameEn,
  description: site.description,
  url: `${ORIGIN}/`,
  image: site.images.map((p) => `${ORIGIN}${p}`),
  logo: `${ORIGIN}/images/brand-mark.png`,
  email: site.email,
  priceRange: site.priceRange, currenciesAccepted: 'JPY', paymentAccepted: 'オンライン決済（各予約サイトでのクレジットカード決済ほか）',
  foundingDate: site.openingDate,
  petsAllowed: false, smokingAllowed: false,
  numberOfRooms: site.rooms,
  checkinTime: site.checkin, checkoutTime: site.checkout,
  availableLanguage: ['ja', 'en', 'zh', 'ko'],
  address: { '@type': 'PostalAddress', postalCode: site.postalCode, addressRegion: '茨城県', addressLocality: '高萩市', streetAddress: '高戸387-12', addressCountry: 'JP' },
  geo: { '@type': 'GeoCoordinates', latitude: site.lat, longitude: site.lng },
  hasMap: site.mapUrl,
  sameAs: site.sameAs,
  parentOrganization: { '@id': orgId },
  amenityFeature: site.amenities.map((name) => ({ '@type': 'LocationFeatureSpecification', name, value: true })),
  containsPlace: {
    '@type': 'HotelRoom', name: 'ダブルルーム', description: '14平方メートル。ダブルベッド1台、ワークデスク、スマートテレビ、冷蔵庫、電気ケトル、ユニットバス。全室禁煙。',
    occupancy: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 2 },
    floorSize: { '@type': 'QuantitativeValue', value: 14, unitCode: 'MTK' },
    bed: { '@type': 'BedDetails', typeOfBed: 'Double', numberOfBeds: 1 },
    amenityFeature: site.roomAmenities.map((name) => ({ '@type': 'LocationFeatureSpecification', name, value: true })),
  },
  makesOffer: { '@type': 'Offer', name: 'ダブルルーム', priceCurrency: 'JPY', price: '6000', priceSpecification: { '@type': 'PriceSpecification', price: '6000', priceCurrency: 'JPY', minPrice: '6000' }, availability: 'https://schema.org/InStock', url: site.bookingUrl },
  potentialAction: { '@type': 'ReserveAction', target: { '@type': 'EntryPoint', urlTemplate: site.bookingUrl, actionPlatform: ['http://schema.org/DesktopWebPlatform', 'http://schema.org/MobileWebPlatform'] }, result: { '@type': 'LodgingReservation', name: '宿泊予約' } },
};
const organization = {
  '@type': 'Organization', '@id': orgId, name: site.company.name, url: `${ORIGIN}/company/`,
  founder: { '@type': 'Person', name: site.company.representative, jobTitle: '代表取締役' },
  address: { '@type': 'PostalAddress', postalCode: site.company.postalCode, addressRegion: '群馬県', addressLocality: '太田市', streetAddress: '飯田町1267', addressCountry: 'JP' },
  email: site.email,
};
const website = { '@type': 'WebSite', '@id': `${ORIGIN}/#website`, url: `${ORIGIN}/`, name: site.name, inLanguage: 'ja', publisher: { '@id': orgId } };

function schemaFor(meta) {
  const url = `${ORIGIN}${meta.path}`;
  const crumbs = [{ '@type': 'ListItem', position: 1, name: 'ホーム', item: `${ORIGIN}/` }];
  if (meta.path !== '/') crumbs.push({ '@type': 'ListItem', position: 2, name: meta.crumb, item: url });
  const graph = [
    { '@type': 'WebPage', '@id': `${url}#webpage`, url, name: meta.title, description: meta.description, inLanguage: 'ja', isPartOf: { '@id': `${ORIGIN}/#website` }, about: { '@id': hotelId }, dateModified: TODAY, datePublished: meta.published || '2026-06-01' },
    { '@type': 'BreadcrumbList', itemListElement: crumbs },
    hotel,
    organization,
    website,
  ];
  if (meta.faq) graph.push({ '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })}</script>`;
}

// ---------- ページ ----------
const layout = read('src/layout.html').replace(/\{\{EXT_RANGE\}\}/g, read('fonts/ext-unicode-range.txt').trim());
const header = read('src/partials/header.html');
const footer = read('src/partials/footer.html').replace(/\{\{VERSION\}\}/g, VERSION);
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function renderFaq(items, { withGroups }) {
  let out = '';
  let group = '';
  for (const f of items) {
    if (withGroups && f.group !== group) { if (group) out += '</div>'; group = f.group; out += `<h2 class="h3 reveal" style="margin-top:56px">${group}</h2><div class="faq__list reveal">`; }
    out += `<details id="${f.id}"><summary>${escapeHtml(f.q)}</summary><div class="ans">${escapeHtml(f.a)}</div></details>`;
  }
  if (withGroups && group) out += '</div>';
  return out;
}

const pages = [];
for (const file of readdirSync(join(SRC, 'pages')).filter((f) => f.endsWith('.html'))) {
  const raw = readFileSync(join(SRC, 'pages', file), 'utf8');
  const m = raw.match(/^<!--meta\s*([\s\S]*?)-->/);
  if (!m) throw new Error(`${file}: 先頭の <!--meta {...} --> が無い`);
  const meta = JSON.parse(m[1]);
  let bodyHtml = raw.slice(m[0].length).trim();
  bodyHtml = bodyHtml.replace('{{FAQ_ALL}}', () => renderFaq(faq, { withGroups: true }));
  bodyHtml = bodyHtml.replace('{{FAQ_TOP}}', () => renderFaq(faq.filter((f) => meta.faqTop.includes(f.id)), { withGroups: false }));
  const canonical = `${ORIGIN}${meta.path}`;
  const html = layout
    .replace(/\{\{TITLE\}\}/g, escapeHtml(meta.title))
    .replace(/\{\{OG_TITLE\}\}/g, escapeHtml(meta.ogTitle || meta.title))
    .replace(/\{\{DESCRIPTION\}\}/g, escapeHtml(meta.description))
    .replace(/\{\{CANONICAL\}\}/g, canonical)
    .replace(/\{\{OG_TYPE\}\}/g, meta.path === '/' ? 'website' : 'article')
    .replace('{{PRELOAD}}', meta.preload || '')
    .replace('{{CSS}}', () => css)
    .replace('{{SCHEMA}}', () => (meta.noindex ? '' : schemaFor(meta)))
    .replace('{{BODY_CLASS}}', meta.path === '/' ? 'is-top' : 'is-sub')
    .replace('{{HEADER}}', () => header)
    .replace('{{BODY}}', () => bodyHtml)
    .replace('{{FOOTER}}', () => footer)
    .replace(/<meta name="robots" content="[^"]*">/, meta.noindex ? '<meta name="robots" content="noindex, follow">' : '$&');
  const outPath = meta.out || (meta.path === '/' ? 'index.html' : `${meta.path.replace(/^\/|\/$/g, '')}/index.html`);
  mkdirSync(dirname(join(ROOT, outPath)), { recursive: true });
  writeFileSync(join(ROOT, outPath), html);
  pages.push({ meta, bodyHtml, outPath });
  console.log('wrote', outPath, Math.round(html.length / 1024), 'KB');
}

// ---------- sitemap.xml ----------
const sitemapPages = pages.filter((p) => !p.meta.noindex);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${sitemapPages.map((p) => `  <url>
    <loc>${ORIGIN}${p.meta.path}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${p.meta.path === '/' ? 'weekly' : 'monthly'}</changefreq>
    <priority>${p.meta.priority || 0.7}</priority>${(p.meta.images || []).map((img) => `
    <image:image><image:loc>${ORIGIN}${img.src}</image:loc><image:title>${escapeHtml(img.title)}</image:title></image:image>`).join('')}
  </url>`).join('\n')}
  <url>
    <loc>${ORIGIN}/terms/</loc>
    <lastmod>2026-09-11</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
</urlset>
`;
writeFileSync(join(ROOT, 'sitemap.xml'), sitemap);

// ---------- llms-full.txt（全ページの本文をテキスト化。AI検索に読ませる正本） ----------
const toText = (html) => html
  .replace(/<script[\s\S]*?<\/script>|<svg[\s\S]*?<\/svg>|<style[\s\S]*?<\/style>/g, '')
  .replace(/<(h1|h2)[^>]*>/g, '\n\n## ').replace(/<h3[^>]*>/g, '\n\n### ')
  .replace(/<(li|p|dt|dd|summary|div class="ans")[^>]*>/g, '\n')
  .replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
const llmsFull = `# スマートワークホテル日立高萩 公式サイト 全文（${TODAY} 更新）\n\n` +
  sitemapPages.map((p) => `# ${p.meta.title}\nURL: ${ORIGIN}${p.meta.path}\n\n${toText(p.bodyHtml)}`).join('\n\n---\n\n') + '\n';
writeFileSync(join(ROOT, 'llms-full.txt'), llmsFull);
console.log('sitemap.xml / llms-full.txt 生成', sitemapPages.length + 1, 'URL');
