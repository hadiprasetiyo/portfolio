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
  // semua font Horizon di-host sendiri lewat Fontsource; font script cuma aksen, jadi tidak di-preload
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Instrument Serif',
      cssVariable: '--font-serif',
      weights: [400],
      styles: ['normal', 'italic'],
      subsets: ['latin'],
      fallbacks: ['serif'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'Geist',
      cssVariable: '--font-sans',
      weights: ['300 600'],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['sans-serif'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'Geist Mono',
      cssVariable: '--font-mono',
      weights: [400, 500],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['monospace'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'Mrs Saint Delafield',
      cssVariable: '--font-script',
      weights: [400],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['cursive'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'Italiana',
      cssVariable: '--font-display',
      weights: [400],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['serif'],
    },
  ],
});
