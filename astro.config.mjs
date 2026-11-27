import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import icon from 'astro-icon';
import sitemap from '@astrojs/sitemap';

function readContent(folder) {
  const cwd = fileURLToPath(new URL('.', import.meta.url));
  return globSync('src/content/' + folder + '/**/*.json', { cwd })
    .map(file => JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8')));
}

const aulasWithCourses = new Set(readContent('cursos').filter(course => course.published).map(course => course.aula));
const excludedPaths = new Set(['/mensajes/', '/politica-de-privacidad/', '/terminos-y-condiciones/']);
for (const aula of readContent('aulas')) {
  if (aula.launchStatus === 'upcoming' && !aulasWithCourses.has(aula.slug)) {
    excludedPaths.add('/aulas/' + aula.slug + '/');
  }
}

export default defineConfig({
  site: 'https://soma-consciente.com',
  // No base path: the custom domain serves SOMA at /, not /soma-consciente/.
  output: 'static',
  trailingSlash: 'always',
  integrations: [
    icon(),
    sitemap({
      filter: page => {
        const pathname = new URL(page).pathname;
        return !excludedPaths.has(pathname) && !/^\/encuentros\/[^/]+\/solicitud\//.test(pathname);
      },
    }),
  ],
});
