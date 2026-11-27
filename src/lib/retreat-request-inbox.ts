import { circleOffering, retreatEditions } from './offerings';
import { path } from './paths';
import { retreatPaymentLabel, retreatPaymentPlans, retreatRebates } from './retreat-requests';

type ParticipationRequest = {
  reference: string;
  offering: string;
  payment_plan: string | null;
  rebates: string[];
  name: string;
  channel: 'whatsapp' | 'email';
  contact: string;
  whatsapp_received: number;
};

function paragraph(text: string) {
  const element = document.createElement('p');
  element.textContent = text;
  return element;
}

function renderRequest(request: ParticipationRequest) {
  const row = document.createElement('li');
  row.className = 'request-row';

  const person = document.createElement('div');
  const name = document.createElement('h4');
  name.textContent = request.name;
  const reference = document.createElement('code');
  reference.textContent = request.reference;
  person.append(name, reference);

  const details = document.createElement('div');
  const isCircle = request.offering === circleOffering?.slug;
  const edition = retreatEditions.find(item => item.slug === request.offering);
  const activity = paragraph(isCircle ? circleOffering.title : edition?.when ?? request.offering);
  activity.className = 'request-activity';
  details.append(activity);
  if (!isCircle) {
    const plan = retreatPaymentPlans.find(item => item.id === request.payment_plan);
    details.append(paragraph(plan ? retreatPaymentLabel(plan) : 'Sin preferencia de pago'));
    for (const rebate of retreatRebates) {
      if (request.rebates.includes(rebate.id)) details.append(paragraph(rebate.label));
    }
  }
  if (request.whatsapp_received) {
    const received = document.createElement('span');
    received.className = 'request-whatsapp-state';
    received.textContent = 'Mensaje de WhatsApp recibido';
    details.append(received);
  }

  const contact = document.createElement('div');
  contact.className = 'request-contact';
  contact.append(paragraph(request.contact));
  const action = document.createElement('a');
  action.className = 'inbox-button';
  const activityName = isCircle ? 'el círculo de integración online'
    : edition ? 'el retiro del ' + edition.when : 'el retiro';
  const nextStep = isCircle ? 'Te escribimos para compartirte los horarios y cómo sumarte.'
    : 'Te escribimos para revisar disponibilidad y coordinar los próximos pasos.';
  const message = [
    'Hola, ' + request.name.replace(/\s+/g, ' ') + '.',
    'Gracias por tu solicitud para ' + activityName + '. ' + nextStep,
    'Tu referencia es ' + request.reference + '.',
    'Equipo SOMA Consciente',
  ].join('\n\n');
  if (request.channel === 'whatsapp' && /^\+[0-9]+$/.test(request.contact)) {
    const url = new URL('https://wa.me/' + request.contact.slice(1));
    url.searchParams.set('text', message);
    action.href = url.href;
    action.textContent = 'Escribir por WhatsApp';
    action.target = '_blank';
    action.rel = 'noopener noreferrer';
  } else if (request.channel === 'email') {
    const subject = (isCircle ? 'Círculo de integración online' : 'Retiro SOMA') + ' · ' + request.reference;
    action.href = 'mailto:' + encodeURIComponent(request.contact).replace('%40', '@') +
      '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(message.replace(/\n/g, '\r\n'));
    action.textContent = 'Enviar correo';
  }
  if (action.hasAttribute('href')) contact.append(action);

  row.append(person, details, contact);
  return row;
}

for (const panel of document.querySelectorAll<HTMLElement>('[data-request-inbox]')) {
  const requestsUrl = path('/api/retreat-requests') + '?kind=' + panel.dataset.requestInbox;
  const list = panel.querySelector<HTMLUListElement>('[data-requests]');
  const status = panel.querySelector<HTMLElement>('[data-request-status]');
  const refresh = panel.querySelector<HTMLButtonElement>('[data-request-refresh]');
  if (!list || !status || !refresh) continue;

  let loaded = false;
  async function loadRequests() {
    if (!list || !status || !refresh || refresh.disabled) return;
    refresh.disabled = true;
    status.textContent = 'Cargando solicitudes…';
    try {
      const response = await fetch(requestsUrl, { cache: 'no-store' });
      if (response.status === 401 || response.status === 403) {
        loaded = false;
        list.replaceChildren();
        status.textContent = 'Volvé a cargar la página e ingresá la contraseña.';
        return;
      }
      if (!response.ok) throw new Error('Could not load requests');
      const { requests } = await response.json() as { requests: ParticipationRequest[] };
      list.replaceChildren(...requests.map(renderRequest));
      status.textContent = requests.length
        ? (requests.length === 1 ? '1 solicitud reciente' : requests.length + ' solicitudes recientes')
        : 'Todavía no hay solicitudes.';
      loaded = true;
    } catch {
      status.textContent = 'No pudimos cargar las solicitudes. Probá actualizar.';
    } finally {
      refresh.disabled = false;
    }
  }

  function loadVisibleRequests() {
    if (!loaded && !panel.closest('[hidden]')) void loadRequests();
  }

  panel.addEventListener('inbox-view-change', loadVisibleRequests);
  refresh.addEventListener('click', () => void loadRequests());
  loadVisibleRequests();
}
