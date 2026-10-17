// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';
import vue from '@astrojs/vue';

// https://astro.build/config
export default defineConfig({
  adapter: cloudflare({
    // gambar sudah di-resize dan di-encode di browser admin sebelum upload
    imageService: 'passthrough',
  }),
  // session admin pakai cookie bertanda tangan, bukan session KV bawaan Astro
  session: false,
  integrations: [
    vue(),
    {
      // styleguide cuma untuk review visual, tidak pernah ikut build production
      name: 'dev-styleguide',
      hooks: {
        'astro:config:setup': ({ command, injectRoute }) => {
          if (command === 'dev') injectRoute({ pattern: '/styleguide', entrypoint: './src/dev/styleguide.astro' });
        },
      },
    },
  ],
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Plus Jakarta Sans',
      cssVariable: '--font-sans',
      weights: ['200 800'],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['sans-serif'],
    },
  ],
});
