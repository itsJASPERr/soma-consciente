/**
 * Public-only publishing contract regression:
 * 1. Free lessons still render completely.
 * 2. Preview lessons generate teaser pages, never lesson blocks.
 * 3. Paid/member lessons are catalog entries WITHOUT lesson pages.
 * Test files are temporary, removed in finally. CI rebuilds normal site after.
 */
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const folder = join('src','content','lecciones');
const root = join('dist','aulas','jasper','musica-medicina');
const marker = 'SOMA_QA_PREVIEW_PUBLIC_2026';
const fixtures = [
  {slug:'soma-qa-preview',status:'published',accessLevel:'preview',publicPreview:marker,blocks:[]},
  {slug:'soma-qa-paid',status:'published',accessLevel:'paid',publicPreview:'',blocks:[]},
  {slug:'soma-qa-members',status:'published',accessLevel:'members',publicPreview:'',blocks:[]}
].map((entry,i)=>({
  ...entry, key: 'soma-qa-'+i+'-'+entry.slug,
  section: 'jasper-musica-medicina-escuchar',
  title:'TEST '+entry.slug,
  summary:'PUBLIC TEST METADATA',
  order:900+i,
  durationMinutes:0
}));
const files = fixtures.map(x=>join(folder,x.key+'.json'));
try {
  for (const file of files) if(existsSync(file))throw Error('Refusing to overwrite '+file);
  fixtures.forEach((f,i)=>writeFileSync(files[i],JSON.stringify(f,null,2)+'\n'));
  const build=spawnSync('npm',['run','build'],{stdio:'inherit',encoding:'utf8'});
  if(build.status!==0)throw Error('Temporary access-gating build failed');
  const courseHtml = readFileSync(join(root,'index.html'),'utf8');
  for(const f of fixtures){
    const target=join(root,'escuchar',f.slug,'index.html');
    if(!courseHtml.includes(f.title))throw Error('Catalog omits '+f.title);
    if(f.accessLevel==='preview') {
      if(!existsSync(target))throw Error('Preview page missing');
      const html=readFileSync(target,'utf8');
      if(!html.includes(marker))throw Error('Public teaser missing');
      if(html.includes('lesson-blocks'))throw Error('Preview route appears to contain lesson blocks');
    } else if(existsSync(target)) {
      throw Error('SECURITY: protected route was exported for '+f.key);
    }
  }
  const free=join(root,'escuchar','que-es-la-musica','index.html');
  if(!existsSync(free) || !readFileSync(free,'utf8').includes('Escuchar más allá'))
    throw Error('Existing free lesson no longer renders');
  console.log('PASS: free content, public previews, and locked catalog-only lessons');
} finally {
  files.forEach(file=>{if(existsSync(file))unlinkSync(file);});
}
