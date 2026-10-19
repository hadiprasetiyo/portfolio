import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getDictionary } from '../../i18n';
import { validateContact, verifyTurnstile } from '../../lib/contact';
import { insertMessage } from '../../lib/db';

export const prerender = false;

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

export const POST: APIRoute = async ({ request, url }) => {
  // tolak POST yang dikirim dari situs lain
  if (request.headers.get('Origin') !== url.origin) {
    return Response.json({ fields: [] }, { status: 403 });
  }

  const form = await request.formData();
  const result = validateContact(form);
  const wantsJson = request.headers.get('Accept')?.includes('application/json') ?? false;
  const reply = (status: number, body: { fields: string[] }) => {
    if (wantsJson) return Response.json(body, { status });
    // tanpa JS: halaman kecil berisi hasilnya dan link kembali
    const dictionary = getDictionary(result.locale).contact;
    const text = status === 200 ? dictionary.sent : body.fields.includes('captcha') ? dictionary.errors.captcha : dictionary.invalid;
    return new Response(
      `<!doctype html><html lang="${result.locale}"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(text)}</title><p>${escapeHtml(text)}</p><p><a href="/${result.locale}/#contact">←</a></p>`,
      { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  };

  // bot yang mengisi honeypot dapat jawaban sukses supaya tidak mencoba cara lain
  if (result.status === 'spam') return reply(200, { fields: [] });
  if (result.status === 'invalid') return reply(400, { fields: result.fields });

  const token = form.get('cf-turnstile-response');
  const human = await verifyTurnstile(typeof token === 'string' ? token : '', env.TURNSTILE_SECRET_KEY, request.headers.get('CF-Connecting-IP'));
  if (!human) return reply(400, { fields: ['captcha'] });

  await insertMessage(result.message);
  return reply(200, { fields: [] });
};
