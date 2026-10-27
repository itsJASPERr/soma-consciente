/**
 * Regression coverage for the Aula cards: all original images are constrained
 * within a fixed media frame at intermediary viewport widths.
 * Runs against the built static site, avoiding third-party requests.
 */
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const ROOT='http://127.0.0.1:4321/soma-consciente';
const WIDTHS=[320,375,430,599,600,650,680,681,767,879,880,900,1024,1149,1150,1151,1280];
const PAGES=['/','/aulas/'];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// Spawn Astro directly: terminating npm does not terminate its child Node process.
const server=spawn('./node_modules/.bin/astro',['preview','--host','127.0.0.1','--port','4321'],{
  stdio:['ignore','pipe','pipe'],env:process.env
});
let serverOutput='';
server.stdout.on('data',b=>serverOutput+=String(b));
server.stderr.on('data',b=>serverOutput+=String(b));
let browser;
let failures=[];
try {
  let ready=false;
  for(let i=0;i<70;i++){
    if(server.exitCode!==null)throw new Error('Astro preview exited: '+serverOutput);
    try{const res=await fetch(ROOT+'/');if(res.ok){ready=true;break;}}catch{}
    await sleep(160);
  }
  if(!ready)throw new Error('Astro preview not ready: '+serverOutput);
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:375,height:920},deviceScaleFactor:1});
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='127.0.0.1'||url.hostname==='localhost')
      return route.continue();
    // Some Astro asset URLs resolve against the configured canonical site.
    // Serve those asset requests from the current local PR build instead.
    if(url.hostname==='itsjasperr.github.io' && url.pathname.startsWith('/soma-consciente/')){
      const response=await route.fetch({url:'http://127.0.0.1:4321'+url.pathname+url.search});
      return route.fulfill({response});
    }
    return route.abort();
  });
  await mkdir('test-results',{recursive:true});
  for(const width of WIDTHS){
    await page.setViewportSize({width,height:920});
    for(const route of PAGES){
      const resp=await page.goto(ROOT+route,{waitUntil:'domcontentloaded',timeout:10000});
      if(!resp?.ok()){failures.push(width+' '+route+' returned '+resp?.status());continue;}
      await page.waitForLoadState('load',{timeout:4500}).catch(()=>{});
      if(width===WIDTHS[0] && route===PAGES[0]){
        const styles=await page.evaluate(()=>({
          hrefs:[...document.querySelectorAll('link[rel="stylesheet"]')].map(el=>el.href),
          stylesheets:document.styleSheets.length,
          cardPhotoFit:getComputedStyle(document.querySelector('.aula-card__photo')).objectFit
        }));
        console.log('Loaded stylesheet diagnostics: '+JSON.stringify(styles));
        if(styles.cardPhotoFit!=='cover')
          throw new Error('Local CSS did not load: '+JSON.stringify(styles));
      }
      const issues=await page.evaluate(()=>{
        const problems=[];
        const cards=[...document.querySelectorAll('.aula-grid .aula-card')];
        if(cards.length!==4)problems.push('Expected 4 cards, found '+cards.length);
        for(let i=0;i<cards.length;i++){
          const card=cards[i];
          const art=card.querySelector('.aula-card__art');
          const frame=card.querySelector('.aula-card__media');
          const image=card.querySelector('.aula-card__photo');
          const content=card.querySelector('.aula-card__content');
          if(!art||!frame||!image||!content){problems.push('card '+i+' missing structural nodes');continue;}
          const a=art.getBoundingClientRect(),f=frame.getBoundingClientRect(),im=image.getBoundingClientRect(),co=content.getBoundingClientRect();
          if(a.height>272||a.height<195)problems.push('card '+i+' art height '+a.height.toFixed(1));
          if(Math.abs(f.height-a.height)>2)problems.push('card '+i+' media frame mismatch');
          if(Math.abs(im.height-a.height)>2)problems.push('card '+i+' photo escapes media height');
          if(co.top<a.bottom-2)problems.push('card '+i+' text overlaps media');
          if(getComputedStyle(image).objectFit!=='cover')problems.push('card '+i+' lacks object-fit cover');
          // The emblem straddles the image/copy boundary. Test its lower half,
          // which previously disappeared behind the copy stacking context.
          const emblem=card.querySelector('.aula-icon');
          if(!emblem) problems.push('card '+i+' missing emblem');
          else {
            const e=emblem.getBoundingClientRect();
            const x=e.left+e.width/2;
            const y=e.top+e.height*0.78;
            const top=document.elementFromPoint(x,y);
            if(!top || !emblem.contains(top)) {
              problems.push('card '+i+' emblem lower half occluded by '+(top?.className||top?.tagName||'nothing'));
            }
          }
          if(card.scrollWidth>card.clientWidth+2)problems.push('card '+i+' horizontal overflow');
          if(a.left < -2||a.right>document.documentElement.clientWidth+2)problems.push('card '+i+' beyond viewport');
        }
        const grid=document.querySelector('.aula-grid');
        const columns=getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
        const expected=window.innerWidth<=680?1:window.innerWidth<=1150?2:4;
        if(columns!==expected)problems.push('grid has '+columns+' columns, expected '+expected);
        return problems;
      });
      failures.push(...issues.map(issue=>width+'px '+route+': '+issue));
      if(route==='/' && (width===430||width===680||width===900||width===1151)){
        const first=page.locator('.aula-card').first();
        await first.screenshot({path:'test-results/card-'+width+'.png',timeout:10000});
      }
    }
    console.log('Aula cards checked at '+width+'px');
  }
} catch(err){
  failures.push(err instanceof Error?err.stack:String(err));
} finally{
  if(browser)await browser.close().catch(()=>{});
  server.kill('SIGTERM');
  server.stdout.destroy();
  server.stderr.destroy();
}
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}
else console.log('PASS: Aula media bounds at '+WIDTHS.length+' widths and '+PAGES.length+' page types.');
