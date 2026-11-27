export type AnalyticsLinkAttributes = {
  'data-umami-event'?: string;
  'data-umami-event-placement'?: string;
  'data-umami-event-retreat_edition'?: string;
};

export const analyticsEnabled = import.meta.env.PROD && import.meta.env.PUBLIC_ANALYTICS_ENABLED === 'true';

export function retreatCta(
  action: 'listing' | 'details' | 'registration' | 'schedule' | 'whatsapp',
  placement: string,
  edition?: string,
): AnalyticsLinkAttributes {
  if (!analyticsEnabled) return {};
  return {
    'data-umami-event': 'retreat_' + action + '_clicked',
    'data-umami-event-placement': placement,
    ...(edition ? { 'data-umami-event-retreat_edition': edition } : {}),
  };
}

export function circleCta(action: 'registration' | 'whatsapp', placement: 'circle_hero' | 'circle_confirmation'): AnalyticsLinkAttributes {
  if (!analyticsEnabled) return {};
  return {
    'data-umami-event': 'circle_' + action + '_clicked',
    'data-umami-event-placement': placement,
  };
}
