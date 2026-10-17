import { Marked, type Tokens } from 'marked';

const SAFE_URL = /^(https?:|mailto:|\/|#)/i;

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

// Konten datang dari admin, tapi kalau session admin bocor, ini yang mencegah stored XSS di situs publik.
const marked = new Marked({
  gfm: true,
  renderer: {
    html({ text }: Tokens.HTML | Tokens.Tag) {
      return escapeHtml(text);
    },
    link({ href, title, tokens }: Tokens.Link) {
      const label = this.parser.parseInline(tokens);
      if (!SAFE_URL.test(href.trim())) return label;
      const external = /^https?:/i.test(href) ? ' rel="noopener noreferrer"' : '';
      const titleAttribute = title ? ` title="${escapeHtml(title)}"` : '';
      return `<a href="${escapeHtml(href)}"${titleAttribute}${external}>${label}</a>`;
    },
    image({ href, title, text }: Tokens.Image) {
      if (!SAFE_URL.test(href.trim())) return escapeHtml(text);
      const titleAttribute = title ? ` title="${escapeHtml(title)}"` : '';
      return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text)}"${titleAttribute} loading="lazy" decoding="async">`;
    },
  },
});

export function renderMarkdown(source: string): string {
  return marked.parse(source, { async: false });
}
