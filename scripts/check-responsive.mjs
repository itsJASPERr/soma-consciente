/**
 * Browser-level regression audit.
 * Catches horizontal overflow and clipped headings at mobile, tablet and
 * desktop widths. Runs against built Astro preview, using GitHub runner's Chrome.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { checkWaitlistTracking } from './check-waitlist-tracking.mjs';

const HOST='http://127.0.0.1:4321';
const BASE='';
const paths=[
 '/',
 '/encuentros/',
 '/encuentros/retiro-enero-2027/',
 '/acompanamiento/',
 '/enfoque/',
 '/nucleo/',
 '/equipo/',
 '/biblioteca/',
 '/biblioteca/pausa-de-presencia/',
 '/aulas/',
 '/aulas/jasper/',
 '/aulas/jasper/musica-medicina/',
 '/aulas/jasper/musica-medicina/escuchar/que-es-la-musica/'
];
const widths=[320,375,480,768,1024,1440];
const server=spawn('./node_modules/.bin/astro',['preview','--host','127.0.0.1','--port','4321'],{stdio:['ignore','pipe','pipe'],env:process.env});
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
          '.home-hero h1','.home-calendar h3','.home-calendar .journey-link',
          '.home-active h2',
          '.journey-hero h1','.journey-row h2','.journey-resource-list a',
          '.offering h3','.offering__action .btn','.offering__panel',
          '#programa-online-title','.program-waitlist .btn',
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
        const feature = document.querySelector('.participation-feature');
        if (feature && viewport <= 680) {
          const photo = document.querySelector('.participation-hero__frame');
          const details = feature.querySelectorAll('.participation-feature__date, .participation-feature__venue, .participation-feature__included, .btn');
          if (photo && Array.from(details).some(node => node.getBoundingClientRect().bottom > photo.getBoundingClientRect().top + 1)) {
            problems.push('the January date, venue, included circles and CTA must appear before the photo on mobile');
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
      await page.evaluate(() => window.scrollTo(0, 48));
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
  await page.setViewportSize({width:375,height:900});
  await page.goto(HOST+BASE+'/');
  await page.locator('.home-calendar').getByRole('link', { name: 'Ver el encuentro' }).click();
  await page.waitForURL('**/encuentros/retiro-enero-2027/');
  const retreatHero = page.locator('.retreat-hero');
  const scheduleLink = retreatHero.getByRole('link', { name: 'Ver el cronograma' });
  const hasUmami = (await page.locator('script[data-website-id]').count()) === 1;
  assert.equal(await scheduleLink.getAttribute('data-umami-event'), hasUmami ? 'retreat_schedule_clicked' : null);
  assert.equal(await page.locator('[data-retreat-pricing]').count(), hasUmami ? 1 : 0);
  await scheduleLink.click();
  await page.waitForURL('**/encuentros/retiro-enero-2027/#cronograma');
  await page.locator('#cronograma:target').getByRole('heading', { name: 'Sábado 23' }).waitFor();
  await page.getByRole('heading', { name: 'Domingo 24' }).waitFor();
  await retreatHero.getByRole('link', { name: 'Consultar por un lugar' }).click();
  await page.waitForURL('**/encuentros/retiro-enero-2027/#participar');
  const registration = page.locator('#participar:target').getByRole('link', { name: 'Solicitar inscripción' });
  assert.equal(await registration.getAttribute('data-umami-event'), hasUmami ? 'retreat_whatsapp_clicked' : null);
  const retreatLink = new URL(await registration.getAttribute('href'));
  assert.equal(retreatLink.origin, 'https://wa.me');
  assert.match(retreatLink.searchParams.get('text'), /23 y 24 de enero/);
  await page.locator('#inversion').getByText('ARS 450.000', { exact: true }).waitFor();
  await page.locator('#inversion').getByText('2 × ARS 250.000', { exact: true }).waitFor();
  await page.locator('#inversion').getByText('ARS 50.000', { exact: true }).waitFor();
  await page.locator('#inversion').getByText('10%', { exact: true }).waitFor();
  await page.goto(HOST+BASE+'/encuentros/');
  const encounter = page.locator('article#encuentro-enero');
  await encounter.getByRole('heading', { name: 'Qué incluye' }).waitFor();
  await encounter.getByText(/Si hay lugar, el equipo te confirma/).waitFor();
  const encounterLink = new URL(await encounter.getByRole('link', { name: 'Solicitar inscripción' }).getAttribute('href'));
  assert.equal(encounterLink.origin, 'https://wa.me');
  assert.match(encounterLink.searchParams.get('text'), /23 y 24 de enero/);
  const doorLink = new URL(await page.locator('article#puerta-abierta').getByRole('link', { name: 'Avisame la fecha' }).getAttribute('href'));
  assert.equal(doorLink.pathname, encounterLink.pathname);
  assert.match(doorLink.searchParams.get('text'), /Puerta Abierta/);
  await encounter.getByRole('link', { name: 'Conocer los círculos' }).click();
  assert.equal(new URL(page.url()).hash, '#circulos');
  const circleLink = new URL(await page.getByRole('link', { name: 'Quiero participar' }).getAttribute('href'));
  assert.equal(circleLink.pathname, encounterLink.pathname);
  assert.match(circleLink.searchParams.get('text'), /círculo semanal/);
  const groupLink = new URL(await page.getByRole('link', { name: 'Unirme al grupo' }).getAttribute('href'));
  assert.equal(groupLink.origin, 'https://chat.whatsapp.com');
  await page.goto(HOST+BASE+'/enfoque/');
  const content = page.locator('main');
  await content.getByRole('link', { name: 'Ir a la Biblioteca' }).click();
  await page.waitForURL('**/biblioteca/');
  await content.getByRole('link', { name: 'Leer práctica: Una pausa de presencia', exact: true }).click();
  await page.waitForURL('**/biblioteca/pausa-de-presencia/');
  await content.getByRole('heading', { name: 'Detenerse' }).waitFor();
  await content.getByRole('link', { name: 'Volver a la Biblioteca' }).click();
  await page.waitForURL('**/biblioteca/');

  await page.goto(HOST+BASE+'/nucleo/');
  await content.getByRole('link', { name: 'Conocer al equipo' }).click();
  await page.waitForURL('**/equipo/');
  await content.getByRole('heading', { name: 'Nicole Rosignoli Miranda' }).waitFor();
  await content.getByRole('link', { name: 'Descubrir el Núcleo' }).click();
  await content.getByRole('link', { name: 'Conocer las Aulas' }).click();
  await page.waitForURL('**/aulas/');
  await content.getByRole('link', { name: 'Ir a la Biblioteca' }).waitFor();
  await checkWaitlistTracking(page, HOST+BASE, {
    required: process.env.REQUIRE_WAITLIST_TRACKING === 'true',
  });
} catch(e){
  errors.push('Test execution failed: '+(e?.stack||String(e)));
} finally {
  if(browser) await browser.close().catch(()=>{});
  // Stop Astro and close its output pipes so the CI job can exit.
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
