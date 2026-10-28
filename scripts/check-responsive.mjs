/**
 * Browser-level regression audit.
 * Catches horizontal overflow and clipped headings at mobile, tablet and
 * desktop widths. Runs against built Astro preview, using GitHub runner's Chrome.
 */
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const HOST='http://127.0.0.1:4321';
const BASE='';
const paths=[
 '/',
 '/aulas/jasper/',
 '/aulas/jasper/musica-medicina/',
 '/aulas/jasper/musica-medicina/escuchar/que-es-la-musica/'
];
const widths=[320,375,480,768,1024];
const server=spawn('npm',['run','preview','--','--host','127.0.0.1','--port','4321'],{stdio:['ignore','pipe','pipe'],env:process.env});
let output='';
for(const stream of [server.stdout,server.stderr]) stream.on('data',d=>{output+=String(d).slice(-4000);});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let browser=null;
const errors=[];
try{
  let ready=false;
  for(let i=0;i<70;i++){
    if(server.exitCode!==null) throw new Error('Astro preview exited: '+output);
    try { const r=await fetch(HOST+BASE+'/'); if(r.ok) {ready=true;break;} }
    catch {}
    await sleep(200);
  }
  if(!ready) throw new Error('Astro preview did not start: '+output);
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:375,height:900},deviceScaleFactor:1});
  // Local static-site layout audit: disallow third-party requests so external font
  // CDNs cannot stall navigation. Browser uses deterministic serif/sans fallback.
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if(url.hostname==='127.0.0.1') return route.continue();
    return route.abort();
  });
  await mkdir('test-results',{recursive:true});
  for(const width of widths){
    await page.setViewportSize({width,height:900});
    for(const pathname of paths){
      const pageUrl=HOST+BASE+pathname;
      const response=await page.goto(pageUrl,{waitUntil:'load',timeout:12000});
      if(!response?.ok()) {errors.push(width+' '+pathname+' response '+response?.status());continue;}
      await page.evaluate(()=>Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,60))]));
      const m=await page.evaluate(()=>{
        const viewport=document.documentElement.clientWidth;
        const items=[];
        const interesting=[
          '.site-header .brand',
          '.site-header .mobile-nav summary',
          '.hero h1','.hero h1 span','.hero-copy','.hero .btn-row .btn',
          '.page-hero h1','.aula-hero h1','.course-hero h1',
          '.lesson-heading h1','.lesson-mobile-outline summary',
          '.section-head h2','.course-outline__heading-copy strong'
        ];
        const problems=[];
        for(const selector of interesting){
          const found=Array.from(document.querySelectorAll(selector));
          for(const [i,el] of found.entries()){
            const style=getComputedStyle(el);
            if(style.display==='none'||style.visibility==='hidden') continue;
            const rect=el.getBoundingClientRect();
            if(!rect.width || !rect.height) continue;
            if(rect.left < -2 || rect.right > viewport+2){
              problems.push(selector+'['+i+'] bounds='+rect.left.toFixed(0)+'..'+rect.right.toFixed(0));
            }
            if(el.clientWidth>0 && el.scrollWidth>el.clientWidth+3){
              problems.push(selector+'['+i+'] content='+el.scrollWidth+'/'+el.clientWidth);
            }
          }
        }
        const menu=document.querySelector('.site-header .mobile-nav summary');
        const brand=document.querySelector('.site-header .brand');
        const cta=document.querySelector('.site-header .header-cta');
        const menuVisible=menu&&getComputedStyle(menu).display!=='none'&&
          getComputedStyle(menu.closest('.mobile-nav')).display!=='none';
        if(viewport<=1150){
          if(!menuVisible) problems.push('mobile menu is hidden');
          if(cta&&getComputedStyle(cta).display!=='none') problems.push('desktop CTA visible on mobile');
          if(menuVisible&&brand&&brand.getBoundingClientRect().right>menu.getBoundingClientRect().left-2)
            problems.push('header brand/menu collision');
        }
        const rootWidth=document.documentElement.scrollWidth;
        const bodyWidth=document.body.scrollWidth;
        if(rootWidth>viewport+2 || bodyWidth>viewport+2){
          const culprits=Array.from(document.querySelectorAll('body *')).filter(e=>{
            const cs=getComputedStyle(e);
            if(cs.position==='absolute'||cs.position==='fixed'||cs.display==='none') return false;
            const r=e.getBoundingClientRect();return r.width>0&&(r.left < -2 || r.right > viewport+2);
          }).slice(0,8).map(e=>e.tagName.toLowerCase()+'.'+e.className.toString().split(' ').join('.'));
          problems.push('page overflows viewport: document='+rootWidth+', body='+bodyWidth+', viewport='+viewport+', nodes='+culprits.join(' | '));
        }
        return { viewport,problems };
      });
      if(m.problems.length) errors.push(width+' '+pathname+' :: '+m.problems.join(' ; '));
      if(width===375 && pathname==='/') await page.screenshot({path:'test-results/home-375.png',fullPage:true});
      if(width===375 && pathname==='/aulas/jasper/') await page.screenshot({path:'test-results/aula-375.png',fullPage:true});
      if(width===375 && pathname==='/aulas/jasper/musica-medicina/escuchar/que-es-la-musica/') await page.screenshot({path:'test-results/lesson-375.png',fullPage:true});
    }
    if(width<=1150){
      await page.goto(HOST+BASE+'/',{waitUntil:'load'});
      await page.locator('.mobile-nav summary').click();
      const nav=page.locator('.mobile-nav nav');
      if(!await nav.isVisible()) errors.push(width+' hamburger menu does not open');
      const bounds=await nav.boundingBox();
      if(bounds && (bounds.x < -2 || bounds.x+bounds.width > width+2))
        errors.push(width+' menu off screen: '+JSON.stringify(bounds));
      await page.locator('.mobile-nav summary').click();
    }
    console.log('Checked '+width+'px across '+paths.length+' pages');
  }
} catch(e){
  errors.push('Test execution failed: '+(e?.stack||String(e)));
} finally {
  if(browser) await browser.close().catch(()=>{});
  // Kill the npm wrapper AND close its inherited stdio pipes. Otherwise
  // the CI job can remain running after Chromium has completed.
  server.kill('SIGKILL');
  server.stdout?.destroy();
  server.stderr?.destroy();
}
if(errors.length){
  console.error('RESPONSIVE AUDIT FAILED ('+errors.length+' issues):\n'+errors.join('\n'));
  process.exitCode=1;
  process.exit(1);
}else{
  console.log('Responsive audit PASSED: '+(widths.length*paths.length)+' page/viewport combinations.');
  process.exit(0);
}
