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
  let circleSubmissions = 0;
  let programSubmissions = 0;
  await page.route(endpoint, async route => {
    assert.equal(route.request().method(), 'POST');
    const payload = route.request().postDataJSON();
    if (payload.offering === 'circulos') {
      assert.equal(payload.consent, 'offering-1');
      circleSubmissions += 1;
      await route.fulfill({ status: 204 });
      return;
    }
    assert.equal(payload.offering, undefined);
    assert.equal(payload.consent, '2');
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
  const submit = form.getByRole('button', { name: 'Enviar solicitud' });
  const fillEmailContact = async () => {
    await form.getByRole('radio', { name: 'Correo electrónico' }).check();
    await form.getByLabel('Tu correo electrónico').fill('prueba@example.com');
    await form.getByLabel('Tu nombre').fill('Participante de prueba');
    assert.ok(await submit.isDisabled());
    await form.getByRole('checkbox').check();
  };

  assert.deepEqual(await events(), []);
  await page.locator('#circulos button[data-offering-signup="circulos"]').click();
  await form.getByText(/para responder a esta solicitud/).waitFor();
  await fillEmailContact();
  await submit.click();
  await page.getByText('Recibimos tu solicitud. Te enviaremos los horarios y los pasos para sumarte al círculo semanal.').waitFor();
  assert.equal(circleSubmissions, 1);
  assert.deepEqual(await events(), [], 'A circle request must stay outside the program funnel.');
  await page.getByRole('button', { name: 'Cerrar' }).click();
  await form.waitFor({ state: 'hidden' });

  await page.locator('#programa-online #program-launch-open').click();
  await form.getByText(/para informarme sobre el programa y sus productos/).waitFor();
  assert.deepEqual(await events(), [opened]);
  await fillEmailContact();

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
  console.log('Program waitlist and circle requests use distinct consent, payloads and analytics.');
}
