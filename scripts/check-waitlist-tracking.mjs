import assert from 'node:assert/strict';
import { waitlistConsentText, waitlistConsentVersion } from '../src/lib/waitlist-consent.ts';

export async function checkWaitlistTracking(page, baseURL, { required }) {
  await page.addInitScript(() => {
    window.waitlistTestEvents = [];
    window.umami = {
      track(event, properties) {
        window.waitlistTestEvents.push(properties ? { event, properties } : { event });
      },
    };
  });

  const endpoint = new URL('/api/waitlist', baseURL).href;
  let programSubmissions = 0;
  await page.route(endpoint, async route => {
    assert.equal(route.request().method(), 'POST');
    const payload = route.request().postDataJSON();
    assert.equal(payload.offering, undefined);
    assert.equal(payload.consent, waitlistConsentVersion);
    programSubmissions += 1;
    await route.fulfill({ status: programSubmissions === 1 ? 503 : 204 });
  });

  await page.goto(new URL('/', baseURL).href, { waitUntil: 'load' });
  const form = page.locator('#program-launch-form[data-collect="true"]');
  if (!(await form.count())) {
    assert.ok(!required, 'The deployment is configured to collect signups but the built waitlist is missing.');
    return;
  }

  const events = () => page.evaluate(() => window.waitlistTestEvents);
  const opened = { event: 'waitlist_opened' };
  const submit = form.getByRole('button', { name: 'Avisame cuando esté listo' });
  const opener = page.locator('#programa-online #program-launch-open');
  const pagePosition = () => opener.evaluate(button => {
    const { top, left } = button.closest('#programa-online').getBoundingClientRect();
    return { scrollY: window.scrollY, width: document.body.clientWidth, top, left };
  });
  const positionOpener = async () => {
    await opener.evaluate(button => button.scrollIntoView({ block: 'center', behavior: 'instant' }));
    return pagePosition();
  };
  const assertFocus = id => page.waitForFunction(target => document.activeElement?.id === target, id);
  assert.deepEqual(await events(), []);
  const mobilePosition = await positionOpener();
  await opener.click();
  await form.getByText(waitlistConsentText, { exact: true }).waitFor();
  const dialog = page.getByRole('dialog', { name: 'Nuestro programa online' });
  await dialog.waitFor();
  await assertFocus('program-launch-title');
  assert.deepEqual(await pagePosition(), mobilePosition, 'Opening the sheet must leave the page in place.');
  const sheet = await dialog.boundingBox();
  assert.ok(sheet.y + sheet.height >= page.viewportSize().height - 14, 'The mobile program overlay should align to the bottom.');
  assert.ok(await form.getByRole('radio', { name: 'WhatsApp' }).isChecked());
  const country = form.getByRole('button', { name: 'Código de país, Argentina (+54)' });
  await country.click();
  const countrySearch = form.getByRole('combobox', { name: 'Buscar país o prefijo' });
  await countrySearch.fill('uruguay');
  assert.equal(await form.getByRole('option').filter({ visible: true }).count(), 1);
  await countrySearch.press('Enter');
  assert.ok(await form.getByRole('button', { name: 'Código de país, Uruguay (+598)' }).isVisible());
  await form.getByRole('checkbox').check();
  assert.ok(await submit.isDisabled(), 'Consent alone must not enable the empty form.');
  assert.deepEqual(await events(), [opened]);
  await form.getByRole('radio', { name: 'Correo electrónico' }).check();
  await form.getByLabel('Tu correo electrónico').fill('prueba@example.com');
  await form.getByLabel('Tu nombre').fill('Participante de prueba');
  assert.ok(await submit.isDisabled());
  await form.getByRole('checkbox').check();

  await submit.click();
  await dialog.getByRole('status').filter({ hasText: 'No pudimos guardar tu solicitud.' }).waitFor();
  assert.equal(await dialog.locator('#program-launch-result').getAttribute('data-state'), 'error');
  assert.equal(programSubmissions, 1);
  assert.deepEqual(await events(), [opened], 'A failed submission must not record a conversion.');

  await submit.click();
  await dialog.getByRole('status').filter({ hasText: 'Gracias. Te avisaremos por el medio que elegiste.' }).waitFor();
  assert.equal(await dialog.locator('#program-launch-result').getAttribute('data-state'), 'success');
  assert.equal(programSubmissions, 2);
  assert.deepEqual(await events(), [
    opened,
    { event: 'waitlist_submitted', properties: { channel: 'email' } },
  ]);
  await dialog.getByRole('button', { name: 'Cerrar' }).click();
  await dialog.waitFor({ state: 'hidden' });
  await assertFocus('program-launch-open');
  assert.deepEqual(await pagePosition(), mobilePosition, 'Closing the sheet must preserve the scroll position.');
  await page.setViewportSize({ width: 1440, height: 900 });
  const desktopPosition = await positionOpener();
  await opener.click();
  await dialog.waitFor();
  assert.deepEqual(await pagePosition(), desktopPosition, 'Opening the desktop dialog must leave the page in place.');
  const desktopSheet = await dialog.boundingBox();
  const viewport = page.viewportSize();
  const center = desktopSheet.x + desktopSheet.width / 2;
  assert.ok(Math.abs(center - viewport.width / 2) < 80, 'The desktop program overlay should sit in the center.');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  await assertFocus('program-launch-open');
  assert.deepEqual(await pagePosition(), desktopPosition, 'Closing with Escape must preserve the scroll position.');
  console.log('Program waitlist position, focus, consent, payload and analytics verified.');
}
