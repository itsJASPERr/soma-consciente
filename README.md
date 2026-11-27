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

La dirección canónica es https://soma-consciente.com/. Cloudflare administra el
DNS y www redirige al dominio raíz. Al migrar la producción a Cloudflare Pages,
asigná ese dominio al proyecto Pages de producción. Astro genera el sitemap en
https://soma-consciente.com/sitemap-index.xml y lo anuncia en robots.txt.

### Vistas previas en Cloudflare Pages

Los pull requests abiertos desde este repositorio publican el sitio estático
validado con Wrangler en el proyecto `soma-consciente-website`. La vista previa
se actualiza en `https://pr-<número>.soma-consciente-preview.pages.dev/`.

El workflow usa el secreto `CLOUDFLARE_ACCOUNT_ID` y un token con permiso
**Cloudflare Pages: Edit**. El token se puede guardar como
`CLOUDFLARE_API_TOKEN` o en el secreto existente `CLOUDFLARE_API_KEY`.

Cuando la recolección está habilitada, el workflow aplica las migraciones de D1
con Wrangler antes de publicar Pages. Las vistas previas migran su base
compartida y los despliegues de `main` migran la base de producción. Cada base
procesa una migración de despliegue a la vez. Si falla una migración, el
workflow mantiene la versión publicada. Para usar un token con permiso
**D1: Edit** aparte del token de Pages, guardalo como
`CLOUDFLARE_D1_API_TOKEN` en GitHub. Si no está configurado, se usa el token de
Pages y ese token necesita ambos permisos.

### Lista de espera en Cloudflare

El formulario envía el nombre, el contacto y el consentimiento a
`POST /api/waitlist` en Cloudflare Pages. La base D1 vinculada como
`WAITLIST_DB` guarda esos datos junto con la fecha y la versión del
consentimiento. Aplicá los archivos de `migrations/` en orden. Ejecutá
`pnpm run test:waitlist` para probar la validación y la deduplicación
con una base SQLite temporal.

Wrangler lee los destinos de `wrangler.d1.toml`. Para aplicar las migraciones:

```sh
pnpm run db:migrate preview --local
pnpm run db:migrate preview --remote
pnpm run db:migrate production --remote
```

Los comandos remotos requieren acceso D1 en la cuenta Cloudflare de SOMA.
El comando reconoce el esquema de las primeras bases y registra las migraciones
ya aplicadas antes de ejecutar las pendientes.

El workflow vincula `WAITLIST_DB` a la base del entorno correspondiente.
Activá `CLOUDFLARE_WAITLIST_PREVIEW_ENABLED` para vistas previas o
`CLOUDFLARE_WAITLIST_PRODUCTION_ENABLED` para producción después de
aplicar las migraciones al destino respectivo.

`pnpm run dev` abre la vista local del formulario y descarta las pruebas.

La agenda y sus enlaces se editan en Pages CMS, en **Encuentros, círculos y
comunidad**. En las páginas del retiro, **Solicitar un lugar** guarda la fecha,
el canal de contacto y la preferencia de pago en `offering_requests`. La
confirmación muestra una referencia y permite continuar por WhatsApp con un
mensaje preparado. Si el webhook recibe esa referencia, asocia el mensaje a
la solicitud. El equipo puede consultar los pedidos en **Solicitudes de retiro**
dentro de `/mensajes/`. El sistema de cupos y reservas se sigue en #34.

El evento de Umami `retreat_request_submitted` se registra en producción al
guardar una solicitud nueva. Incluye solo la edición, el canal y la opción de
pago. Las vistas previas no cargan Umami.

### Bandeja de WhatsApp

La ruta de producción para Meta es
`https://soma-consciente.com/api/whatsapp/webhook`. En Cloudflare Pages, configurá
`WHATSAPP_VERIFY_TOKEN` para verificar el callback y `WHATSAPP_APP_SECRET` con el
App Secret de la misma app de Meta para autenticar las entregas. Configurá ambos
como secretos del entorno correspondiente y desplegá de nuevo. La bandeja
`/mensajes/` usa el secreto `MENSJAES_PASSWORD` existente.

En Meta, suscribí el campo `messages` y comprobá que la app esté suscrita a la
cuenta de WhatsApp Business (WABA) que contiene el número receptor. La
verificación del callback y la suscripción de la cuenta son comprobaciones
distintas. Consultá la [suscripción de apps de la WABA](https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/subscribed_apps/).

Para probar la entrega real, enviá un mensaje nuevo al número de WhatsApp
Business y actualizá la bandeja. En Cloudflare, el log del webhook registra
conteos y fallos de almacenamiento sin incluir contenido ni remitentes.
El webhook devuelve `401` si la firma falta o no coincide y `503` si falta el App
Secret o D1 no puede guardar. Los estados de entrega se confirman sin crear
mensajes en la bandeja.

Para revisar D1 sin leer mensajes ni remitentes:

```bash
pnpm dlx --allow-build=esbuild,workerd wrangler@4.160.1 d1 execute WAITLIST_DB \
  --config wrangler.d1.toml --env production --remote \
  --command 'SELECT COUNT(*) AS message_count, MAX(received_at) AS latest_received_at FROM whatsapp_inbound_messages'
```

