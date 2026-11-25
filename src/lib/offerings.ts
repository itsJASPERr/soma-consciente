import catalog from '../content/participar/ofertas.json' with { type: 'json' };

export type Offering = (typeof catalog.offers)[number];

export const offerings = catalog.offers;
export const offeringIntro = catalog.intro;

export function offeringUrl(offer: Offering) {
  const href = offer.url?.trim();
  if (!href) return undefined;
  if (href.startsWith('/') && !href.startsWith('//') && !href.includes('\\')) return href;
  try {
    const url = new URL(href);
    return url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}
