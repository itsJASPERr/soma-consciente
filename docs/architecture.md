# SOMA website — architecture and integration strategy

## Product boundary

SOMA CONSCIENTE is an independently deployed website, not a shared Mágico OS tenant UI. Mágico OS is the optional independently deployed service installation that powers operational workflows. This allows SOMA to retain its own domain, branding and editorial experience while buying and deploying Mágico OS modules separately.

## v0.1: GitHub Pages

Astro generates HTML for homepage, four Aulas, El Núcleo, Biblioteca resources, approach, accompaniment, team and events. There is no backend or authentication. Content lives in src/data/site.ts and the domain base path is managed through src/lib/paths.ts.

Current deployment: https://itsjasperr.github.io/soma-consciente/

GitHub Pages requires repo Settings > Pages > GitHub Actions. This repository includes a workflow on pull requests (build validation) and main (build + publish).

## Future target

Browser <-> SOMA public website (Astro) <-> SOMA's Mágico OS installation, via documented, versioned HTTPS APIs.

Suggested service/module contracts to agree BEFORE implementation:
- Published content: Aula, resource, language, visibility, author, media, updatedAt
- Programs: published offering, facilitator(s), delivery mode, eligibility, pricing
- Encounters: event details, venue, timezone, schedule, remaining availability
- Booking: availability queries, booking intent, confirmation, cancellations
- Member area: enrollments, progress, entitlements and profile

Do not assume endpoint paths until the Mágico OS API has been reconciled with the modular product masterplan. Use src/lib/magico.ts as an integration seam, not a hardcoded implementation.

## Security and deployment decisions

- PUBLIC_ variables are included in the browser bundle. Never put API keys, service secrets or privileged tokens there.
- For public read-only APIs, use CORS scoped to the SOMA domain, short-lived caching, versioned schemas and no client-held privileged credentials.
- For sensitive account and booking features, prefer server-side authenticated flows/BFF and secure HttpOnly cookies, and migrate hosting from GitHub Pages to an SSR-capable runtime if needed.
- Backend must enforce per-installation isolation and authorization, irrespective of frontend controls.
- No actual inventory, schedule, checkout or user accounts are shown before integration and validation.
- Do not publish therapy claims or imply all practices have the same professional status. Identify facilitators and applicable limits.

## Migration path

1. Static content and GitHub Pages (v0.1).
2. Connect public read-only catalog from Mágico OS with fallback content and a clear publishing workflow.
3. Connect event reservation entry points after integration tests and verified availability.
4. For login/member progress, introduce server adapter (Cloudflare/Node/Vercel) and explicit auth contract; React islands can be added selectively.
5. Introduce private content and paid programs only with authorization, consent, privacy and editorial review.
