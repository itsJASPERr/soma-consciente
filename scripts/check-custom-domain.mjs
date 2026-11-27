/**
 * Verifies that the production artifact is rooted at the canonical domain.
 * Unlike checking DNS, this asserts our own generated HTML, assets and CMS paths.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, sep } from 'node:path';

const domain='soma-consciente.com';
const site='https://'+domain;
const html=readFileSync('dist/index.html','utf8');
const aulas=readFileSync(join('dist','aulas','index.html'),'utf8');
const lesson=readFileSync(join('dist','aulas','jasper','musica-medicina','escuchar','que-es-la-musica','index.html'),'utf8');
const cms=readFileSync('.pages.yml','utf8');
const artifact=readFileSync('dist/CNAME','utf8').trim();

assert.equal(artifact,domain,'The deployed public/CNAME must contain the canonical host.');
assert.match(html,new RegExp('rel="canonical" href="'+site.replaceAll('.','\\.')+'/"'));
const headerCta = html.match(/<a\b[^>]*class="header-cta"[^>]*>Ver encuentros\b/)?.[0] ?? '';
assert.match(headerCta, /href="\/encuentros\/"/, 'Ver encuentros in the header must link to the events page.');
assert.ok(aulas.includes(`rel="canonical" href="${site}/aulas/"`), 'The Aula directory must retain its canonical URL.');
assert.match(html,/href="\/biblioteca\/"/,'Biblioteca link must start at the root.');
assert.match(html,/href="\/_astro\//,'Generated Astro assets must be root-relative.');
assert.match(html,/\/media\/soma-original-emblem\.png/,'Brand mark must resolve at /media.');
assert.match(lesson,/href="\/aulas\/jasper\//,'Lesson navigation must use root routes.');
assert.match(cms,/output:\s*\/media(?:\s|$)/m,'Pages CMS must write /media paths.');
assert.ok(existsSync(join('dist','media','soma-original-emblem.png')),'Original SOMA logo missing from deployment.');
assert.doesNotMatch(html,/itsjasperr\.github\.io/,'Old canonical GitHub host remains in HTML.');
assert.doesNotMatch(html,/["']\/soma-consciente\//,'Old project prefix remains in HTML.');
assert.doesNotMatch(lesson,/["']\/soma-consciente\//,'Old project prefix remains in lessons.');
assert.match(html, /<link rel="sitemap" href="\/sitemap-index\.xml"/);
const robots = readFileSync('dist/robots.txt', 'utf8');
assert.ok(robots.split(/\r?\n/).includes('Sitemap: ' + site + '/sitemap-index.xml'));

const sitemapIndex = readFileSync('dist/sitemap-index.xml', 'utf8');
const sitemapURLs = [...sitemapIndex.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]));
assert.ok(sitemapURLs.length > 0, 'The sitemap index must contain at least one sitemap.');
const pageURLs = new Set();
for (const sitemapURL of sitemapURLs) {
  assert.equal(sitemapURL.origin, site, 'Sitemaps must use the canonical origin.');
  const sitemap = readFileSync(join('dist', sitemapURL.pathname), 'utf8');
  for (const match of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const page = new URL(match[1]);
    assert.equal(page.origin, site, 'Sitemap URLs must use the canonical origin.');
    assert.ok(!pageURLs.has(page.href), 'Duplicate sitemap entry: ' + page.href);
    pageURLs.add(page.href);
    const pageHtml = readFileSync(join('dist', decodeURIComponent(page.pathname), 'index.html'), 'utf8');
    assert.ok(pageHtml.includes('<link rel="canonical" href="' + page.href + '"'), 'Canonical mismatch: ' + page.href);
  }
}
for (const path of ['/', '/biblioteca/', '/aulas/']) {
  assert.ok(pageURLs.has(site + path), 'The sitemap is missing ' + path);
}
for (const path of ['/politica-de-privacidad/', '/terminos-y-condiciones/']) {
  assert.ok(html.includes('href="' + path + '"'), 'The footer is missing ' + path);
  assert.ok(existsSync(join('dist', path, 'index.html')), 'The footer links to a missing page: ' + path);
}
for (const path of ['/mensajes/', '/politica-de-privacidad/', '/terminos-y-condiciones/', '/404.html']) {
  const file = path.endsWith('/') ? join(path, 'index.html') : path;
  assert.match(readFileSync(join('dist', file), 'utf8'), /<meta name="robots" content="noindex"/);
}
const metadata = new Map();
const titles = new Set();
const descriptions = new Set();
const files = readdirSync('dist', { recursive: true }).filter(file => file.endsWith('.html'));
for (const file of files) {
  const page = readFileSync(join('dist', file), 'utf8');
  const pathname = '/' + file.split(sep).join('/').replace(/(^|\/)index\.html$/, '$1');
  const url = new URL(pathname, site).href;
  const noIndex = /<meta name="robots" content="noindex"/.test(page);
  assert.equal(pageURLs.has(url), !noIndex, 'Sitemap indexability mismatch: ' + pathname);

  const schema = [...page.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)]
    .map(match => JSON.parse(match[1]));
  metadata.set(pathname, schema);
  if (noIndex) continue;

  for (const [label, pattern, seen] of [
    ['title', /<title>([^<]+)<\/title>/g, titles],
    ['description', /<meta name="description" content="([^"]+)"/g, descriptions],
  ]) {
    const matches = [...page.matchAll(pattern)];
    assert.equal(matches.length, 1, 'Expected one ' + label + ': ' + pathname);
    const value = matches[0][1].trim();
    assert.ok(value && !seen.has(value), 'Empty or duplicate ' + label + ': ' + pathname);
    seen.add(value);
  }
  assert.equal([...page.matchAll(/<h1\b/g)].length, 1, 'Expected one H1: ' + pathname);
}
assert.deepEqual(metadata.get('/').find(schema => schema['@type'] === 'WebSite'), {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'SOMA CONSCIENTE',
  url: site + '/',
});
const organization = metadata.get('/').find(schema => schema['@type'] === 'Organization');
assert.deepEqual(organization.sameAs, ['https://www.instagram.com/soma.consciente.ar/']);
for (const [month, starts, ends] of [
  ['enero', '2027-01-23', '2027-01-24'],
  ['febrero', '2027-02-15', '2027-02-16'],
]) {
  const pathname = '/encuentros/retiro-' + month + '-2027/';
  const schema = metadata.get(pathname);
  const event = schema.find(item => item['@type'] === 'Event');
  assert.equal(event.url, site + pathname);
  assert.equal(event.startDate, starts);
  assert.equal(event.endDate, ends);
  assert.equal(event.location.name, 'Casa Sabia');
  assert.equal(event.location.address.addressLocality, 'Huerta Grande');
  assert.equal(event.organizer['@id'], organization['@id']);
  assert.ok(schema.some(item => item['@type'] === 'BreadcrumbList'));
}
assert.ok(metadata.get('/biblioteca/diario-de-integracion/').some(item => item['@type'] === 'Article'));
console.log('PASS: SEO metadata across ' + files.length + ' pages, ' + pageURLs.size + ' canonical sitemap URLs, and structured data.');
