/**
 * Regression coverage for the Aula cards: all original images are constrained
 * within a fixed media frame at intermediary viewport widths.
 * Runs against the built static site, avoiding third-party requests.
 */
import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const ROOT='http://127.0.0.1:4321';
const WIDTHS=[320,375,430,599,600,650,680,681,767,879,880,900,1024,1149,1150,1151,1280];
const PAGES=['/','/aulas/'];
const aulaDirectory = new URL('../src/content/aulas/', import.meta.url);
const aulaFiles = (await readdir(aulaDirectory)).filter(file => file.endsWith('.json'));
const aulas = await Promise.all(aulaFiles.map(async file => (
  JSON.parse(await readFile(new URL(file, aulaDirectory), 'utf8'))
)));
const expectedAulas = aulas.filter(aula => aula.published)
  .sort((a, b) => a.order - b.order)
  .map(aula => ({ href: `/aulas/${aula.slug}/`, name: aula.name, upcoming: aula.launchStatus === 'upcoming' }));
const methodologyNames = ['nicole', 'jasper', 'yanina', 'nico']
  .map(slug => aulas.find(aula => aula.published && aula.slug === slug)?.name)
  .filter(Boolean);
const availableAulas = expectedAulas.filter(aula => !aula.upcoming);
const upcomingAulas = expectedAulas.filter(aula => aula.upcoming);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// Spawn Astro directly so cleanup can terminate the server itself.
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
    if(url.hostname==='soma-consciente.com'){
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
      const directoryLink = page.locator('.site-header nav a[href="/aulas/"], .site-footer nav a[href="/aulas/"]');
      if (await directoryLink.count()) failures.push(width+'px '+route+': site navigation still links to the Aula directory');
      if (route === '/') {
        const program = page.locator('#metodologia');
        if (await page.locator('.aula-card').count()) failures.push(width+'px /: homepage shows Aula cards');
        await program.scrollIntoViewIfNeeded();
        const programIssues = await program.evaluate(async (section, names) => {
          const problems = [];
          const title = section.querySelector('h2');
          const logo = section.querySelector('.program-preview__emblem img');
          const themes = [...section.querySelectorAll('.program-preview__themes li')];
          if (title?.textContent.trim() !== 'Cuatro miradas, un núcleo') problems.push('incorrect methodology title');
          if (themes.map(theme => theme.textContent.trim()).join('|') !== names.join('|')) {
            problems.push('methodology keywords differ from the four titles');
          }
          if (logo) {
            logo.loading = 'eager';
            await logo.decode().catch(() => {});
          }
          if (!logo?.naturalWidth || !logo.getAttribute('src').endsWith('/media/soma-original-emblem.png')) {
            problems.push('original SOMA logo is missing or did not load');
          }
          for (const element of [title, logo, ...themes]) {
            if (!element) continue;
            const { left, right, width } = element.getBoundingClientRect();
            if (!width || element.scrollWidth > element.clientWidth + 2 ||
                left < -2 || right > document.documentElement.clientWidth + 2) {
              problems.push('program content is clipped: '+element.tagName);
            }
          }
          if (logo) {
            const logoBounds = logo.getBoundingClientRect();
            const shapeBounds = section.querySelector('.program-preview__shape')?.getBoundingClientRect();
            if (!shapeBounds ||
                Math.abs((logoBounds.left + logoBounds.right) - (shapeBounds.left + shapeBounds.right)) > 2 ||
                Math.abs((logoBounds.top + logoBounds.bottom) - (shapeBounds.top + shapeBounds.bottom)) > 2 ||
                logo.closest('.program-preview__window')) {
              problems.push('SOMA logo must be centered on the landscape and outside its crop');
            }
          }
          return problems;
        }, methodologyNames);
        failures.push(...programIssues.map(issue => width+'px /: '+issue));
        if (width === 430 || width === 900 || width === 1151) {
          await program.locator('.program-preview').screenshot({ path: 'test-results/program-'+width+'.png', timeout: 10000 });
        }
        continue;
      }
      if(width===WIDTHS[0] && availableAulas.length){
        const styles=await page.evaluate(()=>({
          hrefs:[...document.querySelectorAll('link[rel="stylesheet"]')].map(el=>el.href),
          stylesheets:document.styleSheets.length,
          cardPhotoFit:getComputedStyle(document.querySelector('.aula-card__photo')).objectFit
        }));
        console.log('Loaded stylesheet diagnostics: '+JSON.stringify(styles));
        if(styles.cardPhotoFit!=='cover')
          throw new Error('Local CSS did not load: '+JSON.stringify(styles));
      }
      const issues=await page.evaluate(({ availableAulas, upcomingAulas })=>{
        const problems=[];
        const upcoming=[...document.querySelectorAll('.aula-upcoming-list .aula-upcoming')];
        if (upcoming.length !== upcomingAulas.length) {
          problems.push('Upcoming Aula count differs from the content: '+upcoming.length);
        }
        for (const [index, item] of upcoming.entries()) {
          const title = item.querySelector('h2')?.textContent.trim();
          const isDisabled = item.getAttribute('role') === 'link' && item.getAttribute('aria-disabled') === 'true';
          if (title !== upcomingAulas[index]?.name || !isDisabled || item.hasAttribute('href') ||
              item.tabIndex >= 0 || item.querySelector('a, button') || getComputedStyle(item).filter !== 'grayscale(1)') {
            problems.push('Upcoming Aula has invalid name or interactive state: '+title);
          }
          if (item.scrollWidth > item.clientWidth + 2) problems.push('Upcoming Aula overflows: '+title);
        }
        const cards=[...document.querySelectorAll('.aula-grid .aula-card')];
        if (cards.length !== availableAulas.length) {
          problems.push('Aula card count differs from available Aulas: '+cards.length);
        }
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
          const expectedAula = availableAulas[i];
          if (!expectedAula) continue;
          if (card.getAttribute('href') !== expectedAula.href || card.hasAttribute('aria-disabled')) {
            problems.push('card '+i+' does not link to its available Aula');
          }
          // The emblem straddles the image/copy boundary. Test its lower half,
          // which previously disappeared behind the copy stacking context.
          const emblem=card.querySelector('.aula-icon');
          if(!emblem) problems.push('card '+i+' missing emblem');
          else {
            // elementFromPoint only hit-tests the current viewport. Scroll
            // offscreen cards into view before sampling the overlap area.
            emblem.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
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
        if (grid) {
          const columns=getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
          const expected=window.innerWidth<=680?1:window.innerWidth<=1150?2:4;
          if(columns!==expected)problems.push('grid has '+columns+' columns, expected '+expected);
        }
        return problems;
      }, { availableAulas, upcomingAulas });
      failures.push(...issues.map(issue=>width+'px '+route+': '+issue));
      if (width === 375) {
        const availableCard = page.locator('.aula-card[href]').first();
        if (await availableCard.count()) {
          await availableCard.focus();
          const hasFocusOutline = await availableCard.evaluate(card => (
            card.matches(':focus-visible') &&
            getComputedStyle(card).outlineStyle !== 'none' &&
            parseFloat(getComputedStyle(card).outlineWidth) > 0
          ));
          if (!hasFocusOutline) failures.push('375px /aulas/: available card has no visible keyboard focus indicator');
          await availableCard.blur();
        }
        const upcomingCard = page.locator('.aula-upcoming[aria-disabled="true"]').first();
        if (await upcomingCard.count()) {
          const directoryUrl = page.url();
          await upcomingCard.click({ force: true });
          if (page.url() !== directoryUrl) failures.push('375px /aulas/: upcoming card navigated when clicked');
        }
      }
      if(width===430||width===680||width===900||width===1151){
        const directory=page.locator('.aula-grid, .aula-upcoming-list').first();
        if (await directory.count()) {
          await directory.screenshot({path:'test-results/directory-'+width+'.png',timeout:10000});
        }
      }
    }
    console.log('Program announcement and Aula cards checked at '+width+'px');
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
else console.log('PASS: Program and Aula layouts at '+WIDTHS.length+' widths and '+PAGES.length+' page types.');
