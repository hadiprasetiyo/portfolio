import { describe, expect, it } from 'vitest';
import { wordSpans } from './horizon';

describe('wordSpans', () => {
  it('teks biasa jadi satu span per kata', () => {
    expect(wordSpans('  schema  design ')).toBe('<span>schema</span> <span>design</span>');
  });

  it('frasa di antara bintang jadi em, tanda baca sesudahnya tetap menempel', () => {
    expect(wordSpans('likes *schema design*, query')).toBe('<span>likes</span> <em>schema</em> <em>design</em><span>,</span> <span>query</span>');
  });

  it('bintang tanpa pasangan tetap tampil apa adanya dan html di-escape', () => {
    expect(wordSpans('5 * 3 <b>')).toBe('<span>5</span> <span>*</span> <span>3</span> <span>&lt;b&gt;</span>');
  });
});
