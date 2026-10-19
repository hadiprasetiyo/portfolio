import { prefersReducedMotion, seeded, smooth, unit, valueNoise } from './math';
import { makeRockBody, shadeBody, type RockBody } from './rock';

/* Langit global di belakang semua section: bintang yang berkelip dan ber-parallax, nebula samar,
   asteroid hanyut, meteor sesekali, dan komet jauh. */

type Star = { x: number; y: number; depth: number; size: number; phase: number; speed: number; color: string };
type Drifter = { body: RockBody; x: number; y: number; depth: number; vx: number; vy: number; size: number; alpha: number; spin: number; spinRate: number };
type Meteor = { x: number; y: number; vx: number; vy: number; length: number; age: number; life: number };

export function startSky(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d')!;
  const reduce = prefersReducedMotion();
  const narrow = matchMedia('(max-width: 900px)').matches;
  let width = 0;
  let height = 0;
  let stars: Star[] = [];

  // nebula biru malam dan mawar, sengaja berambang tinggi supaya hanya muncul di beberapa gumpal dan langit tetap hitam
  const paintNebula = () => {
    const scale = 8;
    const columns = Math.ceil(width / scale);
    const rows = Math.ceil(height / scale);
    const small = document.createElement('canvas');
    small.width = columns;
    small.height = rows;
    const smallContext = small.getContext('2d')!;
    const image = smallContext.createImageData(columns, rows);
    const noise = valueNoise(seeded(20260));
    const fbm = (x: number, y: number) => {
      let total = 0;
      let amount = 0.5;
      for (let octave = 0; octave < 4; octave++) {
        total += noise(x, y) * amount;
        x = x * 2.03 + 1.7;
        y = y * 2.03 + 3.1;
        amount *= 0.5;
      }
      return total / 0.94;
    };
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        const u = (x / columns) * 3.2 * (width / Math.max(height, 1));
        const v = (y / rows) * 3.2;
        const dust = fbm(u * 1.4 + 9, v * 1.4);
        const midnight = smooth(0.66, 0.95, fbm(u * 0.9, v * 0.9 + 4));
        const rose = smooth(0.71, 0.97, fbm(u * 1.1 + 13, v * 1.1 + 7));
        const offset = (y * columns + x) * 4;
        image.data[offset] = 6 + dust * 1.5 + midnight * 3 + rose * 20;
        image.data[offset + 1] = 6 + dust * 1.5 + midnight * 6 + rose * 5;
        image.data[offset + 2] = 9 + dust * 2 + midnight * 20 + rose * 9;
        image.data[offset + 3] = 255;
      }
    }
    smallContext.putImageData(image, 0, 0);
    // direntangkan lewat blur supaya tidak terlihat kotak-kotak
    const soft = document.createElement('canvas');
    soft.width = Math.ceil(width / 2);
    soft.height = Math.ceil(height / 2);
    const softContext = soft.getContext('2d')!;
    softContext.fillStyle = '#07070A';
    softContext.fillRect(0, 0, soft.width, soft.height);
    softContext.filter = 'blur(10px)';
    softContext.drawImage(small, -8, -8, soft.width + 16, soft.height + 16);
    canvas.style.setProperty('--nebula', `url(${soft.toDataURL('image/jpeg', 0.92)})`);
  };

  const resize = () => {
    const ratio = Math.min(2, devicePixelRatio || 1);
    width = innerWidth;
    height = innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    stars = Array.from({ length: Math.round((width * height) / 5200) }, () => {
      const depth = Math.random();
      // campuran bintang hangat dan kebiruan, sama seperti langit di sekitar lubang hitam
      const warm = Math.random() > 0.35;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        depth,
        size: 0.3 + depth * 1.1,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 1.4,
        color: warm ? '242, 230, 210' : '210, 222, 255',
      };
    });
    paintNebula();
  };

  // cahaya datang dari kiri atas, dari arah lubang hitam di halaman pertama
  const light = unit([-0.5, -0.72, 0.48]);
  const spawnDrifter = (anywhere: boolean): Drifter => {
    const depth = 0.35 + Math.random() * 0.65;
    return {
      body: makeRockBody(depth > 0.7 ? 48 : 32),
      x: anywhere ? Math.random() * width : -40,
      y: height * (0.06 + Math.random() * 0.88),
      depth,
      vx: (6 + depth * 16) * (0.8 + Math.random() * 0.4),
      vy: (Math.random() - 0.5) * 4,
      size: 3 + depth * 11,
      alpha: 0.35 + depth * 0.55,
      spin: Math.random() * Math.PI * 2,
      spinRate: (Math.random() - 0.5) * 0.5,
    };
  };

  resize();
  addEventListener('resize', resize);
  const drifters = Array.from({ length: narrow ? 3 : 5 }, () => spawnDrifter(true));
  const meteors: Meteor[] = [];
  let meteorWait = 3;
  const comet = { active: false, wait: 6, x: 0, y: 0, vx: 0, vy: 0 };
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  addEventListener('pointermove', (event) => {
    pointer.x = (event.clientX - innerWidth / 2) / innerWidth;
    pointer.y = (event.clientY - innerHeight / 2) / innerHeight;
  });

  const drawDrifter = (rock: Drifter, dt: number, scrolled: number) => {
    rock.x += rock.vx * dt;
    // yang lebih dekat bergeser lebih jauh saat scroll, jadi terasa ada kedalaman
    rock.y += rock.vy * dt - scrolled * (0.05 + rock.depth * 0.25);
    if (rock.y < -60) rock.y += height + 120;
    if (rock.y > height + 60) rock.y -= height + 120;
    rock.spin += rock.spinRate * dt;
    if (rock.x > width + 40) Object.assign(rock, spawnDrifter(false));
    const c = Math.cos(rock.spin);
    const s = Math.sin(rock.spin);
    shadeBody(rock.body, [c * light[0] + s * light[1], -s * light[0] + c * light[1], light[2]], 0);
    context.save();
    context.globalAlpha = rock.alpha;
    context.translate(rock.x, rock.y);
    context.rotate(rock.spin);
    context.drawImage(rock.body.canvas, -rock.size, -rock.size, rock.size * 2, rock.size * 2);
    context.restore();
  };

  const drawMeteors = (dt: number) => {
    meteorWait -= dt;
    if (meteorWait <= 0) {
      const angle = ((22 + Math.random() * 16) * Math.PI) / 180;
      const speed = 520 + Math.random() * 320;
      meteors.push({ x: width * (0.35 + Math.random() * 0.65), y: height * Math.random() * 0.35, vx: -Math.cos(angle) * speed, vy: Math.sin(angle) * speed, length: 80 + Math.random() * 80, age: 0, life: 0.8 + Math.random() * 0.5 });
      meteorWait = 6 + Math.random() * 6;
    }
    context.globalCompositeOperation = 'lighter';
    for (let index = meteors.length - 1; index >= 0; index--) {
      const meteor = meteors[index];
      meteor.age += dt;
      meteor.x += meteor.vx * dt;
      meteor.y += meteor.vy * dt;
      const progress = meteor.age / meteor.life;
      if (progress >= 1) {
        meteors.splice(index, 1);
        continue;
      }
      const envelope = Math.sin(Math.PI * progress);
      const speed = Math.hypot(meteor.vx, meteor.vy);
      const tailX = meteor.x - (meteor.vx / speed) * meteor.length * envelope;
      const tailY = meteor.y - (meteor.vy / speed) * meteor.length * envelope;
      const normalX = (-meteor.vy / speed) * 1.2;
      const normalY = (meteor.vx / speed) * 1.2;
      const streak = context.createLinearGradient(meteor.x, meteor.y, tailX, tailY);
      streak.addColorStop(0, 'rgba(255, 248, 232, 0.9)');
      streak.addColorStop(0.3, 'rgba(255, 236, 206, 0.4)');
      streak.addColorStop(1, 'rgba(255, 230, 200, 0)');
      context.globalAlpha = envelope;
      context.fillStyle = streak;
      context.beginPath();
      context.moveTo(tailX, tailY);
      context.lineTo(meteor.x + normalX, meteor.y + normalY);
      context.lineTo(meteor.x - normalX, meteor.y - normalY);
      context.closePath();
      context.fill();
    }
    context.globalCompositeOperation = 'source-over';
    context.globalAlpha = 1;
  };

  // komet jauh yang melintas pelan; kedua ekornya membuntuti arah gerak supaya tidak terlihat terbalik
  const drawComet = (dt: number) => {
    if (!comet.active) {
      comet.wait -= dt;
      if (comet.wait > 0) return;
      const fromLeft = Math.random() > 0.5;
      const speed = 34 + Math.random() * 18;
      Object.assign(comet, { active: true, x: fromLeft ? -180 : width + 180, y: height * (0.1 + Math.random() * 0.3), vx: fromLeft ? speed : -speed, vy: speed * (0.12 + Math.random() * 0.16) });
    }
    comet.x += comet.vx * dt;
    comet.y += comet.vy * dt;
    if (comet.x < -220 || comet.x > width + 220) {
      comet.active = false;
      comet.wait = 16 + Math.random() * 10;
      return;
    }
    const speed = Math.hypot(comet.vx, comet.vy);
    const backX = -comet.vx / speed;
    const backY = -comet.vy / speed;
    const sideX = -backY;
    const sideY = backX;
    context.globalCompositeOperation = 'lighter';
    const tail = (length: number, spread: number, bend: number, color: (alpha: number) => string) => {
      const endX = comet.x + backX * length + sideX * bend;
      const endY = comet.y + backY * length + sideY * bend;
      const gradient = context.createLinearGradient(comet.x, comet.y, endX, endY);
      gradient.addColorStop(0, color(0.5));
      gradient.addColorStop(1, color(0));
      context.fillStyle = gradient;
      context.beginPath();
      context.moveTo(comet.x + sideX * 1.2, comet.y + sideY * 1.2);
      context.quadraticCurveTo(comet.x + backX * length * 0.5 + sideX * (spread + bend * 0.3), comet.y + backY * length * 0.5 + sideY * (spread + bend * 0.3), endX + sideX * spread, endY + sideY * spread);
      context.lineTo(endX - sideX * spread * 0.4, endY - sideY * spread * 0.4);
      context.quadraticCurveTo(comet.x + backX * length * 0.5 - sideX * spread * 0.4, comet.y + backY * length * 0.5 - sideY * spread * 0.4, comet.x - sideX * 1.2, comet.y - sideY * 1.2);
      context.closePath();
      context.fill();
    };
    tail(150, 9, 14, (alpha) => `rgba(255, 226, 184, ${alpha * 0.55})`);
    tail(210, 2.5, 0, (alpha) => `rgba(236, 232, 255, ${alpha * 0.5})`);
    const coma = context.createRadialGradient(comet.x, comet.y, 0, comet.x, comet.y, 9);
    coma.addColorStop(0, 'rgba(255, 250, 238, 0.95)');
    coma.addColorStop(0.25, 'rgba(255, 236, 206, 0.45)');
    coma.addColorStop(1, 'rgba(255, 236, 206, 0)');
    context.fillStyle = coma;
    context.beginPath();
    context.arc(comet.x, comet.y, 9, 0, Math.PI * 2);
    context.fill();
    context.globalCompositeOperation = 'source-over';
  };

  let previous = 0;
  let lastScroll = scrollY;
  const draw = (now: number) => {
    const dt = previous ? Math.min(0.05, (now - previous) / 1000) : 0;
    previous = now;
    const scrolled = scrollY - lastScroll;
    lastScroll = scrollY;
    context.clearRect(0, 0, width, height);
    pointer.sx += (pointer.x - pointer.sx) * 0.03;
    pointer.sy += (pointer.y - pointer.sy) * 0.03;
    for (const star of stars) {
      const shift = 0.04 + star.depth * 0.22;
      const x = (((star.x - pointer.sx * shift * 30) % width) + width) % width;
      const y = (((star.y - scrollY * shift) % height) + height) % height;
      const glow = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now * 0.001 * star.speed + star.phase));
      context.fillStyle = `rgba(${star.color}, ${(glow * (0.25 + star.depth * 0.6)).toFixed(3)})`;
      context.beginPath();
      context.arc(x, y, star.size, 0, Math.PI * 2);
      context.fill();
    }
    if (reduce) return;
    drawComet(dt);
    drifters.forEach((rock) => drawDrifter(rock, dt, scrolled));
    drawMeteors(dt);
  };

  if (reduce) {
    draw(0);
    return;
  }
  const frame = (now: number) => {
    // selama lapisan lain menutup layar penuh (lubang hitam di hero), langit ini tidak perlu digambar
    if (document.documentElement.dataset.skyCovered !== 'true') draw(now);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
