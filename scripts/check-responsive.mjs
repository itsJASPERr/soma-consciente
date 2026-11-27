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
 '/encuentros/retiro-febrero-2027/',
 '/acompanamiento/',
 '/enfoque/',
 '/nucleo/',
 '/equipo/',
 '/mensajes/',
 '/politica-de-privacidad/',
 '/terminos-y-condiciones/',
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
          '.theme-toggle','.program-preview__themes li','.home-library h3',
          '.journey-hero h1','.journey-row h2','.journey-resource-list a',
          '.offering h3','.offering__action .btn','.offering__panel',
          '#programa-online-title','.program-waitlist .btn',
          '.page-hero h1','.aula-hero h1','.course-hero h1','.wa-inbox h1',
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
        const homeHero = document.querySelector('.home-hero');
        if (homeHero && homeHero.getBoundingClientRect().height < window.innerHeight - 1) {
          problems.push('homepage hero is shorter than the viewport');
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
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const pathname of ['/', '/encuentros/retiro-enero-2027/']) {
      await page.goto(HOST + BASE + pathname);
      const scrollTo = top => page.evaluate(top => window.scrollTo({ top, behavior: 'instant' }), top);
      const waitForHeader = visible => page.waitForFunction(visible => {
        const header = document.querySelector('.site-header');
        const bounds = header.getBoundingClientRect();
        const style = getComputedStyle(header);
        return visible
          ? Math.abs(bounds.top) < 1 && style.opacity === '1'
          : bounds.bottom <= 1 && style.pointerEvents === 'none';
      }, visible);
      await scrollTo(48);
      await waitForHeader(true);
      await scrollTo(380);
      await waitForHeader(false);
      await scrollTo(340);
      await waitForHeader(true);

      if (width === 375) {
        const menu = page.locator('.mobile-nav summary');
        await menu.click();
        await scrollTo(550);
        await page.waitForFunction(() => document.querySelector('.site-header').hasAttribute('data-scroll-hidden'));
        assert.equal(await menu.evaluate(summary => summary.parentElement.open), true);
        await waitForHeader(true);
        const { x, y, width, height } = await menu.boundingBox();
        await page.mouse.click(x + width / 2, y + height / 2);
        await waitForHeader(false);
      }

      await scrollTo(0);
      await waitForHeader(true);
    }
  }
  console.log('Checked header scroll behavior on mobile and desktop');

  await page.setViewportSize({width:375,height:900});
  await page.goto(HOST+BASE+'/');
  const themeToggle = page.getByRole('switch', { name: 'Modo oscuro' });
  const waitForDarkMode = checked => page.waitForFunction(checked => (
    document.querySelector('[data-theme-toggle]')?.getAttribute('aria-checked') === String(checked)
  ), checked);
  await page.emulateMedia({ colorScheme: 'dark' });
  await waitForDarkMode(true);
  const darkBackground = await page.locator('body').evaluate(body => getComputedStyle(body).backgroundColor);
  await themeToggle.press('Space');
  await waitForDarkMode(false);
  const lightBackground = await page.locator('body').evaluate(body => getComputedStyle(body).backgroundColor);
  assert.notEqual(lightBackground, darkBackground);
  await page.goto(HOST + BASE + '/biblioteca/');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  await themeToggle.click();
  await waitForDarkMode(true);
  await page.reload();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await waitForDarkMode(true);
  await page.evaluate(() => localStorage.removeItem('soma-theme'));
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(HOST + BASE + '/');

  const homeMethod = page.locator('#metodologia');
  const emblem = homeMethod.locator('.program-preview__emblem img');
  await emblem.scrollIntoViewIfNeeded();
  assert(await emblem.evaluate(async image => {
    await image.decode();
    const imageBounds = image.getBoundingClientRect();
    const holder = image.parentElement;
    const holderBounds = holder.getBoundingClientRect();
    return image.naturalWidth === 520 && image.naturalHeight === 405
      && !image.closest('.program-preview__window')
      && getComputedStyle(image).objectFit === 'contain'
      && imageBounds.left > holderBounds.left && imageBounds.top > holderBounds.top
      && imageBounds.right < holderBounds.right && imageBounds.bottom < holderBounds.bottom;
  }), 'The original SOMA logo fits inside its frame outside the landscape crop');
  const homeLibrary = page.locator('.home-library');
  assert.equal(await homeLibrary.locator('img').count(), 1);
  await homeLibrary.getByRole('link', { name: /Una pausa de presencia/ }).waitFor();
  await page.getByRole('link', { name: 'Bajar a nuestros valores' }).click();
  await page.waitForURL('**/#nuestros-valores');
  assert.equal(await page.locator('.home-hero a[href="#proximos-encuentros"]').count(), 0);
  const hasUmami = (await page.locator('script[data-website-id]').count()) === 1;
  const januaryEdition = 'retiro-enero-2027';
  const februaryEdition = 'retiro-febrero-2027';
  const februaryPath = '/encuentros/' + februaryEdition + '/';
  const januaryRequest = '/encuentros/' + januaryEdition + '/solicitud/';
  const februaryRequest = februaryPath + 'solicitud/';
  const selectedPayment = dialog => dialog.locator('input[name="payment-plan"]:checked').inputValue();
  const verifyRetreatCta = async (link, action, placement, edition) => {
    assert.equal(await link.getAttribute('data-umami-event'), hasUmami ? 'retreat_' + action + '_clicked' : null);
    assert.equal(await link.getAttribute('data-umami-event-placement'), hasUmami ? placement : null);
    assert.equal(await link.getAttribute('data-umami-event-retreat_edition'), hasUmami && edition ? edition : null);
  };
  const verifyHeaderCta = async () => {
    const cta = page.locator('.header-cta');
    assert.equal((await cta.textContent()).trim(), 'Ver encuentros ↗');
    assert.equal(await cta.getAttribute('href'), '/encuentros/');
    await verifyRetreatCta(cta, 'listing', 'site_header');
  };
  const homeCalendar = page.locator('.home-calendar');
  await verifyHeaderCta();
  const january = homeCalendar.locator('.home-calendar__event--featured');
  const february = homeCalendar.locator('.home-calendar__event').filter({ hasText: '15 y 16 de febrero de 2027' });
  await verifyRetreatCta(january.locator('h3 a'), 'details', 'home_calendar_title', januaryEdition);
  const februaryHomeLink = february.getByRole('link', { name: 'Ver el encuentro' });
  await verifyRetreatCta(februaryHomeLink, 'details', 'home_calendar_link', februaryEdition);
  assert.equal(await februaryHomeLink.getAttribute('href'), februaryPath);
  await februaryHomeLink.click();
  await page.waitForURL('**' + februaryPath);
  await page.getByText('15 y 16 de febrero de 2027', { exact: true }).waitFor();
  await page.goto(HOST + BASE + '/');
  const homeDetails = january.getByRole('link', { name: 'Ver el encuentro' });
  await verifyRetreatCta(homeDetails, 'details', 'home_calendar_link', januaryEdition);
  await homeDetails.click();
  await page.waitForURL('**/encuentros/retiro-enero-2027/');
  const retreatHero = page.locator('.retreat-hero');
  const scheduleLink = retreatHero.getByRole('link', { name: 'Ver el cronograma' });
  await verifyRetreatCta(scheduleLink, 'schedule', 'retreat_hero', januaryEdition);
  await verifyHeaderCta();
  assert.equal(await page.locator('[data-retreat-pricing]').count(), hasUmami ? 1 : 0);
  await scheduleLink.click();
  await page.waitForURL('**/encuentros/retiro-enero-2027/#cronograma');
  await page.locator('#cronograma:target').getByRole('heading', { name: 'Sábado 23' }).waitFor();
  await page.waitForFunction(() => {
    const headerHeight = document.querySelector('.site-header').offsetHeight;
    const schedule = document.querySelector('#cronograma').getBoundingClientRect();
    return schedule.top >= headerHeight - 1 && schedule.top <= headerHeight + 16;
  });
  await page.getByRole('heading', { name: 'Domingo 24' }).waitFor();
  const hasRetreatRequests = (await page.locator('form[data-retreat-edition]').count()) === 1;
  if (process.env.REQUIRE_WAITLIST_TRACKING === 'true') assert.ok(hasRetreatRequests);
  const registration = page.locator('#participar').getByRole('link', { name: 'Hacer una consulta por WhatsApp' });
  await verifyRetreatCta(registration, 'whatsapp', 'retreat_registration', januaryEdition);
  const retreatLink = new URL(await registration.getAttribute('href'));
  assert.equal(retreatLink.origin, 'https://wa.me');
  assert.match(retreatLink.searchParams.get('text'), /23 y 24 de enero/);
  if (hasRetreatRequests) {
    const originalViewport = page.viewportSize();
    await page.setViewportSize({ width: 320, height: 570 });
    const requestButton = retreatHero.getByRole('button', { name: 'Solicitar un lugar' });
    await verifyRetreatCta(requestButton, 'registration', 'retreat_hero', januaryEdition);
    await requestButton.click();
    const dialog = page.getByRole('dialog', { name: 'Solicitá tu lugar' });
    assert.equal(await selectedPayment(dialog), 'undecided');
    await page.waitForURL('**' + januaryRequest);
    const layout = await dialog.evaluate(element => {
      const body = element.querySelector('[role="region"]');
      const close = element.querySelector('button[aria-label="Cerrar"]');
      const startTop = close.getBoundingClientRect().top;
      body.scrollTop = body.scrollHeight;
      return {
        scrolled: body.scrollTop > 0,
        headerStayed: Math.abs(close.getBoundingClientRect().top - startTop) < 1,
        modalClips: getComputedStyle(element).overflow === 'hidden',
        scrollbarHidden: getComputedStyle(body).scrollbarWidth === 'none',
        fitsWidth: body.scrollWidth <= body.clientWidth,
      };
    });
    assert.deepEqual(layout, { scrolled: true, headerStayed: true, modalClips: true, scrollbarHidden: true, fitsWidth: true });
    await page.waitForFunction(() => !document.querySelector('dialog[open]').getAnimations().length);
    const closing = await dialog.evaluate(element => {
      element.querySelector('button[aria-label="Cerrar"]').click();
      return element.open && element.hasAttribute('data-closing') &&
        element.getAnimations().some(animation => animation.transitionProperty === 'opacity');
    });
    assert.ok(closing, 'Close should leave the dialog open for its opacity transition');
    await dialog.waitFor({ state: 'hidden' });
    await page.waitForURL('**/encuentros/' + januaryEdition + '/#cronograma');
    await page.setViewportSize(originalViewport);
  }
  const pricing = page.locator('#inversion');
  await retreatHero.getByText('Casa Sabia · Huerta Grande, Córdoba', { exact: true }).waitFor();
  for (const [label, id, amount, total] of [
    ['Pago único', 'single', '$610.000', null],
    ['2 pagos', '2_payments', '2 × $330.000', 'Total $660.000'],
    ['3 pagos', '3_payments', '3 × $230.000', 'Total $690.000'],
    ['4 pagos', '4_payments', '4 × $185.000', 'Total $740.000'],
  ]) {
    const plan = pricing.getByRole('article', { name: label, exact: true });
    await plan.getByText(amount, { exact: true }).waitFor();
    if (total) await plan.getByText(total, { exact: true }).waitFor();
    if (!hasRetreatRequests) continue;
    const cta = plan.getByRole('button', { name: 'Elegir este plan · ' + label, exact: true });
    await verifyRetreatCta(cta, 'registration', 'retreat_pricing', januaryEdition);
    assert.equal(await cta.getAttribute('data-umami-event-payment_plan'), hasUmami ? id : null);
    assert.equal(await cta.getAttribute('data-payment-plan'), id);
  }
  if (hasRetreatRequests) {
    const trackerEvents = () => page.evaluate(() => window.retreatRequestEvents);
    await page.evaluate(() => {
      window.retreatRequestEvents = [];
      window.umami = { track: (...args) => window.retreatRequestEvents.push(args) };
    });
    const submissions = [];
    const reference = 'SOMA-111122223333';
    const endpoint = '**/api/waitlist';
    await page.route(endpoint, async route => {
      submissions.push(route.request().postDataJSON());
      const status = [503, 201, 200][submissions.length - 1];
      await route.fulfill({ status, json: status === 503 ? { error: 'unavailable' } : { reference, paymentPlan: '2_payments', rebates: ['with_friend', 'own_tent'] } });
    });

    const plan = pricing.getByRole('button', { name: 'Elegir este plan · 2 pagos' });
    const openRequest = async () => {
      await plan.click();
      const dialog = page.getByRole('dialog', { name: 'Solicitá tu lugar' });
      await dialog.getByText(/23 y 24 de enero/).waitFor();
      assert.equal(await selectedPayment(dialog), '2_payments');
      assert.equal(await dialog.getByRole('radio', { name: 'WhatsApp' }).isChecked(), true);
      await dialog.getByLabel('Tu nombre').fill('Persona de prueba');
      await dialog.getByRole('radio', { name: 'Correo electrónico' }).check();
      await dialog.getByLabel('Tu correo electrónico').fill('retreat-test@example.com');
      await dialog.getByRole('checkbox', { name: /10% de descuento/ }).check();
      await dialog.getByRole('checkbox', { name: /50.000 de descuento/ }).check();
      const legal = dialog.locator('#retreat-request-legal');
      assert.equal(await legal.getByRole('link', { name: 'Términos y condiciones' }).getAttribute('href'), '/terminos-y-condiciones/');
      assert.equal(await legal.getByRole('link', { name: 'Política de privacidad' }).getAttribute('href'), '/politica-de-privacidad/');
      const send = dialog.getByRole('button', { name: 'Enviar solicitud' });
      assert.equal(await send.isDisabled(), true);
      await dialog.getByRole('checkbox', { name: /Acepto que SOMA/ }).check();
      await send.click();
      return dialog;
    };

    const dialog = await openRequest();
    await dialog.getByText('No pudimos guardar tu solicitud.', { exact: false }).waitFor();
    assert.deepEqual(await trackerEvents(), []);
    await dialog.getByRole('button', { name: 'Enviar solicitud' }).click();
    const receipt = page.getByRole('dialog', { name: 'Recibimos tu solicitud' });
    await receipt.getByText(reference, { exact: true }).waitFor();
    await page.waitForURL('**' + januaryRequest + 'recibida/');
    assert.equal(await receipt.getByRole('button', { name: 'Enviar solicitud' }).count(), 0);
    await receipt.getByText(/te va a contactar por correo electrónico/).waitFor();
    const handoff = receipt.getByRole('link', { name: 'Continuar por WhatsApp' });
    await verifyRetreatCta(handoff, 'whatsapp', 'retreat_confirmation', januaryEdition);
    const prepared = new URL(await handoff.getAttribute('href'));
    assert.equal(prepared.origin, retreatLink.origin);
    assert.equal(prepared.pathname, retreatLink.pathname);
    const message = prepared.searchParams.get('text');
    for (const detail of [reference, '23 y 24 de enero', '2 cuotas de $330.000', '10% de descuento', '$50.000 de descuento']) assert.ok(message.includes(detail));
    assert.ok(!message.includes('retreat-test@example.com'));
    assert.equal(submissions[1].offering, 'encuentro-enero');
    assert.equal(submissions[1].paymentPlan, '2_payments');
    assert.deepEqual(submissions[1].rebates, ['with_friend', 'own_tent']);
    const expectedEvents = hasUmami
      ? [['retreat_request_submitted', { channel: 'email', retreat_edition: januaryEdition, payment_plan: '2_payments' }]]
      : [];
    assert.deepEqual(await trackerEvents(), expectedEvents);
    await receipt.getByRole('button', { name: 'Cerrar' }).click();
    await receipt.waitFor({ state: 'hidden' });

    await openRequest();
    await receipt.getByText(reference, { exact: true }).waitFor();
    assert.deepEqual(await trackerEvents(), expectedEvents);
    await page.reload();
    await receipt.getByText(reference, { exact: true }).waitFor();
    await page.goBack();
    await receipt.waitFor({ state: 'hidden' });
    await page.waitForURL('**/encuentros/' + januaryEdition + '/#cronograma');
    await page.unroute(endpoint);
  }
  for (const text of [
    'Dos días de retiro.',
    'Todas las comidas y bebidas.',
    'Una noche de alojamiento en las habitaciones de Casa Sabia.',
    'Cuatro encuentros grupales de integración online después del retiro.',
    '10% de descuento',
    '$50.000 de descuento',
  ]) {
    await pricing.getByText(text, { exact: true }).waitFor();
  }
  await page.goto(HOST+BASE+'/encuentros/');
  const encounter = page.locator('article#encuentro-enero');
  const eventCard = encounter.locator('.event-card--featured');
  const eventPhoto = eventCard.getByRole('img', { name: /caballos en un claro del bosque/ });
  await eventPhoto.scrollIntoViewIfNeeded();
  await eventPhoto.evaluate(image => image.decode());
  const cardDetails = eventCard.getByRole('link', { name: 'Ver programa y precios' });
  await verifyRetreatCta(cardDetails, 'details', 'event_card_details', januaryEdition);
  await cardDetails.click();
  await page.waitForURL('**/encuentros/retiro-enero-2027/');
  await page.goto(HOST+BASE+'/encuentros/');
  await eventCard.getByRole('heading', { name: 'Qué incluye' }).waitFor();
  await eventCard.getByText('Casa Sabia · Huerta Grande, Córdoba', { exact: true }).waitFor();
  const cardRegistration = eventCard.getByRole('link', { name: hasRetreatRequests ? 'Solicitar un lugar' : 'Solicitar inscripción' });
  await verifyRetreatCta(cardRegistration, hasRetreatRequests ? 'registration' : 'whatsapp', 'event_card_registration', januaryEdition);
  await verifyHeaderCta();
  const encounterLink = retreatLink;
  assert.equal(await cardRegistration.getAttribute('href'), hasRetreatRequests ? januaryRequest : encounterLink.href);
  const doorLink = new URL(await page.locator('article#puerta-abierta').getByRole('link', { name: 'Avisame la fecha' }).getAttribute('href'));
  assert.equal(doorLink.pathname, encounterLink.pathname);
  assert.match(doorLink.searchParams.get('text'), /Puerta Abierta/);
  const februaryCard = encounter.locator('#encuentro-febrero');
  const februaryDetails = februaryCard.getByRole('link', { name: 'Ver programa y precios' });
  const februaryRegistration = februaryCard.getByRole('link', { name: hasRetreatRequests ? 'Solicitar un lugar' : 'Solicitar inscripción' });
  await verifyRetreatCta(februaryDetails, 'details', 'event_card_details', februaryEdition);
  await verifyRetreatCta(februaryRegistration, hasRetreatRequests ? 'registration' : 'whatsapp', 'event_card_registration', februaryEdition);
  const februaryRegistrationUrl = await februaryRegistration.getAttribute('href');
  if (hasRetreatRequests) assert.equal(februaryRegistrationUrl, februaryRequest);
  await februaryDetails.click();
  await page.waitForURL('**' + februaryPath);
  await page.getByRole('heading', { name: 'Lunes 15' }).waitFor();
  await page.getByRole('heading', { name: 'Martes 16' }).waitFor();
  const februaryJoin = page.locator('#participar').getByRole('link', { name: 'Hacer una consulta por WhatsApp' });
  await verifyRetreatCta(februaryJoin, 'whatsapp', 'retreat_registration', februaryEdition);
  const februaryWhatsapp = new URL(await februaryJoin.getAttribute('href'));
  assert.equal(februaryWhatsapp.pathname, encounterLink.pathname);
  assert.match(februaryWhatsapp.searchParams.get('text'), /15 y 16 de febrero/);
  if (!hasRetreatRequests) assert.equal(februaryWhatsapp.href, februaryRegistrationUrl);
  const februaryPricing = page.locator('.retreat-plan__action');
  assert.equal(await februaryPricing.count(), hasRetreatRequests ? 4 : 0);
  await page.locator('#inversion').getByText('$610.000', { exact: true }).waitFor();
  await page.locator('#inversion').getByText('Total $740.000', { exact: true }).waitFor();
  if (hasRetreatRequests) {
    await page.goto(HOST + februaryRequest + 'recibida/');
    await page.waitForURL('**' + februaryRequest);
    const dialog = page.getByRole('dialog', { name: 'Solicitá tu lugar' });
    await dialog.getByText(/15 y 16 de febrero/).waitFor();
    assert.equal(await selectedPayment(dialog), 'undecided');
    await dialog.getByRole('button', { name: 'Cerrar' }).click();
  }
  await page.goto(HOST + BASE + '/encuentros/');
  await eventCard.getByRole('link', { name: 'Conocer los círculos' }).click();
  assert.equal(new URL(page.url()).hash, '#circulos');
  await verifyRetreatCta(page.getByRole('link', { name: 'Ver fechas del retiro' }), 'listing', 'integration_page');
  await page.getByText('Una vez por semana', { exact: true }).waitFor();
  assert.equal(await page.getByText('ARS 20.000 por mes', { exact: true }).count(), 0);
  const circleCta = page.getByRole('link', { name: 'Quiero participar' });
  assert.equal(await circleCta.getAttribute('data-umami-event'), null);
  const circleLink = new URL(await circleCta.getAttribute('href'));
  assert.equal(circleLink.pathname, encounterLink.pathname);
  assert.match(circleLink.searchParams.get('text'), /círculo semanal/);
  const mobileMenu = page.locator('.mobile-nav');
  await mobileMenu.locator('summary').click();
  await mobileMenu.getByRole('link', { name: 'Comunidad', exact: true }).click();
  await page.waitForURL('**/acompanamiento/#grupo-whatsapp');
  await mobileMenu.locator('nav').waitFor({ state: 'hidden' });
  const groupLink = new URL(await page.getByRole('link', { name: 'Unirme al grupo' }).getAttribute('href'));
  assert.equal(groupLink.origin, 'https://chat.whatsapp.com');
  const teamMembers = [
    ['Nicole Rosignoli Miranda', 'Nicole', 'nicole'],
    ['Yanina Noelia Landriel', 'Yanina', 'yanina'],
    ['Nico Pacha', 'Nico Pacha', 'nico-pacha'],
    ['Jasper Meyer', 'Jasper', 'jasper'],
  ];
  await page.goto(HOST+BASE+'/encuentros/retiro-enero-2027/');
  const retreatTeam = page.getByRole('region', { name: 'Quiénes te acompañan.' });
  for (const [name, , id] of teamMembers) {
    assert.equal(await retreatTeam.getByRole('link', { name }).getAttribute('href'), '/equipo/#' + id);
  }
  await retreatTeam.getByRole('link', { name: 'Nicole Rosignoli Miranda' }).click();
  await page.waitForURL('**/equipo/#nicole');
  await page.locator('#nicole:target').getByRole('heading', { name: 'Nicole Rosignoli Miranda' }).waitFor();
  const teamIndex = page.getByRole('navigation', { name: 'Integrantes de SOMA' });
  for (const [name, shortName, id] of teamMembers) {
    await teamIndex.getByRole('link', { name: shortName, exact: true }).click();
    await page.waitForURL('**/equipo/#' + id);
    await page.locator('#' + id + ':target').getByRole('heading', { name }).waitFor();
  }
  const teamRetreat = page.getByRole('link', { name: 'Conocé el retiro' });
  await verifyHeaderCta();
  await verifyRetreatCta(teamRetreat, 'details', 'team_footer', januaryEdition);
  await teamRetreat.click();
  await page.waitForURL('**/encuentros/retiro-enero-2027/');

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
