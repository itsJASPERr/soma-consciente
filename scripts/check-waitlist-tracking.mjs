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
  assert.deepEqual(await events(), []);
  await page.locator('#programa-online #program-launch-open').click();
  await form.getByText(waitlistConsentText, { exact: true }).waitFor();
  const dialog = page.getByRole('dialog', { name: 'Nuestro programa online' });
  await dialog.waitFor();
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
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('#program-launch-open').click();
  const desktopSheet = await dialog.boundingBox();
  const methodologyTitle = await page.locator('#metodologia-title').boundingBox();
  assert.ok(methodologyTitle.y >= 0 && methodologyTitle.y < desktopSheet.y, 'The methodology heading should stay in view behind the overlay.');
  assert.ok(desktopSheet.x > 720, 'The desktop program overlay should align to the side.');
  await dialog.getByRole('button', { name: 'Cerrar' }).click();
  console.log('Program waitlist overlay, consent, payload and analytics verified.');
}
