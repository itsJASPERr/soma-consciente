export const mensajesCookie = 'soma_mensajes';

type PasswordEnv = {
  MENSJAES_PASSWORD?: string;
};

export function configuredPassword(env: PasswordEnv) {
  const value = env.MENSJAES_PASSWORD;
  if (typeof value !== 'string' || value.length === 0 || value.length > 512 || value.trim().length === 0) {
    return undefined;
  }
  return value;
}

function tokensMatch(provided: string, expected: string) {
  const encoder = new TextEncoder();
  const left = encoder.encode(provided);
  const right = encoder.encode(expected);
  if (left.byteLength !== right.byteLength || left.byteLength === 0) return false;
  let mismatch = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    mismatch |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return mismatch === 0;
}

export async function passwordToken(password: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('soma-mensajes')));
  return [...mac].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function passwordsMatch(provided: string, expected: string) {
  if (provided.length === 0 || provided.length > 512) return false;
  const [left, right] = await Promise.all([passwordToken(provided), passwordToken(expected)]);
  return tokensMatch(left, right);
}

function readCookie(request: Request, name: string) {
  const header = request.headers.get('Cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return undefined;
}

export async function isAuthorized(request: Request, password: string) {
  const cookie = readCookie(request, mensajesCookie);
  if (!cookie) return false;
  return tokensMatch(cookie, await passwordToken(password));
}

export function sessionCookie(token: string) {
  return `${mensajesCookie}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=43200`;
}
