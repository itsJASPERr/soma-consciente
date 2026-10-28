/** Prefix an internal URL with Astro's deployment base.
 * SOMA runs at / on its custom domain; the helper also works for local preview.
 */
export function path(to: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return base + (to.startsWith('/') ? to : '/' + to);
}
