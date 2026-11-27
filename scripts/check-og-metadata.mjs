/**
 * Verify social link previews in actual exported pages (not just source code).
 * Catch missing assets, incorrect dimensions, relative URLs and generic titles.
 */
import {readFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {join} from 'node:path';

const site='https://soma-consciente.com';
const defaultCover='/og/soma-consciente.png';
const imageFile=join('dist','og','soma-consciente.png');
assert.ok(existsSync(imageFile),'OG image not included in the build output');
const png=readFileSync(imageFile);
assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a','OG preview is not a PNG');
assert.equal(png.readUInt32BE(16),1200,'OG image width must be 1200px');
assert.equal(png.readUInt32BE(20),630,'OG image height must be 630px');
assert.ok(png.length>15000,'OG image is unexpectedly small or empty');

function findMeta(html,key){
  const tags=html.match(/<meta\s+[^>]*>/g)||[];
  const exact=tags.filter(tag=>tag.includes('property="'+key+'"')||tag.includes('name="'+key+'"'));
  assert.equal(exact.length,1,'Expected exactly one '+key+' tag');
  const match=exact[0].match(/content="([^"]*)"/);
  assert.ok(match,'Missing content in '+key);
  return match[1];
}
const routes=[
  ['', 'SOMA CONSCIENTE'],
  ['aulas/jasper/', 'Música, círculos e integración'],
  ['aulas/yanina/bienestar-integral/', 'Bienestar integral'],
  ['encuentros/', 'Huerta Grande', '/media/photography/encuentro-entre-los-arboles.webp'],
  ['encuentros/retiro-enero-2027/', 'Huerta Grande', '/media/retreat/caballos-en-el-bosque.webp'],
  ['encuentros/retiro-febrero-2027/', 'Huerta Grande', '/media/retreat/caballos-en-el-bosque.webp'],
  ['acompanamiento/', 'Círculo de integración online', '/media/photography/circulo-de-integracion.webp'],
  ['biblioteca/', 'Biblioteca', '/media/photography/pausa-de-presencia.jpg'],
  ['biblioteca/primeros-pasos-meditacion/', 'Meditación', '/media/photography/meditacion-en-las-dunas.webp'],
  ['biblioteca/diario-de-integracion/', 'Diario', '/media/photography/escritura-en-el-diario.webp'],
  ['aulas/jasper/musica-medicina/escuchar/que-es-la-musica/', 'música']
];
for (const [relative,title,cover=defaultCover] of routes){
  const expectedImage=site+cover;
  assert.ok(existsSync(join('dist',cover)), 'Missing social image '+cover);
  const file=join('dist',relative,'index.html');
  assert.ok(existsSync(file),'Missing rendered page '+relative);
  const html=readFileSync(file,'utf8');
  const pageUrl=site+'/'+relative;
  assert.equal(findMeta(html,'og:url'),pageUrl,'Incorrect OG canonical URL');
  assert.equal(findMeta(html,'og:image'),expectedImage,'Invalid social image URL');
  assert.equal(findMeta(html,'og:image:secure_url'),expectedImage);
  const mimeTypes = { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg' };
  assert.equal(findMeta(html,'og:image:type'), mimeTypes[cover.split('.').pop()]);
  if (cover === defaultCover) {
    assert.equal(findMeta(html,'og:image:width'),'1200');
    assert.equal(findMeta(html,'og:image:height'),'630');
  }
  assert.equal(findMeta(html,'og:locale'),'es_AR');
  assert.equal(findMeta(html,'twitter:card'),'summary_large_image');
  assert.equal(findMeta(html,'twitter:image'),expectedImage);
  assert.ok(findMeta(html,'og:title').toLowerCase().includes(title.toLowerCase()),
    'Unexpected og:title for '+relative);
  assert.ok(findMeta(html,'og:description').length>=40,'Short or missing OG description');
  assert.ok(findMeta(html,'og:image:alt').length>20,'Missing image alt');
  console.log('✓ OG metadata '+pageUrl);
}
console.log('PASS: complete Open Graph/Twitter metadata and page-specific covers with a 1200x630 default.');
