# SOMA CONSCIENTE

**Cuatro caminos, un mismo núcleo.** Sitio web público de SOMA CONSCIENTE — v0.2.

## Stack

- Astro 5 + TypeScript, HTML estático para GitHub Pages
- Astro Content Collections (JSON validado con Zod)
- Pages CMS, ya conectado a GitHub; el archivo `.pages.yml` configura los editores
- Iconoir (a través de `astro-icon`) para iconos de interfaz
- Arte vectorial propio para las cuatro Aulas y El Núcleo
- Integración futura con la instalación independiente de Mágico OS para SOMA

## Desarrollo local

Node.js 22+.

```sh
npm install
npm run dev
npm run build
```

## Despliegue

En GitHub: **Settings → Pages → Source: GitHub Actions**. El workflow `.github/workflows/deploy.yml` valida PRs y despliega automáticamente los cambios de `main`.

Dirección prevista: https://itsjasperr.github.io/soma-consciente/

Si Pages aún no está habilitado, el build puede finalizar correctamente pero la publicación fallará. Habilitá GitHub Actions como fuente y volvé a ejecutar el workflow.

## Edición de contenido

Pages CMS ya está vinculado al proyecto. No se necesita otra instancia ni una nueva conexión.

- Cuatro Aulas: `src/content/aulas/*.json`
- Biblioteca: `src/content/recursos/*.json`
- Campos del editor: `.pages.yml`
- Validación tipada: `src/content.config.ts`
- Lectura ordenada y filtrada por `published`: `src/lib/content.ts`
- Guía: `docs/content-guide.md`

Cada archivo es la fuente de verdad; evitamos duplicar textos en código TypeScript. Se generan páginas estáticas automáticamente al publicar cambios en `main`.

## Identidad visual

La marca pública es **SOMA CONSCIENTE**, no SOMA CONCIENCIA. Los cuatro símbolos del logo aportado guían los emblemas SVG implementados. La marca en el sitio es una **adaptación vectorial**: el PNG original no fue incorporado como archivo de imagen al repositorio. Para fidelidad perfecta, reemplazar el SVG por el original vectorizado o subir el PNG al directorio `public/media/brand/` desde Pages CMS y referenciarlo.

## Backend Mágico OS

El sitio sigue independiente. En v0.2 todo el contenido público está en Git; no hay login, disponibilidad de reservas o eventos inventados. Mágico OS podrá ofrecer APIs para agenda, reservas, suscripciones, acceso de miembros y progreso cuando sus contratos estén aprobados.

Arquitectura: `docs/architecture.md`.
