import { path } from './paths';

type Reply = {
  request_id: string;
  in_reply_to: string;
  text_body: string;
  status: 'sending' | 'accepted' | 'failed' | 'unknown';
  created_at: string;
};

type Message = {
  wa_message_id?: unknown;
  from_wa_id?: unknown;
  wa_timestamp?: unknown;
  text_body?: unknown;
  reply_until?: unknown;
};

type Entry = { at: number; text: string; reply?: Reply };
type Conversation = {
  sender: string;
  entries: Entry[];
  replyTarget?: { id: string; at: number; until: number };
};
type Attempt = { id: string; replyTo: string; text: string };

const statuses: Record<Reply['status'], string> = {
  sending: 'Enviando…',
  accepted: 'Aceptada por WhatsApp',
  failed: 'WhatsApp rechazó la respuesta',
  unknown: 'Envío sin confirmar. Revisalo en WhatsApp antes de reenviar.',
};
const errors: Record<string, string> = {
  unauthorized: 'Volvé a cargar la página e ingresá la contraseña.',
  reply_window_closed: 'La ventana de 24 horas cerró. WhatsApp requiere una plantilla aprobada.',
  replies_disabled: 'El envío no está habilitado en este entorno.',
  message_unavailable: 'El mensaje ya no está disponible para responder.',
};
const formatter = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Argentina/Buenos_Aires',
});
const inboxUrl = path('/api/whatsapp/messages');
const phonePattern = /^[1-9]\d{6,14}$/;
const pollIntervalMs = 10_000;

function groupConversations(messages: unknown[], replies: Reply[]) {
  const bySender = new Map<string, Conversation>();
  const byMessage = new Map<string, Conversation>();
  for (const item of messages.slice().reverse()) {
    if (!item || typeof item !== 'object') continue;
    const message = item as Message;
    if (typeof message.wa_message_id !== 'string' || typeof message.from_wa_id !== 'string' || !message.from_wa_id) continue;

    const sender = message.from_wa_id.replace(/^\+(?=\d+$)/, '');
    const conversation: Conversation = bySender.get(sender) ?? { sender, entries: [] };
    const at = new Date(Number(message.wa_timestamp) * 1_000).getTime() || 0;
    const text = typeof message.text_body === 'string' ? message.text_body : '';
    conversation.entries.push({ at, text });
    bySender.set(sender, conversation);
    byMessage.set(message.wa_message_id, conversation);

    const until = message.reply_until;
    if (typeof until === 'number' && Number.isFinite(until) && at <= Date.now()
      && (!conversation.replyTarget || at >= conversation.replyTarget.at)) {
      conversation.replyTarget = { id: message.wa_message_id, at, until };
    }
  }

  for (const reply of replies) {
    byMessage.get(reply.in_reply_to)?.entries.push({
      at: Date.parse(reply.created_at) || 0, text: reply.text_body, reply,
    });
  }

  const conversations = Array.from(bySender.values());
  for (const conversation of conversations) conversation.entries.sort((a, b) => a.at - b.at);
  return conversations.sort((a, b) => b.entries.at(-1)!.at - a.entries.at(-1)!.at);
}

function setTime(element: HTMLTimeElement, at: number) {
  if (!at) return;
  const date = new Date(at);
  element.dateTime = date.toISOString();
  element.textContent = formatter.format(date);
}

