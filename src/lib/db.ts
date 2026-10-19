import { env } from 'cloudflare:workers';
import type { Locale } from '../i18n';

export type Settings = {
  default_locale: Locale;
};

export type Profile = {
  full_name: string;
  headline_en: string;
  headline_id: string;
  bio_en: string;
  bio_id: string;
  location: string;
  public_email: string;
  github_url: string | null;
  linkedin_url: string | null;
};

export type Skill = {
  id: number;
  name: string;
  category: 'language' | 'framework' | 'database' | 'tool';
};

export type Experience = {
  id: number;
  kind: 'work' | 'education';
  organization: string;
  title_en: string;
  title_id: string;
  description_en: string;
  description_id: string;
  location: string;
  started_on: string;
  ended_on: string | null;
};

export type Certification = {
  id: number;
  name: string;
  issuer: string;
  issued_on: string;
  credential_url: string | null;
};

export type Media = {
  kv_key: string;
  mime: string;
  width: number | null;
  height: number | null;
  size_bytes: number;
  created_at: string;
};

export type Project = {
  id: number;
  slug: string;
  title_en: string;
  title_id: string;
  summary_en: string;
  summary_id: string;
  body_en: string;
  body_id: string;
  cover_alt_en: string;
  cover_alt_id: string;
  cover_key: string | null;
  cover_width: number | null;
  cover_height: number | null;
  live_url: string | null;
  repo_url: string | null;
  featured: number;
  published_at: string;
  skills: string[];
};

export async function getSettings(): Promise<Settings> {
  const settings = await env.DB.prepare('SELECT default_locale FROM settings WHERE id = 1').first<Settings>();
  if (!settings) throw new Error('Baris settings tidak ada, jalankan migration dulu');
  return settings;
}

export async function getProfile(): Promise<Profile | null> {
  return env.DB.prepare(
    'SELECT full_name, headline_en, headline_id, bio_en, bio_id, location, public_email, github_url, linkedin_url FROM profile WHERE id = 1',
  ).first<Profile>();
}

// urutan kategori sengaja manual (bahasa dulu), bukan abjad
export async function getSkills(): Promise<Skill[]> {
  const { results } = await env.DB.prepare(`SELECT s.id, s.name, s.category FROM skills s ORDER BY CASE s.category WHEN 'language' THEN 1 WHEN 'framework' THEN 2 WHEN 'database' THEN 3 ELSE 4 END, s.sort_order`).all<Skill>();
  return results;
}

export async function getExperiences(): Promise<Experience[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, kind, organization, title_en, title_id, description_en, description_id, location, started_on, ended_on
     FROM experiences ORDER BY sort_order, started_on DESC`,
  ).all<Experience>();
  return results;
}

export async function getCertifications(): Promise<Certification[]> {
  const { results } = await env.DB.prepare(
    'SELECT id, name, issuer, issued_on, credential_url FROM certifications ORDER BY sort_order, issued_on DESC',
  ).all<Certification>();
  return results;
}

// draft (published_at NULL) tidak pernah keluar dari query ini
export async function getPublishedProjects(): Promise<Project[]> {
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.slug, p.title_en, p.title_id, p.summary_en, p.summary_id, p.body_en, p.body_id,
            p.cover_alt_en, p.cover_alt_id, m.kv_key AS cover_key, m.width AS cover_width, m.height AS cover_height,
            p.live_url, p.repo_url, p.featured, p.published_at,
            COALESCE((SELECT json_group_array(s.name) FROM (
              SELECT s.name FROM project_skill ps JOIN skills s ON s.id = ps.skill_id
              WHERE ps.project_id = p.id ORDER BY CASE s.category WHEN 'language' THEN 1 WHEN 'framework' THEN 2 WHEN 'database' THEN 3 ELSE 4 END, s.sort_order) s), '[]') AS skills
     FROM projects p
     LEFT JOIN media m ON m.id = p.cover_media_id
     WHERE p.published_at IS NOT NULL
     ORDER BY p.featured DESC, p.sort_order, p.published_at DESC`,
  ).all<Omit<Project, 'skills'> & { skills: string }>();
  return results.map((row) => ({ ...row, skills: JSON.parse(row.skills) as string[] }));
}

export type CvFile = Media & { pages: Media[] };

// CV bahasa Indonesia jatuh ke versi Inggris kalau belum diupload
export async function getCv(locale: Locale): Promise<CvFile | null> {
  for (const candidate of locale === 'id' ? (['id', 'en'] as const) : (['en'] as const)) {
    const file = await env.DB.prepare(
      `SELECT m.kv_key, m.mime, m.width, m.height, m.size_bytes, m.created_at
       FROM profile p JOIN media m ON m.id = p.cv_${candidate}_media_id WHERE p.id = 1`,
    ).first<Media>();
    if (!file) continue;
    const { results: pages } = await env.DB.prepare(
      `SELECT m.kv_key, m.mime, m.width, m.height, m.size_bytes, m.created_at
       FROM cv_pages c JOIN media m ON m.id = c.media_id WHERE c.locale = ? ORDER BY c.page_number`,
    )
      .bind(candidate)
      .all<Media>();
    return { ...file, pages };
  }
  return null;
}

export async function getMediaByKey(key: string): Promise<Media | null> {
  return env.DB.prepare('SELECT kv_key, mime, width, height, size_bytes, created_at FROM media WHERE kv_key = ?').bind(key).first<Media>();
}

export async function insertMessage(message: { name: string; email: string; body: string; locale: Locale }): Promise<void> {
  await env.DB.prepare('INSERT INTO messages (name, email, body, locale) VALUES (?, ?, ?, ?)')
    .bind(message.name, message.email, message.body, message.locale)
    .run();
}
