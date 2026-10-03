// @ts-check
import { defineConfig } from 'astro/config';

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
  integrations: [vue()],
});
