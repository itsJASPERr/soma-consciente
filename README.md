# SOMA CONSCIENTE

Website v0.1 · Cuatro caminos, un mismo núcleo.

An independent frontend for the SOMA CONSCIENTE collective. Four Aulas (Nicole, Jasper, Nico Pacha and Yanina), a shared Núcleo, a free learning library, online accompaniment and in-person encounters.

## Stack

- Astro 5 + TypeScript, static output
- Responsive custom CSS, no UI framework dependency
- GitHub Pages deployment via GitHub Actions
- Planned independent Mágico OS backend integration via versioned APIs

## Local development

Requires Node 22 or newer.

1. npm install
2. npm run dev
3. npm run build

## Initial deployment

In GitHub repository Settings > Pages, choose GitHub Actions as the build/deployment source. Merge the website pull request to main. The workflow builds and publishes the site at:

https://itsjasperr.github.io/soma-consciente/

The above is the expected URL; publishing is not confirmed until Pages is enabled and the workflow succeeds.

## Content

Editorial content is in src/data/site.ts. Pages are statically generated (including each Aula and each Biblioteca resource). The approved public name is SOMA CONSCIENTE.

There are no invented event dates, prices, booking availabilities, team photographs, testimonials, or live member features.

## Mágico OS integration

The website is a self-contained client, not a Mágico OS module. A separately deployed SOMA installation of Mágico OS can provide published programs, event availability, booking and member functionality via APIs. Read docs/architecture.md before connecting the backend. No secrets belong in PUBLIC_ environment variables.

## Next steps

Confirm the actual brand asset files and team portraits; configure Pages; verify the build; align API contracts with Mágico OS; add SOMA-specific library resources and upcoming event information; then add member journeys and reserved content when backend contracts are ready.
