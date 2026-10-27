/** Handles GitHub Pages subpath now and root-domain hosting later. */
export function path(to: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return base + (to.startsWith('/') ? to : '/' + to);
}
