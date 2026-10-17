import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getMediaByKey } from '../../lib/db';

export const prerender = false;

// hanya key yang tercatat di tabel media yang disajikan, dengan content type dari database, bukan dari isi file
export const GET: APIRoute = async ({ params, url }) => {
  const key = params.key ?? '';
  const media = await getMediaByKey(key);
  if (!media) return new Response('Not found', { status: 404 });

  const file = await env.MEDIA.get(key, 'stream');
  if (!file) return new Response('Not found', { status: 404 });

  const download = media.mime === 'application/pdf' && url.searchParams.has('download');
  return new Response(file, {
    headers: {
      'Content-Type': media.mime,
      'Content-Length': String(media.size_bytes),
      // key acak dan tidak pernah dipakai ulang, jadi aman di-cache selamanya
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Disposition': download ? 'attachment; filename="cv.pdf"' : 'inline',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
};
