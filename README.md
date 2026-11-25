# SOMA CONSCIENTE

**Cuatro caminos, un mismo núcleo.** Sitio web público de SOMA CONSCIENTE — v0.3.

## Stack

- Astro + TypeScript, HTML estático para GitHub Pages
- Astro Content Collections (JSON validado con Zod)
- Imágenes editoriales configurables por Pages CMS para portada, Aulas, cursos, Biblioteca, Núcleo y Encuentros
- Pages CMS, ya conectado a GitHub; el archivo `.pages.yml` configura los editores
- Iconoir (a través de `astro-icon`) para iconos de interfaz
- Arte vectorial propio para las cuatro Aulas y El Núcleo
- Integración futura con la instalación independiente de Mágico OS para SOMA

## Desarrollo local

Node.js 22+ y pnpm 12.23.0.

```sh
pnpm install --frozen-lockfile
pnpm run dev
pnpm run content:check
pnpm run build
```

## Despliegue

El workflow `.github/workflows/deploy.yml` valida los PRs y publica automáticamente
los cambios de main. Al configurar la variable de repositorio
`CLOUDFLARE_PRODUCTION_PROJECT` con el nombre del proyecto Pages, los cambios de
`main` se publican en Cloudflare con Wrangler. Con la variable vacía, GitHub
Pages sigue publicando el sitio.

La dirección canónica es https://www.soma-consciente.com/. En Cloudflare, asigná
el dominio personalizado al proyecto Pages que sirve producción.

### Vistas previas en Cloudflare Pages

Los pull requests abiertos desde este repositorio publican el sitio estático
validado con Wrangler en el proyecto `soma-consciente-preview`. La vista previa
se actualiza en `https://pr-<número>.soma-consciente-preview.pages.dev/`.

El workflow usa el secreto `CLOUDFLARE_ACCOUNT_ID` y un token con permiso
**Cloudflare Pages: Edit**. El token se puede guardar como
`CLOUDFLARE_API_TOKEN` o en el secreto existente `CLOUDFLARE_API_KEY`.

### Lista de espera en Cloudflare

El formulario usa el endpoint `POST /api/waitlist` de Cloudflare Pages y la
base D1 vinculada como `WAITLIST_DB`. La migración
`migrations/0001_waitlist.sql` crea la tabla de contactos y guarda la fecha y la
versión del consentimiento. Ejecutá `pnpm run test:waitlist` para probar la
validación y la deduplicación con una base SQLite temporal.

Para habilitar el formulario en un despliegue de Cloudflare, aplicá la
migración a la base D1 del entorno, vinculala como `WAITLIST_DB` y compilá
con `PUBLIC_WAITLIST_ENABLED=true`. En los PRs, Wrangler vincula esa base al
entorno de vista previa si `CLOUDFLARE_WAITLIST_PREVIEW_ENABLED` es `true`
y `CLOUDFLARE_WAITLIST_PREVIEW_DATABASE_ID` contiene su identificador.
En producción, vinculá una base D1 dedicada en el proyecto Pages y activá
`CLOUDFLARE_WAITLIST_PRODUCTION_ENABLED` después de aplicar la migración.

`pnpm run dev` abre la vista local del formulario y descarta las pruebas.

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
- Generator: `scripts/generate-social-image.mjs`, run automatically by pnpm's
  `prebuild` and `predev` hooks.
- Output: `https://www.soma-consciente.com/og/soma-consciente.png` (1200 × 630).
- Verification: `pnpm run test:og` after `pnpm run build`.

The common image can later be overridden in `SiteLayout` with `ogImage` and
`ogImageAlt`, but only supply absolute HTTPS or domain-root image URLs that
social crawlers can fetch. Do not use SVG as `og:image`.

Social platforms cache previews. After a deployment, ensure the image URL is
publicly accessible over HTTPS and use a platform share debugger or a cache
refresh before assuming the metadata is still missing.
