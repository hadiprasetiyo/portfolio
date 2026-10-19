import { smooth } from './math';

/* Kursor pelacak bintang (desktop): titik cahaya, cincin bidik emas, dan jejak debu bintang.
   Bagian lain (lubang hitam di hero) bisa memasang penarik supaya kursor terhisap ke intinya. */

export type Attractor = () => { x: number; y: number; horizon: number; active: boolean } | null;

let attractor: Attractor | null = null;
export const setCursorAttractor = (next: Attractor | null) => {
  attractor = next;
};

type Grain = { x: number; y: number; vx: number; vy: number; life: number; span: number; size: number; strength: number };

export function startCursor() {
  if (!matchMedia('(pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const dotElement = document.createElement('span');
  dotElement.className = 'cursor';
  const ring = document.createElement('span');
  ring.className = 'cursor-ring';
  ring.innerHTML = '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="12"></circle><path class="ticks" d="M20 2v6M20 32v6M2 20h6M32 20h6"></path></svg>';
  const trail = document.createElement('canvas');
  trail.className = 'cursor-trail';
  for (const element of [dotElement, ring, trail]) element.setAttribute('aria-hidden', 'true');
  // dipisah satu per satu: tipe global Workers ikut mendefinisikan append dengan signature lain
  for (const element of [trail, ring, dotElement]) document.body.appendChild(element);
  document.documentElement.classList.add('has-cursor');
  const trailContext = trail.getContext('2d')!;

  const resize = () => {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    trail.width = Math.round(innerWidth * ratio);
    trail.height = Math.round(innerHeight * ratio);
    trailContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  };
  resize();
  addEventListener('resize', resize);

  const mouse = { x: innerWidth / 2, y: innerHeight / 2, rx: innerWidth / 2, ry: innerHeight / 2, seen: false };
  addEventListener('pointermove', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    if (!mouse.seen) {
      mouse.seen = true;
      dotElement.style.opacity = '1';
      ring.style.opacity = '1';
    }
  });
  document.addEventListener('pointerover', (event) => ring.classList.toggle('is-big', Boolean((event.target as Element).closest?.('a, button'))));

  // butir dilepas dari posisi titik kursor yang tampil, jadi ikut berpilin saat kursor terhisap
  const dust: Grain[] = [];
  let lastDust: { x: number; y: number } | null = null;
  const emitDust = (x: number, y: number, strength: number) => {
    if (!lastDust) lastDust = { x, y };
    const count = Math.min(6, Math.floor(Math.hypot(x - lastDust.x, y - lastDust.y) / 6));
    for (let index = 1; index <= count; index++) {
      const t = index / count;
      dust.push({
        x: lastDust.x + (x - lastDust.x) * t,
        y: lastDust.y + (y - lastDust.y) * t,
        vx: (Math.random() - 0.5) * 14,
        vy: (Math.random() - 0.5) * 14,
        life: 0,
        span: 0.45 + Math.random() * 0.45,
        size: 0.6 + Math.random() * 1.1,
        strength,
      });
    }
    if (count > 0) lastDust = { x, y };
    if (dust.length > 90) dust.splice(0, dust.length - 90);
  };
  const drawDust = (dt: number) => {
    trailContext.clearRect(0, 0, innerWidth, innerHeight);
    trailContext.globalCompositeOperation = 'lighter';
    for (let index = dust.length - 1; index >= 0; index--) {
      const grain = dust[index];
      grain.life += dt;
      if (grain.life >= grain.span) {
        dust.splice(index, 1);
        continue;
      }
      grain.x += grain.vx * dt;
      grain.y += grain.vy * dt;
      const left = 1 - grain.life / grain.span;
      trailContext.globalAlpha = left * left * grain.strength * 0.8;
      trailContext.fillStyle = grain.size > 1.2 ? '#FFF2DA' : '#D9C29A';
      trailContext.beginPath();
      trailContext.arc(grain.x, grain.y, grain.size * (0.5 + left * 0.5), 0, Math.PI * 2);
      trailContext.fill();
    }
    trailContext.globalAlpha = 1;
    trailContext.globalCompositeOperation = 'source-over';
  };

  // 0 = bebas, 1 = sudah tertelan horizon
  let capture = 0;
  let previous = 0;
  const frame = (now: number) => {
    const dt = previous ? Math.min(0.05, (now - previous) / 1000) : 1 / 60;
    previous = now;
    if (mouse.seen) {
      const pull = attractor?.() ?? null;
      const centerX = pull?.x ?? mouse.x;
      const centerY = pull?.y ?? mouse.y;
      const offsetX = mouse.x - centerX;
      const offsetY = mouse.y - centerY;
      const distance = Math.hypot(offsetX, offsetY);
      // makin dekat ke horizon makin kuat ditarik, berputar spiral, memanjang, lalu lenyap
      const target = pull?.active ? 1 - smooth(pull.horizon * 1.1, pull.horizon * 3.4, distance) : 0;
      capture += (target - capture) * 0.06;
      const fall = capture * capture;
      const angle = Math.atan2(offsetY, offsetX) + fall * 2.6 + now * 0.002 * fall;
      const radius = distance * (1 - fall * 0.95);
      const shownX = centerX + Math.cos(angle) * radius;
      const shownY = centerY + Math.sin(angle) * radius;
      const fade = 1 - smooth(0.72, 0.96, capture);
      const shape = fall > 0.001 ? ` rotate(${angle.toFixed(3)}rad) scale(${(1 + fall * 1.8).toFixed(3)}, ${(1 - fall * 0.85).toFixed(3)})` : '';
      dotElement.style.opacity = fade.toFixed(3);
      ring.style.opacity = fade.toFixed(3);
      mouse.rx += (shownX - mouse.rx) * 0.14;
      mouse.ry += (shownY - mouse.ry) * 0.14;
      dotElement.style.transform = `translate(${shownX.toFixed(1)}px, ${shownY.toFixed(1)}px)${shape}`;
      ring.style.transform = `translate(${mouse.rx.toFixed(1)}px, ${mouse.ry.toFixed(1)}px)${shape}`;
      emitDust(shownX, shownY, fade);
    }
    drawDust(dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
