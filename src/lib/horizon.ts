// Pembentuk markup halaman utama Horizon. Hasilnya disisipkan dengan set:html, jadi semua teks dari database wajib lewat escapeHtml.

export const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// fase bulan: f 0 = bulan baru, 0.5 = separuh, 1 = purnama; sisi kanan yang menyala
export const moonPath = (f: number, r = 30, cx = 36, cy = 36) => {
  if (f <= 0.001) return '';
  if (f >= 0.999) return `M${cx} ${cy - r}A${r} ${r} 0 1 1 ${cx} ${cy + r}A${r} ${r} 0 1 1 ${cx} ${cy - r}Z`;
  const rx = (r * Math.abs(1 - 2 * f)).toFixed(2);
  return `M${cx} ${cy - r}A${r} ${r} 0 0 1 ${cx} ${cy + r}A${rx} ${r} 0 0 ${f < 0.5 ? 0 : 1} ${cx} ${cy - r}Z`;
};

// tiap kata dibungkus span supaya bisa menyala satu per satu saat dibaca
export const wordSpans = (text: string) =>
  text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `<span>${escapeHtml(word)}</span>`)
    .join(' ');

/* ---------- tata surya: proyek ke-n menempati planet ke-n dari matahari ---------- */
export type SolarBody = { name: string; size: number; ring?: boolean; dwarf?: boolean };

const solar: SolarBody[] = [
  { name: 'Mercury', size: 0.38 },
  { name: 'Venus', size: 0.58 },
  { name: 'Earth', size: 0.6 },
  { name: 'Mars', size: 0.46 },
  { name: 'Jupiter', size: 1 },
  { name: 'Saturn', size: 0.86, ring: true },
  { name: 'Uranus', size: 0.7, ring: true },
  { name: 'Neptune', size: 0.68 },
];

export const SOLAR_PLANET_COUNT = solar.length;
export const bodyFor = (index: number): SolarBody => solar[index] ?? { name: 'Dwarf planet', size: 0.3, dwarf: true };

const planetRings =
  '<span class="ring ring--back" aria-hidden="true"><span class="ring__disc"></span></span><span class="ring ring--front" aria-hidden="true"><span class="ring__disc"></span></span>';

export const planetMarkup = (index: number) => {
  const body = bodyFor(index);
  return `<span class="sphere sphere--${body.dwarf ? 'dwarf' : body.name.toLowerCase()}">${body.ring ? planetRings : ''}</span>`;
};

// planet aktif digambar 124px; saat tidak aktif mengecil sebanding ukuran relatif planet aslinya
export const planetStyle = (index: number) => `--size:124px;--rest:${(0.12 + bodyFor(index).size * 0.32).toFixed(3)}`;

export const toRoman = (value: number) => {
  const numerals: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let rest = value;
  let result = '';
  for (const [amount, numeral] of numerals) {
    while (rest >= amount) {
      result += numeral;
      rest -= amount;
    }
  }
  return result;
};

/* ---------- planisfer zodiak ---------- */
export const astroTicks = () =>
  Array.from({ length: 72 }, (_, index) => {
    const degree = index * 5;
    const angle = (degree * Math.PI) / 180;
    const length = degree % 30 === 0 ? 14 : 6;
    const x1 = 300 + Math.cos(angle) * 288;
    const y1 = 300 + Math.sin(angle) * 288;
    const x2 = 300 + Math.cos(angle) * (288 - length);
    const y2 = 300 + Math.sin(angle) * (288 - length);
    const label =
      degree % 30 === 0
        ? `<text class="astro__deg" x="${(300 + Math.cos(angle) * 258).toFixed(1)}" y="${(300 + Math.sin(angle) * 258 + 3).toFixed(1)}" text-anchor="middle">${String(degree).padStart(3, '0')}°</text>`
        : '';
    return `<line class="astro__tick" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"></line>${label}`;
  }).join('');

export type SignSkill = { id: string; name: string };
export type Sign = { group: string; latin: string; skills: SignSkill[] };

// pola rasi dibuat dari jumlah skill: bintang bernama di jalur zig-zag, ditambah satu atau dua bintang pembentuk pola
const signPattern = (count: number, seed: number) => {
  let state = seed;
  const random = () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
  const total = count + (count < 3 ? 2 : 1);
  const stars = Array.from({ length: total }, (_, index) => {
    const t = total === 1 ? 0.5 : index / (total - 1);
    return [-58 + t * 116, (index % 2 ? -1 : 1) * (10 + random() * 22) + (random() - 0.5) * 10] as [number, number];
  });
  const lines = stars.slice(1).map((_, index) => [index, index + 1] as [number, number]);
  // satu cabang dari bintang tengah supaya bentuknya tidak sekadar garis lurus
  if (total >= 4) lines.push([Math.floor(total / 2), total - 1 - (total % 2)]);
  // bintang bernama disebar merata di sepanjang jalur (total selalu lebih banyak dari count, jadi posisinya tidak bentrok)
  const named = new Map<number, number>();
  for (let index = 0; index < count; index++) named.set(count === 1 ? Math.floor(total / 2) : Math.round((index * (total - 1)) / (count - 1)), index);
  return { stars, lines, named };
};

export const zodiacSigns = (signs: Sign[]) =>
  signs
    .map((sign, index) => {
      const angle = ((index * (360 / signs.length) - 90) * Math.PI) / 180;
      const cx = 300 + Math.cos(angle) * 140;
      const cy = 300 + Math.sin(angle) * 140;
      const { stars, lines, named } = signPattern(sign.skills.length, 97 + index * 131);
      const at = (star: [number, number]) => [cx + star[0], cy + star[1]];
      const path = lines.map(([from, to]) => `M${at(stars[from]).map((v) => v.toFixed(1)).join(' ')}L${at(stars[to]).map((v) => v.toFixed(1)).join(' ')}`).join('');
      const starMarkup = stars
        .map((star, starIndex) => {
          const [x, y] = at(star);
          const skillIndex = named.get(starIndex);
          const skill = skillIndex === undefined ? undefined : sign.skills[skillIndex];
          return (
            `<circle class="zodiac__star"${skill ? ` data-skill="${skill.id}"` : ''} cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${skill ? 3.6 : 1.8}"></circle>` +
            (skill ? `<text class="zodiac__name" data-skill="${skill.id}" x="${(x + 9).toFixed(1)}" y="${(y - 8).toFixed(1)}">${escapeHtml(skill.name)}</text>` : '')
          );
        })
        .join('');
      return `<g class="zodiac__sign" data-sign="${index}"><g class="zodiac__body" data-cx="${cx.toFixed(1)}" data-cy="${cy.toFixed(1)}"><circle class="zodiac__hit" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="74"></circle><path class="zodiac__lines" pathLength="1" d="${path}"></path>${starMarkup}<text class="zodiac__title" x="${cx.toFixed(1)}" y="${(cy + 76).toFixed(1)}" text-anchor="middle">${sign.latin}</text><text class="zodiac__sub" x="${cx.toFixed(1)}" y="${(cy + 91).toFixed(1)}" text-anchor="middle">${escapeHtml(sign.group.toUpperCase())}</text></g></g>`;
    })
    .join('');
