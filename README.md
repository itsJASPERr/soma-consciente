# SOMA CONSCIENTE

**Cuatro caminos, un mismo núcleo.** Sitio web público de SOMA CONSCIENTE — v0.3.

## Stack

- Astro 5 + TypeScript, HTML estático para GitHub Pages
- Astro Content Collections (JSON validado con Zod)
- Imágenes editoriales configurables por Pages CMS para portada, Aulas, cursos, Biblioteca, Núcleo y Encuentros
- Pages CMS, ya conectado a GitHub; el archivo `.pages.yml` configura los editores
- Iconoir (a través de `astro-icon`) para iconos de interfaz
- Arte vectorial propio para las cuatro Aulas y El Núcleo
- Integración futura con la instalación independiente de Mágico OS para SOMA

## Desarrollo local

Node.js 22+.

```sh
npm install
npm run dev
npm run content:check\nnpm run build
```

## Despliegue

En GitHub: **Settings → Pages → Source: GitHub Actions** y **Custom domain: `www.soma-consciente.com`**. El dominio se configura en *Settings → Pages* (el workflow no usa un `CNAME` como fuente de verdad). DNS en Porkbun: `www` CNAME → `itsjasperr.github.io`; el dominio raíz utiliza registros A/AAAA de GitHub Pages y puede redirigir a www. El archivo `public/CNAME` se incluye como metadato coherente del sitio; GitHub Actions ignora su contenido para configurar el dominio.

En GitHub: **Settings → Pages → Source: GitHub Actions**. El workflow `.github/workflows/deploy.yml` valida PRs y despliega automáticamente los cambios de `main`.

Dirección prevista: https://www.soma-consciente.com/

Si Pages aún no está habilitado, el build puede finalizar correctamente pero la publicación fallará. Habilitá GitHub Actions como fuente y volvé a ejecutar el workflow.

## Edición de contenido

Pages CMS ya está vinculado al proyecto. No se necesita otra instancia ni una nueva conexión.

- Inicio (imágenes): `src/content/home/home.json`
- Cuatro Aulas (fotos de portada): `src/content/aulas/*.json`
- Cursos, secciones y lecciones: `src/content/cursos/*.json`, `src/content/secciones/*.json`, `src/content/lecciones/*.json`
- Biblioteca: `src/content/recursos/*.json`
- Campos del editor: `.pages.yml`
- Validación tipada: `src/content.config.ts`
- Lectura ordenada y filtrada por `published`: `src/lib/content.ts`
- Guía: `docs/content-guide.md`

Cada archivo es la fuente de verdad; evitamos duplicar textos en código TypeScript. Se generan páginas estáticas automáticamente al publicar cambios en `main`.

## Identidad visual

La marca pública es **SOMA CONSCIENTE**. El emblema original y los cuatro símbolos extraídos de él están en `public/media/` y se usan sin reconstrucciones. Las fotografías nuevas son editoriales e ilustrativas, no retratos de las personas del equipo. Pueden cambiarse directamente desde Pages CMS.

## Backend Mágico OS

El sitio sigue independiente. En esta etapa el contenido público está en Git; no hay login, disponibilidad de reservas o eventos inventados. Mágico OS podrá ofrecer APIs para agenda, reservas, suscripciones, acceso de miembros y progreso cuando sus contratos estén aprobados.

Arquitectura: `docs/architecture.md`.

## Curso piloto y diseño responsive

La estructura de Aula → Curso → Sección → Lección está implementada en Astro. El Aula de Jasper incluye un recorrido piloto Música Medicina con cinco etapas, tres lecciones abiertas y doce en preparación. El diseño tiene índice lateral en escritorio y panel desplegable en móviles. Los bloques de lección admiten Markdown, audio, video, imágenes, prácticas y reflexiones.

La guía completa para editar: `docs/content-guide.md`. No hay aún historial personal, cuentas ni contenido protegido.

## Open Graph / social previews

Every public route generates Open Graph and Twitter Card tags (title, description,
canonical URL, `og:image`, dimensions, Spanish locale and alt text) in
`src/layouts/SiteLayout.astro`. The default first-party PNG is generated from
the **original SOMA emblem** at build time:

- Source: `public/media/soma-original-emblem.png` (unchanged).
- Generator: `scripts/generate-social-image.mjs`, run automatically by npm's
  `prebuild` and `predev` hooks.
- Output: `https://www.soma-consciente.com/og/soma-consciente.png` (1200 × 630).
- Verification: `npm run test:og` after `npm run build`.

The common image can later be overridden in `SiteLayout` with `ogImage` and
`ogImageAlt`, but only supply absolute HTTPS or domain-root image URLs that
social crawlers can fetch. Do not use SVG as `og:image`.

Social platforms cache previews. After a deployment, ensure the image URL is
publicly accessible over HTTPS and use a platform share debugger or a cache
refresh before assuming the metadata is still missing.
