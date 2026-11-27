import { circleOffering, retreatEditions } from './offerings';
import { retreatPaymentLabel, retreatPaymentPlans, retreatRebates } from './retreat-requests';

type RetreatRequest = {
  reference: string;
  offering: string;
  payment_plan: string | null;
  rebates: string[];
  name: string;
  channel: 'whatsapp' | 'email';
  contact: string;
  whatsapp_received: number;
};

for (const panel of document.querySelectorAll<HTMLDetailsElement>('[data-request-inbox]')) {
  const requestsUrl = '/api/retreat-requests?kind=' + panel.dataset.requestInbox;
  const list = panel.querySelector<HTMLUListElement>('[data-requests]');
  const status = panel.querySelector<HTMLElement>('[data-request-status]');
  const refresh = panel.querySelector<HTMLButtonElement>('[data-request-refresh]');
  if (!list || !status || !refresh) continue;

  async function loadRequests() {
    if (!list || !status || !refresh || refresh.disabled) return;
    refresh.disabled = true;
    status.textContent = 'Cargando solicitudes…';
    try {
      const response = await fetch(requestsUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load requests');
      const { requests } = await response.json() as { requests: RetreatRequest[] };
      list.replaceChildren(...requests.map(request => {
        const row = document.createElement('li');
        const heading = document.createElement('strong');
        heading.textContent = request.name + ' · ' + request.reference;
        const details = document.createElement('p');
        const edition = retreatEditions.find(item => item.slug === request.offering);
        const plan = retreatPaymentPlans.find(item => item.id === request.payment_plan);
        const isCircle = request.offering === circleOffering?.slug;
        details.textContent = [
          isCircle ? circleOffering?.title : edition?.when ?? request.offering,
          isCircle ? '' : plan ? retreatPaymentLabel(plan) : 'Sin preferencia de pago',
          ...retreatRebates.filter(rebate => request.rebates.includes(rebate.id)).map(rebate => rebate.label),
          request.whatsapp_received ? 'Mensaje de WhatsApp recibido' : '',
        ].filter(Boolean).join(' · ');
        const contact = document.createElement('a');
        contact.textContent = request.contact;
        if (request.channel === 'whatsapp' && /^\+[0-9]+$/.test(request.contact)) {
          contact.href = 'https://wa.me/' + request.contact.slice(1);
        } else if (request.channel === 'email') {
          contact.href = 'mailto:' + encodeURIComponent(request.contact).replace('%40', '@');
        }
        row.append(heading, details, contact);
        return row;
      }));
      status.textContent = requests.length ? 'Solicitudes más recientes' : 'Todavía no hay solicitudes.';
    } catch {
      status.textContent = 'No pudimos cargar las solicitudes. Probá actualizar.';
    } finally {
      refresh.disabled = false;
    }
  }

  panel.addEventListener('toggle', () => {
    if (panel.open) void loadRequests();
  });
  refresh.addEventListener('click', () => void loadRequests());
}
