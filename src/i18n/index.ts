import en from './en.json';
import id from './id.json';

export const LOCALES = ['en', 'id'] as const;
export type Locale = (typeof LOCALES)[number];
export type Dictionary = typeof en;

// tipe id.json dipaksa sama dengan en.json, jadi kunci yang lupa diterjemahkan gagal saat typecheck
const dictionaries: Record<Locale, Dictionary> = { en, id };

export function isLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale);
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export function localized<Row, Key extends string>(row: Row, field: Key, locale: Locale): string {
  return (row as Record<string, string>)[`${field}_${locale}`] ?? '';
}

export function formatMonth(value: string, locale: Locale): string {
  const [year, month] = value.split('-').map(Number);
  if (!month) return String(year);
  return new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}
