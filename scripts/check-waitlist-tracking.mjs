import assert from 'node:assert/strict';
import { waitlistConsentVersion } from '../src/lib/waitlist-consent.ts';

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
  await form.getByText(/guarde mis datos y me contacte por este canal/).waitFor();
  assert.deepEqual(await events(), [opened]);
  await form.getByRole('radio', { name: 'Email' }).check();
  await form.getByRole('textbox', { name: 'Email' }).fill('prueba@example.com');
  await form.getByLabel('Nombre').fill('Participante de prueba');
  assert.ok(await submit.isDisabled());
  await form.getByRole('checkbox').check();

  await submit.click();
  await page.getByText('No pudimos guardar tu solicitud.').waitFor();
  assert.equal(programSubmissions, 1);
  assert.deepEqual(await events(), [opened], 'A failed submission must not record a conversion.');

  await submit.click();
  await page.getByText('Gracias. Te avisaremos por el medio que elegiste.').waitFor();
  assert.equal(programSubmissions, 2);
  assert.deepEqual(await events(), [
    opened,
    { event: 'waitlist_submitted', properties: { channel: 'email' } },
  ]);
  console.log('Program waitlist consent, payload and analytics verified.');
}