Las pruebas locales se ejecutan con `pnpm run test:whatsapp`.

#### Respuestas manuales desde Mensajes

Abrí un mensaje en la bandeja protegida y escribí una respuesta con **Responder**.
Meta permite texto libre durante las 24 horas posteriores al último mensaje de
esa persona. La bandeja muestra el historial de los envíos intentados. **Aceptada
por WhatsApp** confirma que Meta aceptó el envío. Si el envío queda sin confirmar,
revisá WhatsApp antes de reenviarlo. La API conserva el intento y evita repetirlo
cuando el navegador vuelve a consultar el mismo envío.

El entorno necesita el ID de la línea de WhatsApp Business en
`WHATSAPP_PHONE_NUMBER_ID` y un token de Meta con permiso de mensajería en
`WHATSAPP_TOKEN`. Configurá `WHATSAPP_MESSAGING_ACCOUNT_ID` para seleccionar
explícitamente la cuenta de mensajería vinculada a esa línea.
Activá `WHATSAPP_REPLIES_ENABLED=true` cuando esos valores
correspondan al entorno. Mantené los secretos de producción fuera de las vistas
previas. Las migraciones se aplican en el despliegue habitual de Pages.

### Medición del programa online

En Umami, medí el embudo desde la portada hasta la lista de espera del
programa online. Usá los eventos `waitlist_opened` y `waitlist_submitted`. El
segundo se registra cuando la API confirma el envío y lleva solo el canal
elegido. D1 guarda las inscripciones deduplicadas en `waitlist_signups`.
Las solicitudes recibidas por los formularios de las propuestas se guardan en
`offering_requests`.

Umami se incluye solo en el build de producción de Cloudflare y su lista de
dominios limita el envío de eventos. CI comprueba que las vistas previas no
sirvan Umami ni el beacon de Cloudflare Web Analytics.

Etiquetá los enlaces de campaña en minúsculas. Usá `programa_online`
como campaña y elegí `utm_source`, `utm_medium` y `utm_content`
según el canal y la ubicación del enlace.

[Enlace para la bio de Instagram](https://soma-consciente.com/?utm_source=instagram&utm_medium=social&utm_campaign=programa_online&utm_content=bio#programa-online)

### Medición del retiro de enero de 2027

En Umami, el embudo principal **Retiro de enero 2027 · Clics a WhatsApp**
parte de una visita a `/encuentros/retiro-enero-2027*` y llega al evento
`retreat_whatsapp_clicked` en un máximo de 60 minutos. El evento indica que
se abrió el enlace a WhatsApp. El mensaje y la confirmación del lugar
suceden fuera del sitio.

| Evento | Qué registra | `placement` |
| --- | --- | --- |
| `retreat_listing_clicked` | Clic que abre el listado de encuentros | `site_header`, `integration_page` |
| `retreat_details_clicked` | Clic hacia la página del retiro | `home_calendar_title`, `home_calendar_link`, `event_card_details`, `team_footer` |
| `retreat_registration_clicked` | Clic en «Consultar por un lugar» que lleva a la sección de inscripción | `retreat_hero` |
| `retreat_whatsapp_clicked` | Clic que abre WhatsApp para consultar por el retiro | `event_card_registration`, `retreat_registration`, `retreat_pricing` |
| `retreat_schedule_clicked` | Clic en «Ver el cronograma» | `retreat_hero` |
| `retreat_pricing_viewed` | Al menos la mitad de la primera opción de pago visible, una vez por carga | |

Para comparar las entradas internas, consultá `retreat_details_clicked`
por `placement`. Los clics a WhatsApp desde el listado también aparecen
en Eventos aunque la persona no haya visitado la página del retiro.
Usá `retreat_registration_clicked` como señal intermedia opcional: las
personas también pueden desplazarse directamente a la inscripción.

Los clics con una fecha específica y las vistas de precios llevan la propiedad `retreat_edition` (por ejemplo, `retiro-febrero-2027`). Los clics desde las tarjetas de precios también llevan la propiedad `payment_plan`.

Los eventos del retiro no agregan datos personales. Los enlaces de campaña
deben llevar a la página del retiro para medir el recorrido en el sitio.

[Enlace del retiro para la bio de Instagram](https://soma-consciente.com/encuentros/retiro-enero-2027/?utm_source=instagram&utm_medium=social&utm_campaign=retiro_enero_2027&utm_content=bio)

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
- Output: `https://soma-consciente.com/og/soma-consciente.png` (1200 × 630).
- Verification: `pnpm run test:og` after `pnpm run build`.

The common image can later be overridden in `SiteLayout` with `ogImage` and
`ogImageAlt`, but only supply absolute HTTPS or domain-root image URLs that
social crawlers can fetch. Do not use SVG as `og:image`.

Social platforms cache previews. After a deployment, ensure the image URL is
publicly accessible over HTTPS and use a platform share debugger or a cache
refresh before assuming the metadata is still missing.
