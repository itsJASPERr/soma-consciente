import { retreatEditions } from './offerings';
import { retreatPaymentLabel, retreatPaymentPlans, retreatRebates } from './retreat-requests';

type RetreatRequest = {
  reference: string;
  offering: string;
  payment_plan: string;
  rebates: string[];
  name: string;
  channel: 'whatsapp' | 'email';
  contact: string;
  whatsapp_received: number;
};

const panel = document.querySelector<HTMLDetailsElement>('[data-retreat-inbox]');
const list = panel?.querySelector<HTMLUListElement>('[data-retreat-requests]');
const status = panel?.querySelector<HTMLElement>('[data-retreat-status]');
const refresh = panel?.querySelector<HTMLButtonElement>('[data-retreat-refresh]');

if (panel && list && status && refresh) {
  async function loadRequests() {
    if (!list || !status || !refresh || refresh.disabled) return;
    refresh.disabled = true;
    status.textContent = 'Cargando solicitudes…';
    try {
      const response = await fetch('/api/retreat-requests', { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load requests');
      const { requests } = await response.json() as { requests: RetreatRequest[] };
      list.replaceChildren(...requests.map(request => {
        const row = document.createElement('li');
        const heading = document.createElement('strong');
        heading.textContent = request.name + ' · ' + request.reference;
        const details = document.createElement('p');
        const edition = retreatEditions.find(item => item.slug === request.offering);
        const plan = retreatPaymentPlans.find(item => item.id === request.payment_plan);
        details.textContent = [
          edition?.when ?? request.offering,
          plan ? retreatPaymentLabel(plan) : 'Sin preferencia de pago',
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
