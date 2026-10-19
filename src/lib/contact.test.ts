import { describe, expect, it } from 'vitest';
import { validateContact } from './contact';

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const valid = { name: 'Rina', email: 'rina@example.com', message: 'Halo, ada lowongan backend.', locale: 'id' };

describe('validateContact', () => {
  it('menerima input yang benar dan merapikan spasi', () => {
    const result = validateContact(form({ ...valid, name: '  Rina  ' }));
    expect(result).toEqual({ status: 'valid', message: { name: 'Rina', email: 'rina@example.com', body: valid.message, locale: 'id' }, locale: 'id' });
  });

  it('honeypot terisi dianggap spam, tanpa memberi tahu field mana yang salah', () => {
    expect(validateContact(form({ ...valid, website: 'https://spam.example' }))).toEqual({ status: 'spam', locale: 'id' });
  });

  it('honeypot dicek sebelum validasi, jadi bot tidak bisa belajar dari pesan error', () => {
    expect(validateContact(form({ website: 'x' })).status).toBe('spam');
  });

  it('menandai semua field yang kosong sekaligus', () => {
    expect(validateContact(form({ locale: 'en' }))).toEqual({ status: 'invalid', fields: ['name', 'email', 'message'], locale: 'en' });
  });

  it('menegakkan batas panjang yang sama dengan constraint database', () => {
    expect(validateContact(form({ ...valid, name: 'a'.repeat(100) })).status).toBe('valid');
    expect(validateContact(form({ ...valid, name: 'a'.repeat(101) }))).toMatchObject({ fields: ['name'] });
    expect(validateContact(form({ ...valid, message: 'a'.repeat(2000) })).status).toBe('valid');
    expect(validateContact(form({ ...valid, message: 'a'.repeat(2001) }))).toMatchObject({ fields: ['message'] });
    expect(validateContact(form({ ...valid, email: `${'a'.repeat(250)}@b.co` }))).toMatchObject({ fields: ['email'] });
  });

  it('menolak email yang formatnya salah', () => {
    for (const email of ['rina', 'rina@', '@example.com', 'rina@example', 'ri na@example.com']) {
      expect(validateContact(form({ ...valid, email }))).toMatchObject({ fields: ['email'] });
    }
  });

  it('menolak karakter kontrol, tapi pesan boleh berisi baris baru', () => {
    expect(validateContact(form({ ...valid, name: 'Rina\u0000' }))).toMatchObject({ fields: ['name'] });
    expect(validateContact(form({ ...valid, email: 'rina@example.com\r\nBcc: x@y.z' }))).toMatchObject({ fields: ['email'] });
    expect(validateContact(form({ ...valid, message: 'baris satu\nbaris dua\n\tterindentasi' })).status).toBe('valid');
    expect(validateContact(form({ ...valid, message: 'bel \u0007' }))).toMatchObject({ fields: ['message'] });
  });

  it('locale yang tidak dikenal jatuh ke en', () => {
    expect(validateContact(form({ ...valid, locale: 'fr' }))).toMatchObject({ status: 'valid', message: { locale: 'en' } });
  });
});
