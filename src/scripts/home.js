/* Interaksi section halaman utama Horizon: reveal, odometer, About (foto, tanda tangan, kilau), tata surya,
   planisfer zodiak, suara, rasi bintang kontak, dan fase bulan. Inti kodenya diangkat apa adanya dari
   prototipe Horizon v61; datanya dibaca dari JSON yang dirender server. */
import { moonPath } from '../lib/horizon';
import dwarfTexture from '../assets/planets/dwarf.webp?url';
import earthTexture from '../assets/planets/earth.webp?url';
import jupiterTexture from '../assets/planets/jupiter.webp?url';
import marsTexture from '../assets/planets/mars.webp?url';
import mercuryTexture from '../assets/planets/mercury.webp?url';
import neptuneTexture from '../assets/planets/neptune.webp?url';
import saturnTexture from '../assets/planets/saturn.webp?url';
import uranusTexture from '../assets/planets/uranus.webp?url';
import venusTexture from '../assets/planets/venus.webp?url';
import { clamp, seeded, smooth } from './math';
import { scrollToY } from './smooth-scroll';

export function startHome() {
  const app = document;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;
  const stacked = matchMedia('(max-width: 900px)');
  const data = JSON.parse(document.getElementById('home-data').textContent);
  const signs = data.signs;

  /* ---------- pecah judul jadi huruf, dibungkus per kata supaya tidak patah di tengah kata ---------- */
  app.querySelectorAll('main [data-split]:not(.hero [data-split])').forEach((element) => {
    let index = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType !== Node.TEXT_NODE) {
          if (!child.classList.contains('hero__tag')) walk(child);
          return;
        }
        const fragment = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) {
            fragment.append(' ');
            return;
          }
          const word = document.createElement('span');
          word.className = 'word';
          const pieces = element.closest('.hero') ? [part] : [...part];
          pieces.forEach((letter) => {
            const span = document.createElement('span');
            span.className = 'ch';
            span.style.setProperty('--i', String(index++));
            span.textContent = letter;
            word.append(span);
          });
          fragment.append(word);
        });
        child.replaceWith(fragment);
      });
    };
    walk(element);
    element.setAttribute('data-reveal', '');
  });


  /* ---------- reveal ---------- */
  const digitColumn = '01234567890123456789'.split('').map((digit) => `<span>${digit}</span>`).join('');
  app.querySelectorAll('[data-count]').forEach((element) => {
    const text = String(element.dataset.count).padStart(Number(element.dataset.pad || 0), '0');
    const suffix = element.dataset.suffix || '';
    element.setAttribute('aria-label', text + suffix);
    element.innerHTML = [...text].map((digit) => `<span class="odo" aria-hidden="true"><span class="odo__strip" data-digit="${digit}">${digitColumn}</span></span>`).join('') + (suffix ? `<span aria-hidden="true">${suffix}</span>` : '');
  });
  // kolom bergulir satu putaran penuh lalu berhenti di angkanya, digit kiri lebih dulu
  const countUp = (element) => element.querySelectorAll('.odo__strip').forEach((strip, index) => {
    strip.style.transitionDelay = `${0.2 + index * 0.16}s`;
    strip.style.transform = `translateY(${-(10 + Number(strip.dataset.digit)) * 5}%)`;
  });
  const revealItems = [...app.querySelectorAll('[data-reveal]')];
  if (reduce || !('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('is-in'));
    app.querySelectorAll('[data-count]').forEach((element) => {
      element.textContent = String(element.dataset.count).padStart(Number(element.dataset.pad || 0), '0') + (element.dataset.suffix || '');
    });
  } else {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        entry.target.querySelectorAll('[data-count]').forEach(countUp);
        observer.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -10% 0px' });
    revealItems.forEach((item) => {
      if (!item.hasAttribute('data-split')) item.classList.add('is-pending');
      observer.observe(item);
    });
  }

  const note = document.querySelector('.note');

  /* ---------- karya: tata surya; planet aktif meluncur di orbitnya ke depan, yang lain terus mengorbit ---------- */
  const works = app.querySelector('.works');
  const orrery = app.querySelector('.orrery');
  const orrerySky = orrery.querySelector('.orrery__sky');
  const skyContext = orrerySky.getContext('2d');
  const orrerySun = orrery.querySelector('.orrery__sun');
  const planetButtons = [...orrery.querySelectorAll('.orrery__planet')];
  // planet dalam berjarak rapat, planet luar renggang, seperti tata surya asli tapi dipadatkan supaya muat
  const orbitShares = planetButtons.map((_, index) => {
    const solarShares = [0.2, 0.28, 0.36, 0.44, 0.6, 0.73, 0.85, 0.96];
    return index < solarShares.length ? solarShares[index] : 0.96 + (index - solarShares.length + 1) * 0.05;
  });

  /* tekstur permukaan: peta ekuirektangular 256x128 yang sudah dipanggang jadi gambar, dibungkus ke bola lalu diputar.
     Dulu dibangkitkan dari noise di browser dan memakan sekitar 2 detik per planet, membuat scroll macet. */
  const textureWidth = 256;
  const textureHeight = 128;
  const textureUrls = { mercury: mercuryTexture, venus: venusTexture, earth: earthTexture, mars: marsTexture, jupiter: jupiterTexture, saturn: saturnTexture, uranus: uranusTexture, neptune: neptuneTexture, dwarf: dwarfTexture };
  const loadTexture = async (kind) => {
    const image = new Image();
    image.src = textureUrls[kind];
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = textureWidth;
    canvas.height = textureHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0, textureWidth, textureHeight);
    const pixels = context.getImageData(0, 0, textureWidth, textureHeight).data;
    // tutupan awan Bumi disimpan di kanal alpha gambar
    let clouds = null;
    if (kind === 'earth') {
      clouds = new Float32Array(textureWidth * textureHeight);
      for (let index = 0; index < clouds.length; index++) clouds[index] = pixels[index * 4 + 3] / 255;
    }
    return { pixels, clouds };
  };
  const atmospheres = {
    mercury: [0, 0, 0, 0], venus: [255, 232, 190, 0.55], earth: [110, 168, 255, 0.95], mars: [232, 156, 116, 0.3],
    jupiter: [240, 222, 192, 0.3], saturn: [240, 226, 184, 0.3], uranus: [196, 232, 244, 0.55], neptune: [120, 162, 255, 0.7], dwarf: [0, 0, 0, 0],
  };
  // kemiringan poros dalam derajat searah jarum jam di layar, disamakan dengan arah cincin di CSS; putaran dalam piksel tekstur per detik
  const axes = { mercury: [2, 0.8], venus: [-3, -0.4], earth: [23, 5], mars: [25, 4.8], jupiter: [3, 9], saturn: [-14, 8], uranus: [78, -4.5], neptune: [28, 5.5], dwarf: [10, 1] };
  // geometri bola per ukuran kanvas dan kemiringan poros: normal tiap piksel dan koordinat teksturnya
  const geometryCache = new Map();
  const sphereGeometry = (size, axisDegrees) => {
    const key = `${size}:${axisDegrees}`;
    if (geometryCache.has(key)) return geometryCache.get(key);
    const axis = (axisDegrees * Math.PI) / 180;
    const cosine = Math.cos(axis);
    const sine = Math.sin(axis);
    const index = [];
    const normals = [];
    const coords = [];
    const edge = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const sx = ((x + 0.5) / size) * 2 - 1;
        const sy = ((y + 0.5) / size) * 2 - 1;
        const radial = Math.hypot(sx, sy);
        if (radial > 1) continue;
        const sz = Math.sqrt(Math.max(0, 1 - radial * radial));
        // normal di layar dikembalikan ke kerangka planet yang porosnya miring
        const px = cosine * sx + sine * sy;
        const py = -sine * sx + cosine * sy;
        const lat = Math.asin(clamp(-py, -1, 1));
        const lon = Math.atan2(px, sz);
        index.push(y * size + x);
        normals.push(sx, sy, sz);
        coords.push(((lon / (Math.PI * 2) + 0.5) * textureWidth), Math.min(textureHeight - 1, Math.floor((0.5 - lat / Math.PI) * textureHeight)));
        edge.push(clamp((1 - radial) * size * 0.5, 0, 1));
      }
    }
    const geometry = { index: Int32Array.from(index), normals: Float32Array.from(normals), coords: Float32Array.from(coords), edge: Float32Array.from(edge) };
    geometryCache.set(key, geometry);
    return geometry;
  };
  const renderPlanet = (planet, light) => {
    const { context, image, size, texture, kind } = planet;
    const geometry = sphereGeometry(size, axes[kind][0]);
    const data32 = image.data;
    data32.fill(0);
    const [ar, ag, ab, atmosphere] = atmospheres[kind];
    const banded = kind === 'jupiter' || kind === 'saturn' || kind === 'uranus' || kind === 'neptune';
    const spin = planet.spin;
    const cloudSpin = planet.spin * 1.35;
    for (let pixel = 0; pixel < geometry.index.length; pixel++) {
      const nx = geometry.normals[pixel * 3];
      const ny = geometry.normals[pixel * 3 + 1];
      const nz = geometry.normals[pixel * 3 + 2];
      const row = geometry.coords[pixel * 2 + 1];
      const column = (((geometry.coords[pixel * 2] + spin) % textureWidth) + textureWidth) % textureWidth | 0;
      const source = (row * textureWidth + column) * 4;
      let r = texture.pixels[source];
      let g = texture.pixels[source + 1];
      let b = texture.pixels[source + 2];
      if (texture.clouds) {
        const cloudColumn = (((geometry.coords[pixel * 2] + cloudSpin) % textureWidth) + textureWidth) % textureWidth | 0;
        const cover = texture.clouds[row * textureWidth + cloudColumn];
        r += (246 - r) * cover;
        g += (248 - g) * cover;
        b += (252 - b) * cover;
      }
      const facing = nx * light[0] + ny * light[1] + nz * light[2];
      // terminator lembut seperti sore hari, sisi malam nyaris hitam
      const day = smooth(-0.12, 0.3, facing);
      let shade = 0.025 + day * (0.62 + 0.38 * Math.max(0, facing));
      if (banded) shade *= 0.62 + 0.38 * nz;
      const rim = Math.pow(1 - nz, 3) * atmosphere * (0.2 + day);
      const target = geometry.index[pixel] * 4;
      data32[target] = r * shade + ar * rim;
      data32[target + 1] = g * shade + ag * rim;
      data32[target + 2] = b * shade + ab * rim;
      data32[target + 3] = geometry.edge[pixel] * 255;
    }
    context.putImageData(image, 0, 0);
  };

  const planetsState = planetButtons.map((button, index) => {
    const sphere = button.querySelector('.sphere');
    const kind = sphere.className.match(/sphere--(\w+)/)[1];
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    sphere.prepend(canvas);
    return {
      button,
      sphere,
      canvas,
      context: canvas.getContext('2d'),
      kind,
      texture: null,
      image: null,
      size: 0,
      spin: Math.random() * textureWidth,
      rest: Number(button.style.getPropertyValue('--rest')) || 0.3,
      // sebaran sudut awal berdasar rasio emas, jadi planet tidak pernah menumpuk berapa pun jumlahnya
      angle: (index * 2.39996 + 0.6) % (Math.PI * 2),
      // makin jauh dari matahari makin lambat, kira-kira mengikuti hukum Kepler
      speed: 0.16 / Math.pow(orbitShares[index] / orbitShares[0], 1.5),
    };
  });
  // tekstur dimuat saat bagian karya mendekat; dekode gambar terjadi di luar thread utama
  let texturesRequested = false;
  const requestTextures = () => {
    if (texturesRequested) return;
    texturesRequested = true;
    planetsState.forEach((planet) =>
      loadTexture(planet.kind).then((texture) => {
        planet.texture = texture;
        planet.sphere.classList.add('is-textured');
      }),
    );
  };

  // sabuk asteroid utama di antara Mars dan Jupiter, Sabuk Kuiper di luar Neptunus
  const beltRandom = seeded(2026);
  const gaussian = () => (beltRandom() + beltRandom() + beltRandom() - 1.5) / 1.5;
  const makeBelt = (count, share, spread, brightness) => Array.from({ length: count }, () => {
    const orbitShare = share + gaussian() * spread;
    return {
      share: orbitShare,
      angle: beltRandom() * Math.PI * 2,
      lift: gaussian() * 0.012,
      speed: 0.16 / Math.pow(orbitShare / orbitShares[0], 1.5),
      size: 0.5 + Math.pow(beltRandom(), 3) * 1.6,
      tone: brightness * (0.35 + beltRandom() * 0.65),
    };
  });
  const belts = [...makeBelt(620, 0.52, 0.022, 0.85), ...makeBelt(360, 1.05, 0.035, 0.5)];

  const detailItems = [...app.querySelectorAll('.detail')];
  const progressIndex = app.querySelector('.panel__index');
  const progressBar = app.querySelector('.panel__progress i');
  let activeWork = 0;
  const orreryBox = { width: 0, height: 0, cx: 0, cy: 0, reach: 0, ratio: 1 };
  // kemiringan bidang orbit: perbandingan sumbu pendek terhadap sumbu panjang elips
  const tilt = 0.36;
  const viewSine = tilt;
  const viewCosine = Math.sqrt(1 - tilt * tilt);
  const layoutOrrery = () => {
    orreryBox.width = orrery.offsetWidth;
    orreryBox.height = orrery.offsetHeight;
    orreryBox.cx = orreryBox.width / 2;
    orreryBox.cy = orreryBox.height * 0.5;
    orreryBox.reach = Math.min(orreryBox.width * 0.5, 560);
    orreryBox.ratio = Math.min(devicePixelRatio || 1, 2);
    orrerySky.width = Math.round(orreryBox.width * orreryBox.ratio);
    orrerySky.height = Math.round(orreryBox.height * orreryBox.ratio);
    skyContext.setTransform(orreryBox.ratio, 0, 0, orreryBox.ratio, 0, 0);
    orrerySun.style.left = `${orreryBox.cx}px`;
    orrerySun.style.top = `${orreryBox.cy}px`;
  };
  const drawSky = (seconds) => {
    const { cx, cy, reach } = orreryBox;
    skyContext.clearRect(0, 0, orreryBox.width, orreryBox.height);
    // orbit tiap planet; orbit proyek aktif berwarna emas
    orbitShares.forEach((share, index) => {
      skyContext.beginPath();
      skyContext.ellipse(cx, cy, reach * share, reach * share * tilt, 0, 0, Math.PI * 2);
      skyContext.strokeStyle = index === activeWork ? 'rgba(217, 194, 154, 0.42)' : 'rgba(242, 238, 230, 0.075)';
      skyContext.lineWidth = 1;
      skyContext.stroke();
    });
    // jejak lintasan memudar di belakang tiap planet
    planetsState.forEach((planet, index) => {
      const radius = reach * orbitShares[index];
      const steps = 28;
      const length = index === activeWork ? 1.4 : 0.9;
      for (let step = 0; step < steps; step++) {
        const from = planet.angle - length * (1 - step / steps);
        const to = planet.angle - length * (1 - (step + 1) / steps);
        skyContext.beginPath();
        skyContext.ellipse(cx, cy, radius, radius * tilt, 0, from, to);
        const strength = Math.pow((step + 1) / steps, 2);
        skyContext.strokeStyle = index === activeWork ? `rgba(232, 208, 160, ${(strength * 0.85).toFixed(3)})` : `rgba(242, 238, 230, ${(strength * 0.32).toFixed(3)})`;
        skyContext.lineWidth = 1.2 + strength * 0.6;
        skyContext.stroke();
      }
    });
    // butir asteroid; yang di belakang matahari disembunyikan
    skyContext.fillStyle = '#D8CDBA';
    belts.forEach((rock) => {
      rock.angle += rock.speed * seconds;
      const radius = reach * rock.share;
      const x = cx + Math.cos(rock.angle) * radius;
      const y = cy + Math.sin(rock.angle) * radius * tilt + rock.lift * reach;
      const depth = (Math.sin(rock.angle) + 1) / 2;
      if (depth < 0.5 && Math.abs(x - cx) < 26 && Math.abs(y - cy) < 26) return;
      skyContext.globalAlpha = rock.tone * (0.3 + 0.7 * depth);
      skyContext.fillRect(x, y, rock.size, rock.size);
    });
    skyContext.globalAlpha = 1;
  };
  // planet aktif berhenti di kanan agak depan; di orbit dalam ukurannya dibatasi supaya tidak menutupi matahari
  const showcaseAngle = 0.42;
  const placeOrrery = (seconds) => {
    if (stacked.matches || !orreryBox.width) return;
    requestTextures();
    planetsState.forEach((planet, index) => {
      const active = index === activeWork;
      if (active) {
        // selalu maju searah orbit menuju posisi depan, tidak pernah mundur
        const ahead = (((showcaseAngle - planet.angle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        planet.angle += seconds === 0 ? ahead : ahead * Math.min(1, seconds * 2.4);
      } else {
        planet.angle += planet.speed * seconds;
      }
      planet.spin += axes[planet.kind][1] * seconds;
      const radius = orreryBox.reach * orbitShares[index];
      const x = orreryBox.cx + Math.cos(planet.angle) * radius;
      const y = orreryBox.cy + Math.sin(planet.angle) * radius * tilt;
      const depth = (Math.sin(planet.angle) + 1) / 2;
      const fromSun = Math.hypot(x - orreryBox.cx, y - orreryBox.cy);
      const roomy = clamp((2 * (fromSun - 26)) / 124, 0.45, 1);
      const scale = (active ? roomy : planet.rest) * (0.82 + 0.18 * depth);
      const size = planet.button.offsetWidth;
      const sphereHalf = planet.sphere.offsetHeight / 2;
      planet.button.style.transform = `translate(${(x - size / 2).toFixed(1)}px, ${(y - sphereHalf * scale).toFixed(1)}px) scale(${scale.toFixed(3)})`;
      planet.button.style.opacity = (active ? 1 : 0.6 + 0.4 * depth).toFixed(3);
      // di belakang matahari saat berada di separuh atas orbit; planet aktif selalu paling depan supaya labelnya tidak tertutup
      planet.button.style.zIndex = active ? '40' : String(depth > 0.5 ? 20 + Math.round(depth * 10) : 5 + Math.round(depth * 8));
      // arah ke matahari di ruang pandang: sumbu x kanan, y ke bawah layar, z ke arah penonton
      const light = [-Math.cos(planet.angle), -Math.sin(planet.angle) * viewSine, -Math.sin(planet.angle) * viewCosine];
      const towardX = light[0];
      const towardY = light[1] - 0.2;
      const length = Math.hypot(towardX, towardY) || 1;
      planet.sphere.style.setProperty('--lx', `${(50 + (towardX / length) * 30).toFixed(1)}%`);
      planet.sphere.style.setProperty('--ly', `${(50 + (towardY / length) * 30).toFixed(1)}%`);
      if (!planet.texture) return;
      // resolusi kanvas mengikuti ukuran tampil, dibulatkan supaya tidak dibuat ulang tiap frame
      const wanted = clamp(Math.round((124 * scale * Math.min(orreryBox.ratio, 1.5)) / 8) * 8, 16, 192);
      let resized = false;
      if (wanted !== planet.size) {
        planet.size = wanted;
        planet.canvas.width = wanted;
        planet.canvas.height = wanted;
        planet.image = planet.context.createImageData(wanted, wanted);
        resized = true;
      }
      // render per piksel mahal: ulangi hanya kalau putaran atau arah cahaya sudah bergeser cukup untuk terlihat
      const turned = Math.abs(planet.spin - (planet.drawnSpin ?? Infinity)) > 0.6;
      const relit = !planet.drawnLight || light[0] * planet.drawnLight[0] + light[1] * planet.drawnLight[1] + light[2] * planet.drawnLight[2] < 0.9995;
      if (!resized && !turned && !relit) return;
      planet.drawnSpin = planet.spin;
      planet.drawnLight = light;
      renderPlanet(planet, light);
    });
    drawSky(seconds);
  };
  const setActiveWork = (index) => {
    if (index === activeWork) return;
    detailItems[activeWork].classList.remove('is-active');
    detailItems[index].classList.add('is-active');
    activeWork = index;
    progressIndex.textContent = data.projects[index].numeral;
    planetsState.forEach((planet, planetIndex) => planet.button.classList.toggle('is-active', planetIndex === index));
    if (reduce) placeOrrery(0);
  };
  planetsState[0].button.classList.add('is-active');
  // klik planet menggulir halaman ke titik proyek itu, jadi scroll dan klik selalu sepakat
  planetButtons.forEach((button) => {
    if (!button.dataset.work) return;
    button.addEventListener('click', () => {
      const index = Number(button.dataset.work);
      const top = works.getBoundingClientRect().top + scrollY + (index / Math.max(1, data.projects.length - 1)) * (works.offsetHeight - innerHeight) + 2;
      scrollToY(top);
    });
  });

  /* ---------- planisfer zodiak: klik rasi, langit berputar membawanya ke bawah penunjuk ---------- */
  const zodiac = app.querySelector('.zodiac');
  const zodiacWheel = zodiac.querySelector('.zodiac__wheel');
  const zodiacSignEls = [...zodiac.querySelectorAll('.zodiac__sign')];
  const zodiacBodies = zodiacSignEls.map((sign) => sign.querySelector('.zodiac__body'));
  const zodiacCaption = app.querySelector('.zodiac__caption b');
  const kitRows = [...app.querySelectorAll('.kit [data-sign]')];
  let signActive = -1;
  let wheelTurn = 0;
  let wheelTarget = 0;
  let lastPick = -Infinity;
  let nextAuto = 0;
  const drawWheel = () => {
    zodiacWheel.setAttribute('transform', `rotate(${wheelTurn.toFixed(2)} 300 300)`);
    // isi tiap rasi diputar balik supaya nama tetap tegak
    zodiacBodies.forEach((body) => body.setAttribute('transform', `rotate(${(-wheelTurn).toFixed(2)} ${body.dataset.cx} ${body.dataset.cy})`));
  };
  const pickSign = (index) => {
    if (index === signActive) return;
    signActive = index;
    const desired = -index * 90;
    wheelTarget += ((((desired - wheelTarget) % 360) + 540) % 360) - 180;
    zodiacSignEls.forEach((sign, signIndex) => sign.classList.toggle('is-active', signIndex === index));
    kitRows.forEach((row) => row.classList.toggle('is-active', Number(row.dataset.sign) === index));
    zodiacCaption.textContent = signs[index].latin;
    if (reduce) {
      wheelTurn = wheelTarget;
      drawWheel();
    }
  };
  const turnZodiac = (now, seconds) => {
    // berputar sendiri pelan-pelan, berhenti sementara setelah pengunjung memilih
    if (!reduce && now > nextAuto && now - lastPick > 12000) {
      pickSign((signActive + 1) % signs.length);
      nextAuto = now + 6500;
    }
    wheelTurn += (wheelTarget - wheelTurn) * Math.min(1, seconds * 2.6);
    drawWheel();
  };
  const choose = (index) => {
    lastPick = performance.now();
    pickSign(index);
  };
  zodiacSignEls.forEach((sign) => sign.addEventListener('click', () => choose(Number(sign.dataset.sign))));
  kitRows.forEach((row) => row.querySelector('.kit__group').addEventListener('click', () => choose(Number(row.dataset.sign))));
  pickSign(0);
  nextAuto = performance.now() + 6500;
  const highlight = (id) => {
    zodiac.querySelectorAll('[data-skill]').forEach((element) => element.classList.toggle('is-hot', element.dataset.skill === id));
    app.querySelectorAll('.kit button[data-skill]').forEach((button) => button.classList.toggle('is-hot', button.dataset.skill === id));
  };
  app.querySelectorAll('.kit button[data-skill]').forEach((button) => {
    const signIndex = Number(button.closest('[data-sign]').dataset.sign);
    button.addEventListener('pointerenter', () => highlight(button.dataset.skill));
    button.addEventListener('focus', () => highlight(button.dataset.skill));
    button.addEventListener('click', () => {
      choose(signIndex);
      highlight(button.dataset.skill);
    });
    button.addEventListener('pointerleave', () => highlight(null));
    button.addEventListener('blur', () => highlight(null));
  });




  /* ---------- rasi bintang di kontak ---------- */
  const constellationMap = app.querySelector('.constellation');
  // seluruh rasi selalu muat tanpa terpotong; di layar sempit ditaruh di atas supaya tidak menimpa tombol
  const fitConstellation = () => constellationMap.setAttribute('preserveAspectRatio', stacked.matches ? 'xMidYMin meet' : 'xMidYMid meet');
  fitConstellation();
  stacked.addEventListener('change', fitConstellation);
  if (reduce || !('IntersectionObserver' in window)) {
    constellationMap.classList.add('is-drawn');
  } else {
    const constellationObserver = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      constellationMap.classList.add('is-drawn');
      constellationObserver.disconnect();
    }, { threshold: 0.35 });
    constellationObserver.observe(constellationMap);
  }


  /* ---------- scroll ---------- */
  const statementWords = [...app.querySelectorAll('.statement__text:not(.statement__sheen) span')];
  const portrait = app.querySelector('.portrait');
  const signature = app.querySelector('.signature');
  const signStrokes = [...signature.querySelectorAll('animate')];
  // tiap goresan mulai setelah goresan sebelumnya selesai, seperti tangan yang menulis
  const sign = () => signStrokes.forEach((stroke) => {
    // mode gerak dikurangi: langsung tampil utuh tanpa animasi menulis
    if (reduce) stroke.setAttribute('dur', '0.001s');
    stroke.beginElementAt(reduce ? 0 : Number(stroke.dataset.delay));
  });
  if (reduce || !('IntersectionObserver' in window)) {
    sign();
  } else {
    const signObserver = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      sign();
      signObserver.disconnect();
    }, { threshold: 0.5 });
    signObserver.observe(signature);
  }
  if (portrait && finePointer && !reduce) {
    const plate = portrait.querySelector('.portrait__plate');
    plate.addEventListener('pointermove', (event) => {
      const box = plate.getBoundingClientRect();
      const x = ((event.clientX - box.left) / box.width) * 2 - 1;
      const y = ((event.clientY - box.top) / box.height) * 2 - 1;
      // foto bergeser sedikit menjauhi kursor, terasa ada kedalaman di balik bingkai
      portrait.style.setProperty('--px', `${(-x * 6).toFixed(1)}px`);
      portrait.style.setProperty('--py', `${(-y * 6).toFixed(1)}px`);
    });
    plate.addEventListener('pointerleave', () => {
      ['--px', '--py'].forEach((name) => portrait.style.removeProperty(name));
    });
  }
  const statementBox = app.querySelector('.statement__text');
  const statementCopy = app.querySelector('.statement__copy');
  const sheen = statementCopy.querySelector('.statement__sheen');
  if (finePointer && !reduce) {
    statementCopy.addEventListener('pointermove', (event) => {
      const box = statementCopy.getBoundingClientRect();
      sheen.style.setProperty('--x', `${(event.clientX - box.left).toFixed(0)}px`);
      sheen.style.setProperty('--y', `${(event.clientY - box.top).toFixed(0)}px`);
      sheen.style.setProperty('--sheen', '1');
    });
    statementCopy.addEventListener('pointerleave', () => sheen.style.setProperty('--sheen', '0'));
  }
  const moons = [...app.querySelectorAll('.phase')].map((row) => ({ row, lit: row.querySelector('.phase__lit'), phase: Number(row.dataset.phase), drawn: -1 }));
  // bulan hanya dihitung saat Journey dekat layar; di luar itu scroll tidak perlu membaca posisi barisnya
  let journeyNear = false;
  const journey = app.querySelector('.journey');
  if (journey && !reduce) {
    new IntersectionObserver(([entry]) => {
      journeyNear = entry.isIntersecting;
      if (journeyNear) onScroll();
    }, { rootMargin: '50% 0px' }).observe(journey);
  }
  const onScroll = () => {
    if (portrait) {
      const plateBox = portrait.getBoundingClientRect();
      const develop = reduce ? 1 : clamp((innerHeight * 0.95 - plateBox.top) / (plateBox.height * 0.85), 0, 1);
      portrait.style.setProperty('--dev', develop.toFixed(3));
      if (!reduce) portrait.style.setProperty('--drift', `${(clamp((plateBox.top + plateBox.height / 2) / innerHeight - 0.5, -1, 1) * 36).toFixed(1)}px`);
    }

    const box = statementBox.getBoundingClientRect();
    const reading = clamp((innerHeight * 0.85 - box.top) / (box.height + innerHeight * 0.25), 0, 1);
    statementWords.forEach((word, index) => word.style.setProperty('--o', clamp(reading * statementWords.length * 1.2 - index, 0.16, 1).toFixed(2)));

    if (!stacked.matches) {
      const worksBox = works.getBoundingClientRect();
      const progress = clamp(-worksBox.top / (worksBox.height - innerHeight), 0, 1);
      setActiveWork(Math.round(progress * Math.max(0, data.projects.length - 1)));
      progressBar.style.setProperty('--wp', progress.toFixed(3));
    }

    if (journeyNear) {
      // semua posisi dibaca dulu baru ditulis, supaya browser cukup sekali menghitung layout
      const tops = moons.map((moon) => moon.row.getBoundingClientRect().top);
      moons.forEach((moon, index) => {
        const lit = clamp((innerHeight * 0.92 - tops[index]) / (innerHeight * 0.5), 0, 1);
        const phase = Math.round(moon.phase * (1 - Math.pow(1 - lit, 2)) * 200) / 200;
        if (phase === moon.drawn) return;
        moon.drawn = phase;
        moon.lit.setAttribute('d', moonPath(phase));
      });
    }
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => {
    layoutOrrery();
    onScroll();
    placeOrrery(0);
  });
  layoutOrrery();
  onScroll();
  placeOrrery(0);
  drawWheel();
  if (reduce) return;

  // tombol kontak berbentuk planet sedikit tertarik ke kursor yang mendekat
  const cta = app.querySelector('.cta');
  const pull = { x: 0, y: 0 };
  const mouse = { x: 0, y: 0, seen: false };
  addEventListener('pointermove', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    mouse.seen = true;
  });
  // animasi tiap section hanya jalan saat section itu terlihat; dicek lewat observer, bukan mengukur layout tiap frame
  const visible = new Set();
  const watcher = new IntersectionObserver((entries) => entries.forEach((entry) => (entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target))));
  [works, zodiac, cta].forEach((element) => element && watcher.observe(element));
  let previousFrame = null;
  requestAnimationFrame(function frame(now) {
    const stepSeconds = previousFrame === null ? 1 / 60 : Math.min(0.05, (now - previousFrame) / 1000);
    previousFrame = now;
    if (visible.has(works)) placeOrrery(stepSeconds);
    if (visible.has(zodiac)) turnZodiac(now, stepSeconds);
    if (cta && visible.has(cta)) {
      let goalX = 0;
      let goalY = 0;
      if (mouse.seen) {
        const box = cta.getBoundingClientRect();
        const dx = mouse.x - (box.left + box.width / 2);
        const dy = mouse.y - (box.top + box.height / 2);
        if (Math.hypot(dx, dy) < 170) {
          goalX = dx * 0.3;
          goalY = dy * 0.3;
        }
      }
      pull.x += (goalX - pull.x) * 0.1;
      pull.y += (goalY - pull.y) * 0.1;
      cta.style.setProperty('--tx', `${pull.x.toFixed(1)}px`);
      cta.style.setProperty('--ty', `${pull.y.toFixed(1)}px`);
    }
    requestAnimationFrame(frame);
  });
}
