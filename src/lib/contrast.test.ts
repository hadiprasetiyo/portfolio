import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, findContrastFailures } from './contrast';

const passingTheme = { bg: '#FCFCFD', text: '#0F172A', accent: '#3B5B85', highlight: '#D4B46A' };

describe('contrastRatio', () => {
  it('mengikuti nilai acuan WCAG', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
  });

  it('tidak bergantung pada urutan warna', () => {
    expect(contrastRatio('#3B5B85', '#FCFCFD')).toBe(contrastRatio('#FCFCFD', '#3B5B85'));
  });
});

describe('findContrastFailures', () => {
  it('meloloskan tema yang semua pasangannya >= 4.5', () => {
    expect(findContrastFailures(passingTheme)).toEqual([]);
  });

  it('menolak gold sebagai warna link di atas putih', () => {
    expect(findContrastFailures({ ...passingTheme, accent: '#D4B46A' })).toEqual(['accent/bg']);
  });

  it('menolak teks terang di atas highlight', () => {
    expect(findContrastFailures({ ...passingTheme, text: '#FFFFFF', bg: '#0F172A' })).toContain('text/highlight');
  });

  it('tidak mengecek highlight terhadap bg', () => {
    expect(contrastRatio(passingTheme.highlight, passingTheme.bg)).toBeLessThan(3);
    expect(findContrastFailures(passingTheme)).toEqual([]);
  });
});

describe('preset tema di migration', () => {
  const migration = readFileSync(new URL('../../migrations/0001_initial.sql', import.meta.url), 'utf8');
  const presets = [...migration.matchAll(/\(\d+, '([^']+)',\s*'(#\w{6})', '(#\w{6})', '(#\w{6})', '(#\w{6})'/g)];

  it('ada tiga preset', () => {
    expect(presets.map((row) => row[1])).toEqual(['Clean Slate', 'Executive Precision', 'Hybrid']);
  });

  it.each(presets.map((row) => [row[1], row]))('%s lolos semua cek kontras', (_name, row) => {
    const [, , bg, text, accent, highlight] = row as RegExpMatchArray;
    expect(findContrastFailures({ bg, text, accent, highlight })).toEqual([]);
  });
});
