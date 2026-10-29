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
// kata atau frasa di antara *bintang* jadi <em>: emas mengkilap dan tidak ikut menyala saat dibaca
export const wordSpans = (text: string) => {
  const parts = text.split('*');
  // bintang tanpa pasangan dianggap huruf biasa
  if (parts.length % 2 === 0) parts.splice(-2, 2, `${parts.at(-2)}*${parts.at(-1)}`);
  let html = '';
  parts.forEach((part, index) => {
    const tag = index % 2 ? 'em' : 'span';
    for (const piece of part.split(/(\s+)/)) {
      if (piece) html += /^\s/.test(piece) ? ' ' : `<${tag}>${escapeHtml(piece)}</${tag}>`;
    }
  });
  return html.trim();
};

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
// 0° di puncak dan bertambah searah jarum jam, seperti dial astronomi dan navbar
const dialPoint = (radius: number, degree: number) => {
  const angle = (degree * Math.PI) / 180;
  return [300 + Math.sin(angle) * radius, 300 - Math.cos(angle) * radius].map((value) => value.toFixed(1));
};

// pinggiran tetap: skala tiap 1° bertingkat dan angka derajat yang selalu tegak
export const astroLimb = () => {
  let html =
    '<defs><linearGradient id="astro-metal" gradientUnits="userSpaceOnUse" x1="70" y1="40" x2="530" y2="560"><stop offset="0" stop-color="#fff4de"></stop><stop offset="0.3" stop-color="#d9c29a"></stop><stop offset="0.55" stop-color="#7d6a4b"></stop><stop offset="0.78" stop-color="#cdb68d"></stop><stop offset="1" stop-color="#6b5a3f"></stop></linearGradient></defs>' +
    '<circle class="astro__hair" cx="300" cy="300" r="295"></circle><circle class="astro__metal" cx="300" cy="300" r="290"></circle><circle class="astro__ring" cx="300" cy="300" r="268"></circle><circle class="astro__ring astro__ring--dash" cx="300" cy="300" r="56"></circle>';
  for (let degree = 0; degree < 360; degree++) {
    const tier = degree % 30 === 0 ? 'major' : degree % 10 === 0 ? 'mid' : degree % 5 === 0 ? 'five' : 'one';
    const [x1, y1] = dialPoint({ major: 268, mid: 277, five: 280.5, one: 284 }[tier], degree);
    const [x2, y2] = dialPoint(290, degree);
    html += `<line class="astro__tick astro__tick--${tier}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"></line>`;
    if (tier !== 'major') continue;
    const [x, y] = dialPoint(253, degree);
    html += `<text class="astro__deg" x="${x}" y="${(Number(y) + 3).toFixed(1)}" text-anchor="middle">${String(degree).padStart(3, '0')}°</text>`;
  }
  return html;
};

// pita ekliptika yang berputar pelan sendiri: titik tiap 2° dan tanda belah ketupat di tengah tiap rumah zodiak
export const astroBand = () => {
  let html = '<circle class="astro__band-ring" cx="300" cy="300" r="236"></circle><circle class="astro__dots" cx="300" cy="300" r="228"></circle>';
  for (let house = 0; house < 12; house++) {
    const degree = house * 30 + 15;
    const [x, y] = dialPoint(236, degree);
    html += `<path class="astro__house" d="M0 -4L2.2 0L0 4L-2.2 0Z" transform="translate(${x} ${y}) rotate(${degree})"></path>`;
  }
  return html;
};

export type SignSkill = { id: string; name: string };
export type Sign = { group: string; latin: string; skills: SignSkill[] };

type Pattern = { stars: [number, number][]; lines: [number, number][]; order: number[] };

