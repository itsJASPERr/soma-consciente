import {
  configuredPassword,
  isAuthorized,
  passwordsMatch,
  passwordToken,
  sessionCookie,
} from './lib/mensajes-access.ts';

type Context = {
  request: Request;
  env: {
    MENSJAES_PASSWORD?: string;
    ASSETS?: { fetch(request: Request): Promise<Response> };
  };
};

const privateHeaders = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };

function refused() {
  return new Response('Esta página no está disponible.', {
    status: 403,
    headers: { ...privateHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

function form(rejected = false) {
  const error = rejected ? '<p class="error" role="alert">La contraseña no coincide.</p>' : '';
  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <meta name="color-scheme" content="light dark">
  <title>Mensajes · SOMA CONSCIENTE</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <script>
    try {
      const theme = localStorage.getItem('soma-theme');
      if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
    } catch {}
  </script>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=DM+Serif+Display&display=swap" rel="stylesheet">
  <style>
    :root {
      color-scheme: light dark;
      --paper: light-dark(#f7f1e8, #242d25);
      --surface-editorial: light-dark(#faf5e9, #2e3a30);
      --white: light-dark(#fffdf7, #303d32);
      --ink: light-dark(#242720, #f4ecdc);
      --muted: light-dark(#585f54, #c0c8b9);
      --pine-dark: light-dark(#17382f, #f0e7d4);
      --pine-fill: light-dark(#274d41, #345b4b);
      --pine-fill-hover: light-dark(#17382f, #3c6655);
      --on-pine: #f7eee0;
      --terra: light-dark(#95513c, #efae92);
      --gold: light-dark(#a77732, #e6be80);
      --line: light-dark(#dfd6c9, #566653);
    }
    :root[data-theme='light'] { color-scheme: light; }
    :root[data-theme='dark'] { color-scheme: dark; }
    *, *::before, *::after { box-sizing: border-box; }
    body {
      display: grid;
      min-height: 100dvh;
      margin: 0;
      padding: 1rem;
      place-items: center;
      background: var(--paper);
      color: var(--ink);
      font: 1rem/1.6 'DM Sans', sans-serif;
    }
    form {
      width: min(100%, 28rem);
      padding: clamp(1.35rem, 5vw, 2.6rem);
      border: 1px solid var(--line);
      border-radius: 1.35rem;
      background: var(--surface-editorial);
    }
    form img {
      display: block;
      width: 3.7rem;
      height: auto;
      aspect-ratio: 1;
      margin-block-end: .85rem;
      padding: .3rem;
      border-radius: .95rem;
      background: #faf5e9;
      object-fit: contain;
    }
    .brand-name { margin: 0; color: var(--terra); font-size: .72rem; font-weight: 700; letter-spacing: .16em; }
    h1 { margin: .2rem 0 .65rem; color: var(--pine-dark); font: 400 clamp(2.45rem, 7vw, 3.2rem)/1 'DM Serif Display', Georgia, serif; }
    p { margin: 0 0 1.15rem; color: var(--muted); }
    label { display: block; font-size: .9rem; font-weight: 600; }
    input {
      display: block;
      width: 100%;
      margin-top: .45rem;
      padding: .7rem .85rem;
      border: 1px solid var(--line);
      border-radius: .7rem;
      background: var(--white);
      color: var(--ink);
      font: inherit;
    }
    button {
      min-height: 44px;
      margin-top: 1rem;
      padding: .65rem 1.25rem;
      border: 0;
      border-radius: 100px;
      background: var(--pine-fill);
      color: var(--on-pine);
      font: 700 .875rem/1.35 'DM Sans', sans-serif;
      cursor: pointer;
    }
    button:hover { background: var(--pine-fill-hover); }
    :is(button, input):focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; }
    .error { color: var(--terra); }
  </style>
</head>
<body>
  <form method="post" action="/mensajes/">
    <img src="/media/soma-original-emblem.png" width="520" height="405" alt="">
    <p class="brand-name">SOMA CONSCIENTE</p>
    <h1>Mensajes</h1>
    <p>Ingresá la contraseña para ver los mensajes.</p>
    ${error}
    <label>Contraseña
      <input type="password" name="password" autocomplete="current-password" required>
    </label>
    <button type="submit">Entrar</button>
  </form>
</body>
</html>`;
  return new Response(html, {
    status: rejected ? 401 : 200,
    headers: { ...privateHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  });
}

async function submittedPassword(request: Request) {
  const contentType = request.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase();
  if (contentType !== 'application/x-www-form-urlencoded') return undefined;
  const reader = request.body?.getReader();
  if (!reader) return undefined;
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 2048) {
      await reader.cancel();
      return undefined;
    }
    body += decoder.decode(value, { stream: true });
  }
  body += decoder.decode();
  return new URLSearchParams(body).get('password') ?? undefined;
}

export async function onRequestGet({ request, env }: Context) {
  const password = configuredPassword(env);
  if (!password) return refused();
  if (!(await isAuthorized(request, password))) return form();
  if (!env.ASSETS) return new Response(null, { status: 503, headers: privateHeaders });
  return env.ASSETS.fetch(request);
}

export async function onRequestPost({ request, env }: Context) {
  const password = configuredPassword(env);
  if (!password) return refused();
  const submitted = await submittedPassword(request);
  if (submitted === undefined || !(await passwordsMatch(submitted, password))) return form(true);
  return new Response(null, {
    status: 303,
    headers: {
      ...privateHeaders,
      Location: '/mensajes/',
      'Set-Cookie': sessionCookie(await passwordToken(password)),
    },
  });
}

export async function onRequestHead(context: Context) {
  const response = await onRequestGet(context);
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(null, { status: response.status, headers });
}
