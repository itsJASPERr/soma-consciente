import { path } from './paths';

/** Media from Pages CMS can use paths from this GitHub Pages project or HTTPS URLs. */
export function mediaUrl(src?: string): string | null {
  if (!src) return null;
  if (src.startsWith('/soma-consciente/')) return src;
  if (src.startsWith('/') && !src.startsWith('//')) return path(src);
  try {
    const u = new URL(src);
    return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : null;
  } catch { return null; }
}
