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
// roda 600 satuan ditambah 26 di tiap sisi untuk cincin zodiak di luar skala derajat; semua lapisan memakai viewBox yang sama
const ASTRO_PAD = 26;
export const ASTRO_VIEW = `${-ASTRO_PAD} ${-ASTRO_PAD} ${600 + ASTRO_PAD * 2} ${600 + ASTRO_PAD * 2}`;
const zodiacNames = ['ARIES', 'TAURUS', 'GEMINI', 'CANCER', 'LEO', 'VIRGO', 'LIBRA', 'SCORPIUS', 'SAGITTARIUS', 'CAPRICORNUS', 'AQUARIUS', 'PISCES'];
// 0° di puncak dan bertambah searah jarum jam, seperti dial astronomi dan navbar
const dialPoint = (radius: number, degree: number) => {
  const angle = (degree * Math.PI) / 180;
  return [300 + Math.sin(angle) * radius, 300 - Math.cos(angle) * radius].map((value) => value.toFixed(1));
};

// pinggiran tetap: skala tiap 1° bertingkat dan angka derajat yang selalu tegak
export const astroLimb = () => {
  let html =
    '<defs><linearGradient id="astro-metal" gradientUnits="userSpaceOnUse" x1="70" y1="40" x2="530" y2="560"><stop offset="0" stop-color="#fff4de"></stop><stop offset="0.3" stop-color="#d9c29a"></stop><stop offset="0.55" stop-color="#7d6a4b"></stop><stop offset="0.78" stop-color="#cdb68d"></stop><stop offset="1" stop-color="#6b5a3f"></stop></linearGradient></defs>' +
    '<circle class="astro__hair" cx="300" cy="300" r="295"></circle><circle class="astro__metal" cx="300" cy="300" r="290"></circle><circle class="astro__ring" cx="300" cy="300" r="268"></circle>';
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

// pita zodiak yang berputar pelan sendiri: titik tiap 2° dan tanda belah ketupat di tengah tiap rumah zodiak
export const astroBand = () => {
  let html = '<circle class="astro__band-ring" cx="300" cy="300" r="236"></circle><circle class="astro__dots" cx="300" cy="300" r="228"></circle>';
  for (let house = 0; house < 12; house++) {
    const degree = house * 30 + 15;
    const [x, y] = dialPoint(236, degree);
    html += `<path class="astro__house" d="M0 -4L2.2 0L0 4L-2.2 0Z" transform="translate(${x} ${y}) rotate(${degree})"></path>`;
  }
  return html;
};

// cincin zodiak ikut berputar bersama roda seperti cakram bintang planisfer, jadi rasi terpilih selalu tiba di bawah namanya sendiri
const zodiacRing = () => {
  // bingkai luar: lis emas yang terputus di tiap batas rumah lalu diberi bintang (titik ekuinoks dan titik balik lebih besar), dan untaian manik seperti tepi koin
  let html =
    '<circle class="astro__metal astro__fillet" cx="300" cy="300" r="318" pathLength="360"></circle><circle class="astro__beads" cx="300" cy="300" r="324" pathLength="360"></circle>';
  zodiacNames.forEach((name, house) => {
    const from = house * 30;
    const [x1, y1] = dialPoint(290, from);
    const [x2, y2] = dialPoint(311, from);
    const [px, py] = dialPoint(318, from);
    html += `<line class="astro__tick astro__tick--major" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"></line>`;
    const spark = from % 90 ? 'M0 -5L1.1 -1.1L5 0L1.1 1.1L0 5L-1.1 1.1L-5 0L-1.1 -1.1Z' : 'M0 -8L1.7 -1.7L5 0L1.7 1.7L0 8L-1.7 1.7L-5 0L-1.7 -1.7Z';
    html += `<path class="astro__spark" d="${spark}" transform="translate(${px} ${py}) rotate(${from})"></path>`;
    // tiap nama ditulis dua arah; yang di separuh bawah memakai versi berlawanan arah seperti inskripsi koin, dipilih skrip setelah roda berputar
    const middle = from + 15;
    html += `<g class="astro__sign${middle > 90 && middle < 270 ? ' is-flipped' : ''}">`;
    for (const lower of [false, true]) {
      const radius = lower ? 309 : 301;
      const [sx, sy] = dialPoint(radius, lower ? from + 28 : from + 2);
      const [ex, ey] = dialPoint(radius, lower ? from + 2 : from + 28);
      const id = `zodiac-arc-${house}${lower ? '-low' : ''}`;
      html += `<path id="${id}" d="M${sx} ${sy}A${radius} ${radius} 0 0 ${lower ? 0 : 1} ${ex} ${ey}" fill="none"></path>`;
      html += `<text${lower ? ' data-lower' : ''}><textPath href="#${id}" startOffset="50%" text-anchor="middle">${name}</textPath></text>`;
    }
    html += '</g>';
  });
  return html;
};

// peta langit di roda, ikut berputar bersama rasi: bintang latar, kisi jam dan deklinasi, ekliptika, dan kutub langit di pusat
export const astroChart = () => {
  let state = 2026;
  const random = () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
  const spokes = Array.from({ length: 12 }, (_, hour) => {
    const [x1, y1] = dialPoint(64, hour * 30);
    const [x2, y2] = dialPoint(214, hour * 30);
    return `M${x1} ${y1}L${x2} ${y2}`;
  }).join('');
  // sebaran merata di cincin antara pusat dan pita: akar acak supaya tidak menumpuk di tengah
  const stars = Array.from({ length: 120 }, () => {
    const radius = Math.sqrt(64 * 64 + random() * (216 * 216 - 64 * 64));
    const [x, y] = dialPoint(radius, random() * 360);
    const bright = random() ** 4;
    return `<circle cx="${x}" cy="${y}" r="${(0.5 + bright * 1.3).toFixed(2)}" opacity="${(0.18 + bright * 0.55).toFixed(2)}"></circle>`;
  }).join('');
  return (
    `<svg class="zodiac__chart" viewBox="${ASTRO_VIEW}">` +
    `<g class="zodiac__field">${stars}</g>` +
    '<circle class="zodiac__grid" cx="300" cy="300" r="112"></circle><circle class="zodiac__grid" cx="300" cy="300" r="176"></circle>' +
    `<path class="zodiac__spokes" d="${spokes}"></path>` +
    // ekliptika dibuat sepusat dengan kutub; versi bergeser yang akurat terbaca seperti lingkaran yang meleset
    '<circle class="zodiac__ecliptic" cx="300" cy="300" r="144"></circle>' +
    '<circle class="zodiac__pole" cx="300" cy="300" r="52"></circle>' +
    zodiacRing() +
    '</svg>'
  );
};

export type SignSkill = { id: string; name: string };
export type Sign = { group: string; skills: SignSkill[] };

type Pattern = { name: string; stars: [number, number][]; lines: [number, number][]; order: number[] };

// empat zodiak tetap yang rumahnya berjarak tepat 90°; bentuknya disederhanakan, kepala menghadap barat (kanan) seperti peta langit
// order = bintang yang diberi nama, berurutan
const patterns: Pattern[] = [
  // huruf V Hyades dengan mata Aldebaran, dua tanduk, dan gugus Pleiades di depannya
  {
    name: 'TAURUS',
    stars: [[-6, 14], [-50, -34], [48, -26], [-50, 18], [18, 4], [-6, -8], [36, 22], [55, -21], [42, -20], [52, -33]],
    lines: [[4, 5], [5, 1], [4, 0], [0, 3], [4, 6]],
    order: [0, 1, 2, 3, 4, 6, 5],
  },
  // sabit Regulus sampai Rasalas, badan sampai ekor Denebola
  {
    name: 'LEO',
    stars: [[30, 22], [28, 6], [34, -8], [32, -22], [44, -32], [56, -22], [-22, -10], [-22, 12], [-56, 0]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 6], [6, 8], [8, 7], [7, 0]],
    order: [0, 8, 4, 6, 7, 2, 5, 3, 1],
  },
  // kepala tiga bintang, jantung Antares, ekor melengkung sampai sengat Shaula
  {
    name: 'SCORPIUS',
    stars: [[52, -34], [50, -20], [46, -6], [34, -18], [22, -12], [12, -4], [4, 10], [-2, 24], [-14, 34], [-30, 34], [-42, 24], [-48, 8], [-38, 0], [-28, 4]],
    lines: [[0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13]],
    order: [4, 13, 0, 8, 10, 1, 6],
  },
  // bahu Albali sampai Sadalmelik, kendi air bercabang, dan aliran air yang turun ke kiri
  {
    name: 'AQUARIUS',
    stars: [[56, -12], [32, -22], [6, -34], [-10, -28], [-22, -32], [-34, -38], [-26, -18], [2, -6], [-18, 8], [16, 30], [-34, 20], [-46, 34]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [4, 6], [2, 7], [7, 8], [7, 9], [8, 10], [10, 11]],
    order: [2, 0, 11, 9, 5, 1, 8],
  },
];

