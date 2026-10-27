import { lenis } from './smooth-scroll';

/* Navbar: bintang transit di tautan section yang sedang dibaca, garis meridian yang mengikuti posisi baca,
   dan indeks bab layar penuh dari tombol dial. */
export function startNavigation() {
  const header = document.querySelector<HTMLElement>('.site-header')!;
  const transit = header.querySelector<HTMLElement>('.site-nav__transit')!;
  const meridian = header.querySelector<HTMLElement>('.meridian i')!;
  const links = [...header.querySelectorAll<HTMLAnchorElement>('.site-nav a')];
  // di halaman CV bintangnya diam di tautan CV
  const current = links.find((link) => link.getAttribute('aria-current') === 'page') ?? null;
  let active = current;

  const place = (link: HTMLAnchorElement | null) => {
    transit.style.opacity = link ? '1' : '0';
    if (link) transit.style.transform = `translateX(${link.offsetLeft + link.offsetWidth / 2 - 3.5}px)`;
  };
  place(active);
  for (const link of links) {
    link.addEventListener('mouseenter', () => place(link));
    link.addEventListener('mouseleave', () => place(active));
  }

  // section dianggap sedang dibaca saat melewati garis tengah layar
  const visible = new Set<string>();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      }
      const link = links.find((item) => item.dataset.section && visible.has(item.dataset.section)) ?? current;
      if (link === active) return;
      active?.classList.remove('is-active');
      active = link;
      active?.classList.add('is-active');
      place(active);
    },
    { rootMargin: '-50% 0px -50% 0px' },
  );
  for (const link of links) {
    const section = link.dataset.section ? document.getElementById(link.dataset.section) : null;
    if (section) observer.observe(section);
  }

  let queued = false;
  const updateMeridian = () => {
    queued = false;
    const range = document.documentElement.scrollHeight - innerHeight;
    const progress = range > 0 ? Math.min(1, Math.max(0, scrollY / range)) : 0;
    meridian.style.transform = `translateX(${((progress - 1) * 100).toFixed(2)}%)`;
  };
  updateMeridian();
  addEventListener(
    'scroll',
    () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(updateMeridian);
    },
    { passive: true },
  );

  const button = header.querySelector<HTMLButtonElement>('.index-button')!;
  const label = button.querySelector<HTMLElement>('.index-button__label')!;
  const dial = button.querySelector('svg')!;
  const index = document.getElementById('site-index')!;
  const isOpen = () => button.getAttribute('aria-expanded') === 'true';
  const setOpen = (open: boolean) => {
    if (open) {
      // lingkaran pembuka berpusat di dial, di mana pun tombolnya berada
      const box = dial.getBoundingClientRect();
      index.style.setProperty('--ox', `${box.left + box.width / 2}px`);
      index.style.setProperty('--oy', `${box.top + box.height / 2}px`);
    }
    button.setAttribute('aria-expanded', String(open));
    label.textContent = (open ? button.dataset.close : button.dataset.open) ?? '';
    index.classList.toggle('is-open', open);
    index.inert = !open;
    // halaman di belakang indeks tidak ikut tergulir
    if (open) lenis?.stop();
    else lenis?.start();
    document.documentElement.style.overflow = open ? 'hidden' : '';
    if (open) index.querySelector('a')?.focus({ preventScroll: true });
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
