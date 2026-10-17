import { env } from 'cloudflare:workers';

export type Locale = 'en' | 'id';

export type Theme = {
  id: number;
  name: string;
  color_bg: string;
  color_text: string;
  color_accent: string;
  color_highlight: string;
};

export type Settings = {
  default_locale: Locale;
  theme_id: number;
};

export async function getThemes(): Promise<Theme[]> {
  const { results } = await env.DB.prepare(
    'SELECT id, name, color_bg, color_text, color_accent, color_highlight FROM themes ORDER BY sort_order',
  ).all<Theme>();
  return results;
}

export async function getSettings(): Promise<Settings> {
  const settings = await env.DB.prepare('SELECT default_locale, theme_id FROM settings WHERE id = 1').first<Settings>();
  if (!settings) throw new Error('Baris settings tidak ada, jalankan migration dulu');
  return settings;
}
