-- Skema awal. Sebelum rilis, file ini diubah langsung, jangan tambah migration baru.

CREATE TABLE settings (
  id             INTEGER PRIMARY KEY CHECK (id = 1),
  default_locale TEXT    NOT NULL DEFAULT 'en' CHECK (default_locale IN ('en', 'id')),
  updated_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

CREATE TABLE media (
  id         INTEGER PRIMARY KEY,
  kv_key     TEXT    NOT NULL UNIQUE,
  mime       TEXT    NOT NULL CHECK (mime IN ('image/webp', 'image/avif', 'image/jpeg', 'image/png', 'application/pdf')),
  width      INTEGER,
  height     INTEGER,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  -- PDF tidak punya dimensi, gambar wajib punya supaya tidak ada layout shift
  CHECK ((mime = 'application/pdf') = (width IS NULL AND height IS NULL))
) STRICT;

CREATE TABLE profile (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  full_name       TEXT    NOT NULL,
  headline_en     TEXT    NOT NULL DEFAULT '',
  headline_id     TEXT    NOT NULL DEFAULT '',
  bio_en          TEXT    NOT NULL DEFAULT '',
  bio_id          TEXT    NOT NULL DEFAULT '',
  location        TEXT    NOT NULL DEFAULT '',
  public_email    TEXT    NOT NULL DEFAULT '',
  avatar_media_id INTEGER REFERENCES media (id) ON DELETE SET NULL,
  github_url      TEXT,
  linkedin_url    TEXT,
  cv_en_media_id  INTEGER REFERENCES media (id) ON DELETE SET NULL,
  cv_id_media_id  INTEGER REFERENCES media (id) ON DELETE SET NULL
) STRICT;

CREATE TABLE cv_pages (
  locale      TEXT    NOT NULL CHECK (locale IN ('en', 'id')),
  page_number INTEGER NOT NULL CHECK (page_number >= 1),
  media_id    INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
  PRIMARY KEY (locale, page_number)
) STRICT;

CREATE TABLE skills (
  id         INTEGER PRIMARY KEY,
  name       TEXT    NOT NULL UNIQUE,
  category   TEXT    NOT NULL CHECK (category IN ('language', 'framework', 'database', 'tool')),
  sort_order INTEGER NOT NULL DEFAULT 0
) STRICT;

CREATE TABLE experiences (
  id             INTEGER PRIMARY KEY,
  kind           TEXT    NOT NULL CHECK (kind IN ('work', 'education')),
  organization   TEXT    NOT NULL,
  title_en       TEXT    NOT NULL,
  title_id       TEXT    NOT NULL,
  description_en TEXT    NOT NULL DEFAULT '',
  description_id TEXT    NOT NULL DEFAULT '',
  location       TEXT    NOT NULL DEFAULT '',
  started_on     TEXT    NOT NULL,
  ended_on       TEXT    CHECK (ended_on IS NULL OR ended_on >= started_on),
  sort_order     INTEGER NOT NULL DEFAULT 0
) STRICT;

CREATE TABLE certifications (
  id             INTEGER PRIMARY KEY,
  name           TEXT    NOT NULL,
  issuer         TEXT    NOT NULL,
  issued_on      TEXT    NOT NULL,
  credential_url TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 0
) STRICT;

CREATE TABLE projects (
  id             INTEGER PRIMARY KEY,
  slug           TEXT    NOT NULL UNIQUE CHECK (slug <> '' AND slug NOT GLOB '*[^a-z0-9-]*'),
  title_en       TEXT    NOT NULL,
  title_id       TEXT    NOT NULL,
  summary_en     TEXT    NOT NULL DEFAULT '',
  summary_id     TEXT    NOT NULL DEFAULT '',
  body_en        TEXT    NOT NULL DEFAULT '',
  body_id        TEXT    NOT NULL DEFAULT '',
  cover_media_id INTEGER REFERENCES media (id) ON DELETE SET NULL,
  cover_alt_en   TEXT    NOT NULL DEFAULT '',
  cover_alt_id   TEXT    NOT NULL DEFAULT '',
  live_url       TEXT,
  repo_url       TEXT,
  featured       INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  sort_order     INTEGER NOT NULL DEFAULT 0,
  published_at   TEXT,
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

CREATE TABLE project_skill (
  project_id INTEGER NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  skill_id   INTEGER NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, skill_id)
) STRICT;

CREATE TABLE messages (
  id         INTEGER PRIMARY KEY,
  name       TEXT    NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  email      TEXT    NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  body       TEXT    NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  locale     TEXT    NOT NULL CHECK (locale IN ('en', 'id')),
  read_at    TEXT,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

-- Data wajib, bukan data dummy: situs tidak bisa render tanpa baris settings.
INSERT INTO settings (id, default_locale) VALUES (1, 'en');
