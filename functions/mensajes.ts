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
  const error = rejected ? '<p class="error">La contraseña no coincide.</p>' : '';
  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Mensajes · SOMA CONSCIENTE</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f7f1e8; color: #242720; font-family: Georgia, sans-serif; }
    form { width: min(420px, calc(100% - 32px)); background: #fffaf2; border: 1px solid #dfd6c9; border-radius: 18px; padding: 28px; }
    h1 { font-weight: 400; font-size: 2rem; margin: 0 0 8px; }
    p { color: #696f67; }
    label { display: block; font: 600 .9rem 'DM Sans', sans-serif; }
    input { width: 100%; box-sizing: border-box; margin-top: 8px; padding: 12px 14px; border-radius: 12px; border: 1px solid #dfd6c9; font: inherit; }
    button { margin-top: 16px; background: #274d41; color: white; border: 0; border-radius: 999px; padding: 12px 18px; font-weight: 700; cursor: pointer; }
    .error { color: #b66b53; }
  </style>
</head>
<body>
  <form method="post" action="/mensajes/">
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
