# Guía editorial — SOMA CONSCIENTE

## Pages CMS (ya conectado)

Abrí SOMA CONSCIENTE en tu cuenta de Pages CMS. La configuración `.pages.yml` ofrece dos colecciones:

- **Las cuatro Aulas**: Nicole, Jasper, Nico Pacha y Yanina. Cada Aula tiene una URL permanente. Se permite editar contenido y visibilidad, pero no crear, renombrar ni borrar Aulas desde el CMS.
- **Biblioteca de recursos**: recursos gratuitos con título, resumen, categoría, introducción, pasos y reflexión. Se pueden crear nuevos archivos JSON. El campo `slug` debe ser único, minúsculas y guiones, y coincidir con el nombre del archivo.

## Flujo de publicación

1. Elegir `main` (o una rama editorial para revisión).
2. Editar un Aula o recurso.
3. Guardar el contenido: Pages CMS realiza un commit en la rama seleccionada.
4. Si el cambio se hizo en una rama de revisión, abrir PR y fusionar después.
5. GitHub Actions construye la web a partir de los JSON y despliega a Pages.

Los campos `published: false` ocultan la entrada del sitio en la próxima compilación. Para Aulas, esto también oculta la ruta individual.

## Buenas prácticas

- Usar un lenguaje cálido, sobrio y responsable. Evitar promesas de curación, resultados garantizados o equivalencias impropias entre prácticas.
- Distinguir psicología clínica de experiencias educativas, expresivas y de bienestar.
- No publicar datos privados de personas acompañadas ni historiales de salud.
- No introducir fechas, cupos ni precios de encuentros que no estén verificados.
- Respetar la autoría de cada Aula. El Núcleo es el espacio cocreado; las cuatro disciplinas mantienen sus límites.
- Las imágenes subidas a Pages CMS se guardarán en `public/media` y usarán rutas de GitHub Pages con el prefijo `/soma-consciente/media`. Ajustar esas rutas al migrar a un dominio propio.

## Futura integración

Cuando la instalación SOMA de Mágico OS esté lista, incorporar una fuente remota de datos respetando el mismo modelo de dominio: Aula, Resource, Program, Encounter y Facilitator. Reservas, cuentas y permisos van en APIs protegidas, no en el repositorio público.
