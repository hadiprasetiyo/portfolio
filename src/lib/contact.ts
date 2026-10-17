import { isLocale, type Locale } from '../i18n';

export type ContactField = 'name' | 'email' | 'message';

export type ContactResult =
  | { status: 'valid'; message: { name: string; email: string; body: string; locale: Locale }; locale: Locale }
  | { status: 'invalid'; fields: ContactField[]; locale: Locale }
  | { status: 'spam'; locale: Locale };

// field jebakan: tersembunyi dari manusia, diisi bot
export const HONEYPOT_FIELD = 'website';

const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;
const CONTROL_EXCEPT_NEWLINE_TAB = /[\u0000-\u0008\u000B-\u001F\u007F]/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(form: FormData, field: string): string {
  const value = form.get(field);
  return typeof value === 'string' ? value.trim() : '';
}

export function validateContact(form: FormData): ContactResult {
  const requestedLocale = text(form, 'locale');
  const locale: Locale = isLocale(requestedLocale) ? requestedLocale : 'en';
  if (text(form, HONEYPOT_FIELD) !== '') return { status: 'spam', locale };

  const name = text(form, 'name');
  const email = text(form, 'email');
  const body = text(form, 'message');
  const fields: ContactField[] = [];

  if (name.length < 1 || name.length > 100 || CONTROL_CHARACTERS.test(name)) fields.push('name');
  if (email.length > 254 || !EMAIL.test(email) || CONTROL_CHARACTERS.test(email)) fields.push('email');
  if (body.length < 1 || body.length > 2000 || CONTROL_EXCEPT_NEWLINE_TAB.test(body)) fields.push('message');

  if (fields.length > 0) return { status: 'invalid', fields, locale };
  return { status: 'valid', message: { name, email, body, locale }, locale };
}

export async function verifyTurnstile(token: string, secret: string, ip: string | null): Promise<boolean> {
  if (!token) return false;
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}
