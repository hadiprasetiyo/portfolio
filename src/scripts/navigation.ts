import { lenis } from './smooth-scroll';

/* Navigasi astrolabe: jarum dial di navbar maju mengikuti posisi baca, dan indeks bab layar penuh
   dengan jarum alidade yang membidik bab yang disorot. */
export function startNavigation() {
  const header = document.querySelector<HTMLElement>('.site-header')!;
  const button = document.querySelector<HTMLButtonElement>('.dial-button')!;
  const dialNumber = button.querySelector<HTMLElement>('.dial-button__text small')!;
  const dialName = button.querySelector<HTMLElement>('.dial-button__text span')!;
  const needle = button.querySelector<SVGGElement>('.dial__needle')!;
  const ticks = [...button.querySelectorAll<SVGLineElement>('.dial__tick')];
  const index = document.getElementById('site-index')!;
  const rows = [...index.querySelectorAll<HTMLAnchorElement>('.ledger ol a')];
  const marked = [...index.querySelectorAll<Element>('[data-chapter]')];
  const alidade = index.querySelector<SVGGElement>('.plate__alidade')!;
  const readout = index.querySelector<HTMLElement>('.plate__readout')!;
  const [readNumber, readName, readDetail] = [...readout.children] as HTMLElement[];
  const step = 360 / rows.length;

  // bab yang sedang dibaca; -1 berarti masih di hero atau di halaman tanpa bab
  let current = -1;
  let aimed = -1;
  let settle = 0;
  const mark = (name: string, chapter: number) => {
    for (const element of marked) element.classList.toggle(name, Number((element as HTMLElement).dataset.chapter) === chapter);
  };

  // sudut mutlak, bukan jalur terpendek: bab berikutnya selalu searah jarum jam, bab sebelumnya berlawanan
  const aim = (chapter: number) => {
    clearTimeout(settle);
    alidade.style.transform = `rotate(${chapter * step}deg)`;
    mark('is-aim', chapter);
    if (aimed === chapter) return;
    aimed = chapter;
    readout.classList.add('is-swapping');
    setTimeout(() => {
      const row = rows[chapter].dataset;
      readNumber.textContent = `${row.roman} · No. ${row.number}`;
      readName.textContent = row.label ?? '';
      readDetail.textContent = row.detail ?? '';
      readout.classList.remove('is-swapping');
    }, 180);
  };
  for (const element of index.querySelectorAll<HTMLElement>('a[data-chapter]')) {
    const chapter = Number(element.dataset.chapter);
    element.addEventListener('mouseenter', () => aim(chapter));
    element.addEventListener('focus', () => aim(chapter));
    // jeda sebelum kembali ke bab yang dibaca, supaya pindah antar bab tidak memutar jarum bolak-balik
    element.addEventListener('mouseleave', () => {
      clearTimeout(settle);
      settle = window.setTimeout(() => aim(Math.max(current, 0)), 260);
    });
  }

  // posisi baca: indeks bab ditambah seberapa jauh bab itu sudah dibaca, diukur di garis tengah layar
  const sections = rows.map((row) => document.getElementById(row.hash.slice(1)));
  let tops: number[] = [];
  const measure = () => {
    tops = sections.every(Boolean) ? sections.map((section) => section!.getBoundingClientRect().top + scrollY) : [];
  };
  const update = () => {
    queued = false;
    header.classList.toggle('is-scrolled', scrollY > 24);
    let position = -1;
    if (tops.length) {
      const line = scrollY + innerHeight / 2;
      const chapter = tops.findLastIndex((top) => top <= line);
      if (chapter >= 0) {
        const end = tops[chapter + 1] ?? document.documentElement.scrollHeight;
        position = chapter + Math.min(1, (line - tops[chapter]) / Math.max(1, end - tops[chapter]));
      }
    }
    needle.style.transform = `rotate(${Math.max(0, position) * step}deg)`;
    const chapter = position < 0 ? -1 : Math.min(rows.length - 1, Math.floor(position));
    if (chapter === current) return;
    current = chapter;
    ticks.forEach((tick, i) => tick.classList.toggle('is-active', i === chapter));
    mark('is-current', chapter);
    dialNumber.textContent = chapter < 0 ? '' : `No. ${rows[chapter].dataset.number}`;
    dialName.textContent = chapter < 0 ? (button.dataset.open ?? '') : (rows[chapter].dataset.label ?? '');
  };
  let queued = false;
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };
  measure();
  update();
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', () => {
    measure();
    queue();
  });
  // font dan gambar yang baru selesai dimuat menggeser letak bab
  addEventListener('load', () => {
    measure();
    queue();
  });

  const isOpen = () => button.getAttribute('aria-expanded') === 'true';
  const setOpen = (open: boolean) => {
    if (open) {
      // lingkaran pembuka berpusat di dial
      const box = button.querySelector('svg')!.getBoundingClientRect();
      index.style.setProperty('--ox', `${box.left + box.width / 2}px`);
      index.style.setProperty('--oy', `${box.top + box.height / 2}px`);
      aim(Math.max(current, 0));
    }
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', (open ? button.dataset.close : button.dataset.open) ?? '');
    index.classList.toggle('is-open', open);
    index.inert = !open;
    // halaman di belakang indeks tidak ikut tergulir
    if (open) lenis?.stop();
    else lenis?.start();
    document.documentElement.style.overflow = open ? 'hidden' : '';
    if (open) rows[Math.max(current, 0)].focus({ preventScroll: true });
  };
  button.addEventListener('click', () => setOpen(!isOpen()));
  index.addEventListener('click', (event) => {
    if ((event.target as Element).closest('a')) setOpen(false);
  });
  addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !isOpen()) return;
    setOpen(false);
    button.focus();
  });
}
