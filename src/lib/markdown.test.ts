import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('merender markdown biasa', () => {
    expect(renderMarkdown('## Judul\n\n**tebal**')).toContain('<h2>Judul</h2>');
    expect(renderMarkdown('**tebal**')).toContain('<strong>tebal</strong>');
  });

  it('meng-escape HTML mentah, blok maupun inline', () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\nteks <img src=x onerror=alert(1)> lagi');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&#60;script&#62;');
  });

  it('membuang link dengan protokol berbahaya tapi tetap menampilkan teksnya', () => {
    for (const href of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,x', 'vbscript:x']) {
      const html = renderMarkdown(`[klik](${href})`);
      expect(html).not.toContain('<a');
      expect(html).toContain('klik');
    }
  });

  it('mempertahankan link aman, dan link eksternal diberi noopener', () => {
    expect(renderMarkdown('[a](https://example.com)')).toContain('<a href="https://example.com" rel="noopener noreferrer">a</a>');
    expect(renderMarkdown('[a](/en/cv)')).toContain('<a href="/en/cv">a</a>');
    expect(renderMarkdown('[a](mailto:hi@example.com)')).toContain('href="mailto:hi@example.com"');
  });

  it('meng-escape kutip di href supaya tidak bisa keluar dari atribut', () => {
    expect(renderMarkdown('[a](https://example.com/"onmouseover="alert(1))')).not.toContain('"onmouseover="');
  });

  it('gambar dengan protokol berbahaya diganti teks alt', () => {
    const html = renderMarkdown('![diagram](javascript:alert(1))');
    expect(html).not.toContain('<img');
    expect(html).toContain('diagram');
  });
});
