/**
 * Verifies that the production artifact is rooted at the canonical domain.
 * Unlike checking DNS, this asserts our own generated HTML, assets and CMS paths.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

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
const missingPage = readFileSync('dist/404.html', 'utf8');
assert.match(missingPage, /<meta name="robots" content="noindex"/);
for (const errorPath of ['/404', '/404/', '/404.html']) {
  assert.ok(!pageURLs.has(site + errorPath), 'The sitemap must exclude the 404 page.');
}
const siteNameMarkup = html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)?.[1];
assert.ok(siteNameMarkup, 'Missing homepage WebSite structured data.');
assert.deepEqual(JSON.parse(siteNameMarkup), {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'SOMA CONSCIENTE',
  url: site + '/',
});
console.log('PASS: canonical URLs, sitemap, robots.txt, homepage site name, assets and CMS paths.');
