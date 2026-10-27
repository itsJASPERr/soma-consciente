/**
 * Future API seam for a dedicated Mágico OS installation for SOMA.
 *
 * v0.1 intentionally serves editorial content locally. There are no
 * assumed endpoint URLs or fake booking availability.
 *
 * Planned contracts (to be agreed with Mágico OS):
 * - public catalog: published programs, content and events
 * - booking: public availability / booking intents
 * - identity: OIDC or an HttpOnly-cookie BFF (never embed credentials)
 * - learning: members, enrollments, progress and access control
 *
 * This file is the boundary where a typed API client will be introduced.
 */
export interface SomaIntegrationConfig {
  apiBaseUrl: string;
  organizationSlug: string;
}

export function magicoConfiguration(): SomaIntegrationConfig | null {
  const apiBaseUrl = import.meta.env.PUBLIC_MAGICO_API_BASE_URL;
  if (!apiBaseUrl) return null;
  return {
    apiBaseUrl: apiBaseUrl.replace(/\/$/, ''),
    organizationSlug: import.meta.env.PUBLIC_MAGICO_ORGANIZATION_SLUG || 'soma'
  };
}