function mountInbox(inbox: HTMLElement) {
  const layout = inbox.querySelector<HTMLElement>('[data-inbox-layout]')!;
  const status = inbox.querySelector<HTMLElement>('[data-status]')!;
  const inboxActions = inbox.querySelector<HTMLElement>('[data-inbox-actions]')!;
  const refresh = inbox.querySelector<HTMLButtonElement>('[data-refresh]')!;
  const autoRefresh = inbox.querySelector<HTMLInputElement>('[data-auto-refresh]')!;
  const senderList = inbox.querySelector<HTMLElement>('[data-senders]')!;
  const back = inbox.querySelector<HTMLButtonElement>('[data-back]')!;
  const chatTitle = inbox.querySelector<HTMLElement>('[data-chat-title]')!;
  const whatsapp = inbox.querySelector<HTMLAnchorElement>('[data-whatsapp]')!;
  const timeline = inbox.querySelector<HTMLOListElement>('[data-timeline]')!;
  const form = inbox.querySelector<HTMLFormElement>('[data-reply-form]')!;
  const textarea = form.querySelector<HTMLTextAreaElement>('textarea')!;
  const send = form.querySelector<HTMLButtonElement>('button')!;
  const note = inbox.querySelector<HTMLElement>('[data-reply-note]')!;
  const feedback = form.querySelector<HTMLElement>('[data-reply-status]')!;
  const narrow = window.matchMedia('(max-width: 700px)');

  const drafts = new Map<string, string>();
  const attempts = new Map<string, Attempt>();
  const feedbackBySender = new Map<string, string>();
  let conversations = new Map<string, Conversation>();
  let selected: string | undefined;
  let repliesEnabled = false;
  let loading = false;
  let sending = false;
  let pollTimer: number | undefined;
  let lastResponse: string | undefined;

  function updateControls() {
    refresh.disabled = loading || sending;
    textarea.readOnly = sending;
    send.disabled = loading || sending || !textarea.value.trim();
  }

  function showStatus(message: string) {
    status.textContent = message;
    status.hidden = !message;
  }

  function renderSenders() {
    const focused = senderList.querySelector<HTMLButtonElement>('button:focus')?.dataset.sender;
    const items = document.createDocumentFragment();
    for (const chat of conversations.values()) {
      const latest = chat.entries.at(-1)!;
      const item = document.createElement('li');
      const button = document.createElement('button');
      const sender = document.createElement('strong');
      const preview = document.createElement('span');
      const time = document.createElement('time');
      button.type = 'button';
      button.dataset.sender = chat.sender;
      button.setAttribute('aria-controls', 'whatsapp-conversation');
      button.setAttribute('aria-pressed', String(chat.sender === selected));
      sender.textContent = chat.sender;
      preview.className = 'sender-preview';
      preview.textContent = (latest.reply ? 'Vos: ' : '') + (latest.text || 'Sin texto');
      time.className = 'sender-time';
      setTime(time, latest.at);
      button.append(sender, preview, time);
      item.append(button);
      items.append(item);
    }
    senderList.replaceChildren(items);
    if (focused) senderButton(focused)?.focus({ preventScroll: true });
  }

  function senderButton(sender: string) {
    return senderList.querySelector<HTMLButtonElement>('button[data-sender="' + CSS.escape(sender) + '"]');
  }

  function renderComposer() {
    const chat = selected ? conversations.get(selected) : undefined;
    const target = chat?.replyTarget;
    const canReply = repliesEnabled && target && target.until * 1_000 > Date.now();
    form.hidden = !canReply;
    note.hidden = Boolean(canReply) || !chat;
    note.textContent = !repliesEnabled ? errors.replies_disabled
      : target ? errors.reply_window_closed : 'Esta conversación no está disponible para responder desde SOMA.';
    const draft = selected ? drafts.get(selected) ?? '' : '';
    if (textarea.value !== draft) textarea.value = draft;
    const message = selected ? feedbackBySender.get(selected) ?? '' : '';
    if (feedback.textContent !== message) feedback.textContent = message;
    updateControls();
  }

  function renderConversation(scrollToLatest: boolean) {
    const chat = selected ? conversations.get(selected) : undefined;
    if (!chat) return;
    const previousScroll = timeline.scrollTop;
    const nearEnd = timeline.scrollHeight - timeline.clientHeight - previousScroll <= 32;
    chatTitle.textContent = chat.sender;
    const canOpenWhatsApp = phonePattern.test(chat.sender);
    whatsapp.hidden = !canOpenWhatsApp;
    if (canOpenWhatsApp) whatsapp.href = 'https://wa.me/' + chat.sender;
    else whatsapp.removeAttribute('href');

    const items = document.createDocumentFragment();
    for (const entry of chat.entries) {
      const item = document.createElement('li');
      item.className = entry.reply ? 'chat-message chat-message--outbound' : 'chat-message chat-message--inbound';
      const text = document.createElement('p');
      text.textContent = entry.text || 'Sin texto';
      if (!entry.text) text.className = 'chat-message-empty';
      const details = document.createElement('div');
      details.className = 'chat-message-details';
      const time = document.createElement('time');
      setTime(time, entry.at);
      details.append(time);
      if (entry.reply) {
        const state = document.createElement('span');
        state.textContent = statuses[entry.reply.status];
        details.append(state);
      }
      item.append(text, details);
      items.append(item);
    }
    timeline.replaceChildren(items);
    renderComposer();
    timeline.scrollTop = scrollToLatest || nearEnd ? timeline.scrollHeight : previousScroll;
  }

  function clearInbox() {
    conversations.clear();
    drafts.clear();
    attempts.clear();
    feedbackBySender.clear();
    lastResponse = undefined;
    selected = undefined;
    senderList.replaceChildren();
    timeline.replaceChildren();
    textarea.value = '';
    chatTitle.textContent = '';
    whatsapp.removeAttribute('href');
    layout.hidden = true;
    layout.removeAttribute('data-viewing-chat');
  }

  async function loadMessages(scrollToLatest = false) {
    if (loading || sending) return;
    loading = true;
    updateControls();
    try {
      const response = await fetch(inboxUrl, { cache: 'no-store' });
      if (response.status === 401 || response.status === 403) {
        clearInbox();
        autoRefresh.checked = false;
        syncPolling();
        showStatus(errors.unauthorized);
        return;
      }
      if (!response.ok) throw new Error('unavailable');
      const body = await response.text();
      if (body === lastResponse) {
        showStatus(selected ? '' : 'Todavía no hay mensajes.');
        renderComposer();
        return;
      }
      const payload: { messages?: unknown; replies?: Reply[]; replies_enabled?: boolean } = JSON.parse(body);
      if (!Array.isArray(payload.messages)) throw new Error('invalid response');

      const next = groupConversations(payload.messages, payload.replies ?? []);
      for (const chat of next) {
        const attempt = attempts.get(chat.sender);
        const reply = attempt && chat.entries.find(entry => entry.reply?.request_id === attempt.id)?.reply;
        if (!reply || reply.status === 'sending') continue;
        attempts.delete(chat.sender);
        if (reply.status !== 'failed' && drafts.get(chat.sender)?.trim() === attempt.text) drafts.delete(chat.sender);
      }

      conversations = new Map(next.map(chat => [chat.sender, chat]));
      const previous = selected;
      if (!selected || !conversations.has(selected)) selected = next[0]?.sender;
      repliesEnabled = Boolean(payload.replies_enabled);
      layout.hidden = !selected;
      showStatus(selected ? '' : 'Todavía no hay mensajes.');
      if (selected) {
        renderSenders();
        renderConversation(scrollToLatest || previous !== selected);
      }
      lastResponse = body;
    } catch {
      showStatus('No pudimos leer los mensajes. Volvé a intentar.');
    } finally {
      loading = false;
      updateControls();
    }
  }

  senderList.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-sender]');
    const sender = button?.dataset.sender;
    if (!sender || !conversations.has(sender)) return;
    if (selected) senderButton(selected)?.setAttribute('aria-pressed', 'false');
    selected = sender;
    button.setAttribute('aria-pressed', 'true');
    layout.setAttribute('data-viewing-chat', '');
    renderConversation(true);
    if (narrow.matches) chatTitle.focus({ preventScroll: true });
  });
  back.addEventListener('click', () => {
    layout.removeAttribute('data-viewing-chat');
    if (selected) senderButton(selected)?.focus({ preventScroll: true });
  });

  textarea.addEventListener('input', () => {
    if (!selected) return;
    drafts.set(selected, textarea.value);
    feedbackBySender.delete(selected);
    feedback.textContent = '';
    updateControls();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || loading || !selected || !repliesEnabled) return;
    const sender = selected;
    const target = conversations.get(sender)?.replyTarget;
    if (!target || target.until * 1_000 <= Date.now()) {
      renderComposer();
      return;
    }
    const text = textarea.value.trim();
    if (!text) return;

    const previous = attempts.get(sender);
    const attempt = previous?.text === text ? previous : { id: crypto.randomUUID(), replyTo: target.id, text };
    attempts.set(sender, attempt);
    feedbackBySender.set(sender, 'Enviando…');
    sending = true;
    renderComposer();
    let updated = false;
    try {
      const response = await fetch(inboxUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: attempt.id, in_reply_to: attempt.replyTo, text }),
      });
      const data: { error?: string; reply?: Reply } = await response.json();
      if (!response.ok || !data.reply) {
        feedbackBySender.set(sender, errors[data.error ?? ''] ?? 'No pudimos confirmar el envío. Revisá el historial.');
        return;
      }
      updated = true;
      feedbackBySender.set(sender, statuses[data.reply.status]);
      if (data.reply.status !== 'sending') attempts.delete(sender);
      if (data.reply.status !== 'sending' && data.reply.status !== 'failed') drafts.delete(sender);
    } catch {
      feedbackBySender.set(sender, 'No pudimos confirmar el envío. Actualizá el historial antes de volver a intentar.');
    } finally {
      sending = false;
      renderComposer();
      if (updated) void loadMessages(selected === sender);
    }
  });

  function syncPolling() {
    if (!inbox.hidden && autoRefresh.checked && document.visibilityState === 'visible') {
      pollTimer ??= window.setInterval(() => void loadMessages(), pollIntervalMs);
    } else if (pollTimer !== undefined) {
      window.clearInterval(pollTimer);
      pollTimer = undefined;
    }
  }

  inboxActions.hidden = false;
  refresh.addEventListener('click', () => void loadMessages());
  autoRefresh.addEventListener('change', () => {
    syncPolling();
    if (!inbox.hidden && autoRefresh.checked && document.visibilityState === 'visible') void loadMessages();
  });
  document.addEventListener('visibilitychange', () => {
    syncPolling();
    if (!inbox.hidden && document.visibilityState === 'visible' && (autoRefresh.checked || document.activeElement !== textarea)) {
      void loadMessages();
    }
  });
  inbox.addEventListener('inbox-view-change', () => {
    syncPolling();
    if (!inbox.hidden && lastResponse === undefined) void loadMessages();
  });
  if (!inbox.hidden) void loadMessages();
}

const inbox = document.querySelector<HTMLElement>('[data-whatsapp-inbox]');
if (inbox) mountInbox(inbox);
