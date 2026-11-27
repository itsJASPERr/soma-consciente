import catalog from '../content/participar/ofertas.json' with { type: 'json' };

export type Offering = (typeof catalog.offers)[number];

export const offerings = catalog.offers;
export const offeringIntro = catalog.intro;
export const retreatOffering = offerings.find(offer => offer.slug === 'encuentro-enero');

const januaryRetreatDates = {
  slug: 'encuentro-enero',
  pageSlug: 'retiro-enero-2027',
  startDate: '2027-01-23',
  endDate: '2027-01-24',
  language: 'Español',
};

export const retreatEditions = retreatOffering
  ? (retreatOffering.dates?.length ? retreatOffering.dates : [retreatOffering])
      .map(date => {
        const edition = { ...retreatOffering, ...januaryRetreatDates, ...date };
        return { ...edition, href: '/encuentros/' + edition.pageSlug + '/' };
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
  : [];

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
