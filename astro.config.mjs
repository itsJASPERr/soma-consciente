import { defineConfig } from 'astro/config';
import icon from 'astro-icon';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://soma-consciente.com',
  // No base path: the custom domain serves SOMA at /, not /soma-consciente/.
  output: 'static',
  trailingSlash: 'always',
  integrations: [
    icon(),
    sitemap({
      filter: page => !['/mensajes/', '/terminos-y-condiciones/'].includes(new URL(page).pathname),
    }),
  ],
});
