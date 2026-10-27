import { defineConfig } from 'astro/config';
import icon from 'astro-icon';

export default defineConfig({
  site: 'https://itsjasperr.github.io',
  base: '/soma-consciente',
  output: 'static',
  trailingSlash: 'always',
  integrations: [icon()]
});