// nama rasi asli untuk kartus; kelompok dengan skill lebih banyak dari bintang bernama tetap memakai nama ini walau bentuknya zig-zag
export const constellationName = (index: number) => patterns[index % patterns.length].name;
// rasi duduk di tengah rumahnya sendiri di cincin zodiak, mis. Leo di 135°
export const signDegree = (index: number) => zodiacNames.indexOf(constellationName(index)) * 30 + 15;

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
      const [cx, cy] = dialPoint(140, signDegree(index)).map(Number);
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
      // kotak rasi 200 satuan di dalam viewBox yang diperlebar cincin zodiak; lebarnya di CSS (.zodiac__sign) harus sama
      const span = 600 + ASTRO_PAD * 2;
      const left = (((cx - 100 + ASTRO_PAD) / span) * 100).toFixed(3);
      const top = (((cy - 100 + ASTRO_PAD) / span) * 100).toFixed(3);
      return `<div class="zodiac__sign" data-sign="${index}" style="left:${left}%;top:${top}%"><svg viewBox="-100 -100 200 200"><path class="zodiac__lines" pathLength="1" d="${path}"></path>${starMarkup}<text class="zodiac__title" y="76" text-anchor="middle">${escapeHtml(sign.group)}</text><text class="zodiac__sub" y="91" text-anchor="middle">${constellationName(index)}</text></svg></div>`;
    })
    .join('');
