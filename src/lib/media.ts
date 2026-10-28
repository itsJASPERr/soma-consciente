import { path } from './paths';

/**
 * Resolve Pages CMS media in a domain-independent way.
 * During the move from GitHub project Pages to the custom-domain root, older
 * CMS records may still have a /soma-consciente/media/ prefix. Support those
 * without making the new production site depend on the old project path.
 */
const LEGACY_PREFIX='/soma-consciente';

export function mediaUrl(src?: string): string | null {
  const input=src?.trim();
  if(!input) return null;
  if(input.startsWith('/') && !input.startsWith('//')){
    const normalized = input === LEGACY_PREFIX ? '/' :
      input.startsWith(LEGACY_PREFIX+'/') ? input.slice(LEGACY_PREFIX.length) : input;
    return path(normalized);
  }
  try{
    const url=new URL(input);
    if(url.protocol!=='https:' && url.protocol!=='http:')return null;
    // Historical absolute media URLs are normalized to the new origin.
    if(url.hostname==='itsjasperr.github.io' &&
       url.pathname.startsWith(LEGACY_PREFIX+'/media/')){
      return path(url.pathname.slice(LEGACY_PREFIX.length))+url.search+url.hash;
    }
    return url.href;
  }catch{
    return null;
  }
}