// bentuk rasi yang dirancang sendiri-sendiri supaya tiap kelompok skill mudah dibedakan; order = bintang yang diberi nama, berurutan
const patterns: Pattern[] = [
  // huruf W seperti Cassiopeia
  { stars: [[-60, -14], [-30, 18], [0, -6], [30, 20], [58, -18]], lines: [[0, 1], [1, 2], [2, 3], [3, 4]], order: [0, 2, 4, 1, 3] },
  // gayung bertangkai seperti Biduk
  {
    stars: [[-60, -26], [-38, -18], [-16, -8], [4, -2], [36, -8], [40, 24], [8, 26]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]],
    order: [0, 4, 6, 2, 5, 1, 3],
  },
  // salib seperti Cygnus
  {
    stars: [[0, -38], [-52, 8], [-26, 4], [0, 0], [24, -4], [50, -8], [0, 36]],
    lines: [[0, 3], [3, 6], [1, 2], [2, 3], [3, 4], [4, 5]],
    order: [0, 5, 6, 1, 3, 2, 4],
  },
  // layang-layang berekor seperti Corvus
  { stars: [[-28, -28], [26, -32], [36, 8], [-18, 14], [-54, 36]], lines: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4]], order: [1, 4, 0, 2, 3] },
  // busur mahkota seperti Corona Borealis
  {
    stars: [[-58, 4], [-42, -20], [-15, -32], [15, -32], [42, -20], [58, 4]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]],
    order: [0, 3, 5, 1, 4, 2],
  },
  // bahu, sabuk, dan kaki seperti Orion
  {
    stars: [[-34, -34], [30, -30], [-12, 0], [0, -2], [12, -4], [-32, 32], [30, 30]],
    lines: [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]],
    order: [0, 6, 3, 1, 5, 2, 4],
  },
];

// kalau skill dalam satu kelompok lebih banyak dari bintang bernama di bentuknya, pakai pola zig-zag yang dibangkitkan
const signPattern = (count: number, seed: number, index: number) => {
  const pattern = patterns[index % patterns.length];
  if (count <= pattern.order.length) {
    const named = new Map<number, number>();
    pattern.order.slice(0, count).forEach((star, skill) => named.set(star, skill));
    return { stars: pattern.stars, lines: pattern.lines, named };
  }
  return generatedPattern(count, seed);
};

// pola cadangan dibuat dari jumlah skill: bintang bernama di jalur zig-zag, ditambah satu atau dua bintang pembentuk pola
const generatedPattern = (count: number, seed: number) => {
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

// nama skill menjauhi pusat rasi: bintang di kiri bernama di kirinya, di kanan di kanannya, di tengah di atasnya
const nameAt = (x: number, y: number) => {
  if (x < -25) return `x="${(x - 9).toFixed(1)}" y="${(y - 8).toFixed(1)}" text-anchor="end"`;
  if (x > 25) return `x="${(x + 9).toFixed(1)}" y="${(y - 8).toFixed(1)}"`;
  return `x="${x.toFixed(1)}" y="${(y - 13).toFixed(1)}" text-anchor="middle"`;
};

// tiap rasi elemen HTML sendiri di atas roda: roda dan rasi diputar berlawanan lewat CSS supaya dikerjakan GPU dan nama tetap tegak
export const zodiacSigns = (signs: Sign[]) =>
  signs
    .map((sign, index) => {
      const angle = ((index * (360 / signs.length) - 90) * Math.PI) / 180;
      const cx = 300 + Math.cos(angle) * 140;
      const cy = 300 + Math.sin(angle) * 140;
      const { stars, lines, named } = signPattern(sign.skills.length, 97 + index * 131, index);
      const path = lines.map(([from, to]) => `M${stars[from].map((v) => v.toFixed(1)).join(' ')}L${stars[to].map((v) => v.toFixed(1)).join(' ')}`).join('');
      const starMarkup = stars
        .map(([x, y], starIndex) => {
          const skillIndex = named.get(starIndex);
          const skill = skillIndex === undefined ? undefined : sign.skills[skillIndex];
          return (
            `<circle class="zodiac__star"${skill ? ` data-skill="${skill.id}"` : ''} cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${skill ? 3.6 : 1.8}"></circle>` +
            (skill ? `<text class="zodiac__name" data-skill="${skill.id}" ${nameAt(x, y)}>${escapeHtml(skill.name)}</text>` : '')
          );
        })
        .join('');
      // kotak rasi 200 satuan dari roda 600, jadi sepertiga lebar roda
      const left = (((cx - 100) / 600) * 100).toFixed(3);
      const top = (((cy - 100) / 600) * 100).toFixed(3);
      return `<div class="zodiac__sign" data-sign="${index}" style="left:${left}%;top:${top}%"><svg viewBox="-100 -100 200 200"><path class="zodiac__lines" pathLength="1" d="${path}"></path>${starMarkup}<text class="zodiac__title" y="76" text-anchor="middle">${sign.latin}</text><text class="zodiac__sub" y="91" text-anchor="middle">${escapeHtml(sign.group.toUpperCase())}</text></svg></div>`;
    })
    .join('');
