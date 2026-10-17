-- Data contoh untuk D1 lokal saja. Jangan jalankan ke --remote: konten asli diisi lewat admin.
-- Gagal kalau dijalankan dua kali (UNIQUE), sengaja, supaya tidak menimpa data yang sudah ada.

INSERT INTO profile (id, full_name, headline_en, headline_id, bio_en, bio_id, location, public_email, github_url, linkedin_url) VALUES (
  1,
  'Hadi Prasetiyo',
  'Web developer building data-heavy applications that stay fast on slow connections.',
  'Web developer yang membangun aplikasi sarat data dan tetap cepat di koneksi lambat.',
  'Information Systems graduate who likes the unglamorous parts of software: schema design, query plans, and the forms people actually fill in. I work mostly with PHP and SQL, and I am learning TypeScript by building this site.',
  'Lulusan Sistem Informasi yang suka bagian software yang jarang dipamerkan: desain skema, query plan, dan form yang benar-benar dipakai orang. Sehari-hari pakai PHP dan SQL, dan sedang belajar TypeScript lewat situs ini.',
  'Jakarta, Indonesia',
  'hello@example.com',
  'https://github.com/hadiprasetiyo',
  'https://www.linkedin.com/in/hadiprasetiyo'
);

INSERT INTO skills (id, name, category, sort_order) VALUES
  (1, 'PHP', 'language', 1),
  (2, 'TypeScript', 'language', 2),
  (3, 'SQL', 'language', 3),
  (4, 'Laravel', 'framework', 1),
  (5, 'Vue', 'framework', 2),
  (6, 'Astro', 'framework', 3),
  (7, 'MySQL', 'database', 1),
  (8, 'PostgreSQL', 'database', 2),
  (9, 'SQLite', 'database', 3),
  (10, 'Git', 'tool', 1),
  (11, 'Docker', 'tool', 2),
  (12, 'Cloudflare Workers', 'tool', 3);

INSERT INTO experiences (kind, organization, title_en, title_id, description_en, description_id, location, started_on, ended_on, sort_order) VALUES
  ('work', 'Sample Retail Co.', 'Junior Web Developer', 'Junior Web Developer',
   'Rebuilt the stock reconciliation module in Laravel. Moved nightly batch jobs to indexed queries, cutting the report from two days to forty minutes.',
   'Membangun ulang modul rekonsiliasi stok dengan Laravel. Memindahkan batch job malam ke query berindeks, laporan yang tadinya dua hari jadi empat puluh menit.',
   'Jakarta', '2025-02', NULL, 1),
  ('work', 'Campus IT Office', 'Web Developer Intern', 'Magang Web Developer',
   'Built an internal room booking tool used by four faculties. Replaced a shared spreadsheet that double-booked rooms every week.',
   'Membuat aplikasi peminjaman ruangan untuk empat fakultas. Menggantikan spreadsheet bersama yang membuat ruangan terpesan ganda setiap minggu.',
   'Depok', '2024-06', '2024-12', 2),
  ('education', 'Sample University', 'B.S. Information Systems', 'S1 Sistem Informasi',
   'Thesis on query optimization for reporting workloads on MySQL.',
   'Skripsi tentang optimasi query untuk beban kerja laporan di MySQL.',
   'Depok', '2020-09', '2024-08', 3);

INSERT INTO certifications (name, issuer, issued_on, credential_url, sort_order) VALUES
  ('Sample Cloud Practitioner', 'Sample Cloud Academy', '2025-05', 'https://example.com/credential/123', 1),
  ('Sample Web Developer Path', 'Sample Coding School', '2024-03', NULL, 2);

INSERT INTO projects (id, slug, title_en, title_id, summary_en, summary_id, body_en, body_id, live_url, repo_url, featured, sort_order, published_at) VALUES
  (1, 'inventory-reconciliation',
   'Inventory reconciliation for a retail chain', 'Rekonsiliasi stok untuk jaringan ritel',
   'Cut stock reconciliation from two days to forty minutes by moving counts to a shared database.',
   'Rekonsiliasi stok dari dua hari jadi empat puluh menit dengan memindahkan hitungan ke database bersama.',
   '## Problem

Each store counted stock in its own spreadsheet. Head office merged them by hand every month, and the numbers never matched.

## What I built

- A Laravel app where stores submit counts directly
- Indexed reporting queries instead of a nightly batch job
- A mismatch view that shows only the items that need a recount

## Result

The monthly report went from **two days** to **forty minutes**.

<script>alert("raw html harus di-escape")</script>',
   '## Masalah

Setiap toko menghitung stok di spreadsheet masing-masing. Kantor pusat menggabungkannya manual setiap bulan, dan angkanya tidak pernah cocok.

## Yang saya bangun

- Aplikasi Laravel tempat toko mengirim hitungan langsung
- Query laporan berindeks, menggantikan batch job malam
- Tampilan selisih yang hanya menunjukkan barang yang perlu dihitung ulang

## Hasil

Laporan bulanan dari **dua hari** jadi **empat puluh menit**.',
   NULL, 'https://github.com/hadiprasetiyo/sample-inventory', 1, 1, '2025-08-01T00:00:00Z'),
  (2, 'room-booking',
   'Room booking for four faculties', 'Peminjaman ruangan untuk empat fakultas',
   'Replaced a shared spreadsheet that double-booked rooms every week.',
   'Menggantikan spreadsheet bersama yang membuat ruangan terpesan ganda setiap minggu.',
   'A booking tool with a database constraint that makes double booking impossible, not just unlikely. [Try a bad link](javascript:alert(1)).',
   'Aplikasi peminjaman dengan constraint database yang membuat pesanan ganda mustahil, bukan sekadar jarang terjadi.',
   'https://example.com', NULL, 0, 2, '2024-12-15T00:00:00Z'),
  (3, 'draft-project',
   'Unpublished draft', 'Draft belum terbit',
   'This project must not appear anywhere on the public site.', 'Proyek ini tidak boleh muncul di situs publik.',
   '', '', NULL, NULL, 0, 3, NULL);

INSERT INTO project_skill (project_id, skill_id) VALUES
  (1, 1), (1, 4), (1, 7),
  (2, 5), (2, 9), (2, 2);
