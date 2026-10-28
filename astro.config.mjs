import { defineConfig } from 'astro/config';
import icon from 'astro-icon';

export default defineConfig({
  site: 'https://www.soma-consciente.com',
  // No base path: the custom domain serves SOMA at /, not /soma-consciente/.
  output: 'static',
  trailingSlash: 'always',
  integrations: [icon()]
});
