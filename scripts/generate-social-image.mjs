/**
 * SOMA social preview artwork, 1200 × 630 PNG.
 * Uses the existing original emblem unchanged (no generic icon recreation).
 * Rebuilds a static first-party asset before Astro's build/dev. Never relies on
 * client-side JS or a third-party image URL for link preview crawlers.
 */
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import sharp from 'sharp';

const width = 1200;
const height = 630;
const emblemPath = resolve('public/media/soma-original-emblem.png');
const output = resolve('public/og/soma-consciente.png');

const art = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
<defs>
  <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fbf7ee"/>
    <stop offset=".57" stop-color="#f6efe4"/>
    <stop offset="1" stop-color="#ecdfcc"/>
  </linearGradient>
  <radialGradient id="warm" cx=".25" cy=".4" r=".8">
    <stop offset="0" stop-color="#f4e7d6" stop-opacity=".95"/>
    <stop offset="1" stop-color="#f4e7d6" stop-opacity="0"/>
  </radialGradient>
</defs>
<rect width="1200" height="630" fill="url(#paper)"/>
<rect width="1200" height="630" fill="url(#warm)"/>
<path d="M0 554c192-34 278-3 441 67M818 0c64 63 160 100 382 94" fill="none" stroke="#ba9674" stroke-opacity=".37" stroke-width="2"/>
<circle cx="304" cy="310" r="255" fill="none" stroke="#c4a37f" stroke-opacity=".46" stroke-width="2"/>
<circle cx="304" cy="310" r="215" fill="none" stroke="#a8b4a4" stroke-opacity=".50" stroke-width="2"/>
<circle cx="304" cy="310" r="271" fill="none" stroke="#c6a58a" stroke-opacity=".20" stroke-width="1"/>
<circle cx="1060" cy="65" r="44" fill="#bb8d54" fill-opacity=".22"/>
<circle cx="1128" cy="502" r="100" fill="none" stroke="#c88c70" stroke-opacity=".25" stroke-width="2"/>
<path d="M572 136h510" stroke="#ad8b77" stroke-opacity=".55" stroke-width="2"/>
<text x="584" y="260" fill="#252621" font-family="Georgia, 'DejaVu Serif', serif" font-size="101" font-weight="400" letter-spacing="-3">SOMA</text>
<text x="585" y="323" fill="#24503f" font-family="'DejaVu Sans', sans-serif" font-size="41" font-weight="600" letter-spacing="7">CONSCIENTE</text>
<text x="586" y="402" fill="#262b23" font-family="Georgia, 'DejaVu Serif', serif" font-size="32">Cuatro caminos, un mismo núcleo.</text>
<path d="M584 435h498" stroke="#bf9071" stroke-opacity=".48" stroke-width="2"/>
<text x="586" y="485" fill="#5e685e" font-family="'DejaVu Sans', sans-serif" font-size="23">Aprender · Practicar · Integrar</text>
<text x="586" y="535" fill="#a96d55" font-family="'DejaVu Sans', sans-serif" font-size="18" letter-spacing="3">UN CAMINO DE PRESENCIA Y CONSCIENCIA</text>
</svg>`;
await mkdir(dirname(output), {recursive: true});
const emblem = await sharp(emblemPath).resize({width:505, height:400, fit:'contain'})
  .png().toBuffer();
await sharp({create:{width,height,channels:4,background:'#f7f1e8'}})
  .composite([
    {input: Buffer.from(art),top:0,left:0},
    {input:emblem,top:108,left:53}
  ])
  .png({compressionLevel:9,palette:false})
  .toFile(output);
console.log('Generated SOMA OG preview: public/og/soma-consciente.png ('+width+'×'+height+')');
