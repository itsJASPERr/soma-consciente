import assert from 'node:assert/strict';

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
  let submissions = 0;
  await page.route(endpoint, async route => {
    assert.equal(route.request().method(), 'POST');
    assert.equal(route.request().postDataJSON().offering, 'circulos');
    submissions += 1;
    await route.fulfill({ status: submissions === 1 ? 503 : 204 });
  });

  await page.goto(new URL('/', baseURL).href, { waitUntil: 'load' });
  const form = page.locator('#program-launch-form[data-collect="true"]');
  if (!(await form.count())) {
    assert.ok(!required, 'The deployment is configured to collect signups but the built waitlist is missing.');
    return;
  }

  const events = () => page.evaluate(() => window.waitlistTestEvents);
  const opened = { event: 'waitlist_opened' };
  assert.deepEqual(await events(), []);
  const otherOffering = page.locator('button[data-offering-signup="encuentro-enero"]');
  if (await otherOffering.count()) {
    await otherOffering.click();
    assert.deepEqual(await events(), [], 'The in-person offering must stay outside the online funnel.');
    await page.getByRole('button', { name: 'Cerrar' }).click();
    await form.waitFor({ state: 'hidden' });
  }
  await page.locator('button[data-offering-signup="circulos"]').click();
  assert.deepEqual(await events(), [opened]);

  await form.getByRole('radio', { name: 'Correo electrónico' }).check();
  await form.getByLabel('Tu correo electrónico').fill('prueba@example.com');
  await form.getByLabel('Tu nombre').fill('Participante de prueba');
  await form.getByRole('checkbox').check();
  const submit = form.getByRole('button', { name: 'Enviar solicitud' });

  await submit.click();
  await page.getByText('No pudimos guardar tu solicitud.').waitFor();
  assert.equal(submissions, 1);
  assert.deepEqual(await events(), [opened], 'A failed submission must not record a conversion.');

  await submit.click();
  await page.getByText('Recibimos tu solicitud. Te contactaremos por el medio que elegiste.').waitFor();
  assert.equal(submissions, 2);
  assert.deepEqual(await events(), [
    opened,
    { event: 'waitlist_submitted', properties: { channel: 'email' } },
  ]);
  console.log('Waitlist analytics verified with intercepted failure and success responses.');
}
