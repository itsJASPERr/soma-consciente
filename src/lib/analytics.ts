export type AnalyticsLinkAttributes = {
  'data-umami-event'?: string;
  'data-umami-event-placement'?: string;
};

export const analyticsEnabled = import.meta.env.PROD && import.meta.env.PUBLIC_ANALYTICS_ENABLED === 'true';

export function retreatCta(
  action: 'listing' | 'details' | 'registration' | 'schedule' | 'whatsapp',
  placement: string,
): AnalyticsLinkAttributes {
  if (!analyticsEnabled) return {};
  return {
    'data-umami-event': 'retreat_' + action + '_clicked',
    'data-umami-event-placement': placement,
  };
}
