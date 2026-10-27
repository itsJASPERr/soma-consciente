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


## Recorridos, secciones y lecciones (v0.3)

El sitio ahora contiene un sistema de aprendizaje responsive, común a las cuatro Aulas. Todas las Aulas pueden tener múltiples cursos; cada curso contiene etapas/secciones y cada sección contiene lecciones ordenadas.

**Colecciones en Pages CMS**:
- `Cursos / Recorridos` → `src/content/cursos/*.json`.
- `Secciones / Etapas` → `src/content/secciones/*.json`.
- `Lecciones y contenido` → `src/content/lecciones/*.json`.

### Identificadores y relaciones

Cada curso/sección/lección tiene un campo `key` estable y único, usado por las referencias. El archivo JSON se denomina `<key>.json`. No cambiar una clave publicada sin actualizar sus referencias.

- `curso.aula` referencia `aulas.slug`.
- `seccion.course` referencia `curso.key`.
- `leccion.section` referencia `seccion.key`.
- `order` determina el orden dentro del nivel correspondiente.
- `slug` determina el segmento URL de ese contenido.

La web construye las rutas como `/aulas/{aula}/{curso}/{seccion}/{leccion}/` y las valida antes de publicar con `npm run content:check`.

### Estados editoriales de las lecciones

- `draft`: completamente oculto, no aparece en la web.
- `planned`: solo título de la lección en el índice, sin enlace.
- `published`: página pública con bloques y navegación a lecciones disponibles.

La publicación de un curso o sección depende además del campo `published` en su archivo JSON. **Todas las lecciones publicadas son abiertas en esta etapa**. No usar GitHub Pages para contenido privado, pagos, notas de participantes ni datos clínicos.

### Contenidos mixtos por lección

En Pages CMS, editar la lista `blocks` y elegir el tipo:
- **Texto:** título y cuerpo con editor Markdown.
- **Audio:** URL HTTPS de un audio y notas/transcripción.
- **Video:** URL YouTube, Vimeo o archivo MP4/WebM y notas.
- **Imagen:** subida en la biblioteca de medios, descripción y pie.
- **Práctica:** instrucciones y duración orientativa.
- **Reflexión:** preguntas que invitan a escribir; las notas del visitante no se guardan.
- **Cita:** fragmento destacado.

Los bloques aparecen en el orden definido en el CMS. Markdown acepta texto, títulos, listas y enlaces; HTML directo se deshabilita para seguridad.

Para archivos multimedia grandes, usar un proveedor de alojamiento apropiado en vez de incluir los videos en Git. No indicar audio o video disponible antes de subirlo: las lecciones iniciales de Música Medicina contienen solo lecturas y prácticas reales.

### Ejemplo piloto: Jasper

`Música Medicina — La música que nos habita` tiene las etapas Escuchar, Sentir, Expresar, Resonar e Integrar. Tres lecciones introductorias están abiertas con contenido original; otras doce son **planned**. El equipo puede editar o reorganizar todo este contenido desde Pages CMS sin cambios de código.

Este contenido inicial es un piloto editorial de diseño, no un programa académico definitivo ni una promesa clínica. Los cursos de las otras Aulas todavía no fueron definidos.

### Futuro Mágico OS

La jerarquía de entidades, sus claves y relaciones deben poder migrar a la instalación independiente de Mágico OS. El avance personal, las inscripciones, la membresía y los permisos requerirán backend autenticado; no se guardan hoy en Git ni en un formulario público.


## Gestión de imágenes del sitio (homepage y Aulas)

La imagen de referencia de diseño era una composición conceptual, no una biblioteca de fotografías ni retratos auténticos del equipo. Las fotografías cargadas ahora son **imágenes editoriales ilustrativas** con licencia Unsplash; NO muestran necesariamente a Nicole, Jasper, Yanina ni Nico Pacha. Reemplazarlas con fotografías reales aprobadas del equipo cuando estén disponibles.

En Pages CMS:
1. Abrí la colección **Imágenes de la página de inicio**. Ahí están las cuatro áreas: portada hero, Núcleo, acompañamiento online y Encuentros, cada una con URL de imagen y descripción.
2. Abrí **Las cuatro Aulas** → seleccioná el Aula → editá **Foto de portada del Aula** y su descripción. La misma foto se muestra en las tarjetas y la portada del Aula.
3. En **Cursos / Recorridos** encontrás la **Imagen de portada del curso**.
4. En **Biblioteca de recursos** podés reemplazar la **Imagen del recurso**.
5. Guardá el cambio en GitHub y esperá al despliegue automático de GitHub Pages.

Pages CMS ya está conectado, por lo que no hay que instalar otro editor. El campo **Imagen** permite seleccionar/subir archivos a `public/media`. Las imágenes también pueden tener un enlace HTTPS de origen; el frontend soporta URLs externas o imágenes nuevas con rutas de Pages CMS como `/soma-consciente/media/archivo.webp`.

Al escribir la descripción accesible (`alt`), describí lo que se ve, no hagas promesas médicas o espirituales. Cada imagen decorativa sirve para la atmósfera general y no debe presentarse como fotografía de una actividad real de SOMA hasta tener permiso y confirmación.

Por rendimiento, usar preferentemente fotos WebP/JPG optimizadas de 1200–1600 px para grandes banners y 800–1000 px para tarjetas. Guardar archivos de imagen razonablemente livianos; alojar videos y audios grandes fuera de GitHub.

## Encuadre y tamaño de las fotos de Aula

En Pages CMS → **Las cuatro Aulas**, cada Aula tiene una **Foto de portada del Aula** y el campo **Encuadre de la foto del Aula**. Elegí entre Muy arriba, Arriba, Centro, Abajo o Muy abajo para desplazar el punto de interés sin editar el archivo. El encuadre se aplica tanto a la tarjeta del Aula como a su portada de detalle.

Las tarjetas usan un contenedor visual de altura fija por rango de pantalla, con una imagen cubierta (`object-fit: cover`); por ello, no se estiran según las dimensiones originales de la fotografía. Los emblemas originales de SOMA quedan fuera del recorte, superpuestos en la unión entre imagen y contenido.

Si la fotografía importante queda fuera del recorte, ajustá el encuadre en el CMS antes de recortar la foto original. Las fotos de Aula NO sustituyen a la foto auténtica del facilitador/a.
