/**
 * Verifies that the production artifact is rooted at the canonical www domain.
 * Unlike checking DNS, this asserts our own generated HTML, assets and CMS paths.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const domain='www.soma-consciente.com';
const site='https://'+domain;
const html=readFileSync('dist/index.html','utf8');
const lesson=readFileSync(join('dist','aulas','jasper','musica-medicina','escuchar','que-es-la-musica','index.html'),'utf8');
const cms=readFileSync('.pages.yml','utf8');
const artifact=readFileSync('dist/CNAME','utf8').trim();

assert.equal(artifact,domain,'The deployed public/CNAME must contain the chosen www host.');
assert.match(html,new RegExp('rel="canonical" href="'+site.replaceAll('.','\\.')+'/"'));
assert.match(html,/href="\/aulas\/"/,'Homepage links must start at the domain root.');
assert.match(html,/href="\/biblioteca\/"/,'Biblioteca link must start at the root.');
assert.match(html,/href="\/_astro\//,'Generated Astro assets must be root-relative.');
assert.match(html,/\/media\/soma-original-emblem\.png/,'Brand mark must resolve at /media.');
assert.match(lesson,/href="\/aulas\/jasper\//,'Lesson navigation must use root routes.');
assert.match(cms,/output:\s*\/media(?:\s|$)/m,'Pages CMS must write /media paths.');
assert.ok(existsSync(join('dist','media','soma-original-emblem.png')),'Original SOMA logo missing from deployment.');
assert.doesNotMatch(html,/itsjasperr\.github\.io/,'Old canonical GitHub host remains in HTML.');
assert.doesNotMatch(html,/["']\/soma-consciente\//,'Old project prefix remains in HTML.');
assert.doesNotMatch(lesson,/["']\/soma-consciente\//,'Old project prefix remains in lessons.');
console.log('PASS: custom-domain canonical URLs, root-relative links/assets, Pages CMS media and CNAME.');
