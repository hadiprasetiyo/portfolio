import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { prefersReducedMotion } from './math';

// satu instance untuk seluruh halaman; section lain memakainya untuk scrollTo yang tetap halus
export const lenis = prefersReducedMotion() ? null : new Lenis({ lerp: 0.085, smoothWheel: true });

if (lenis) {
  const frame = (now: number) => {
    lenis.raf(now);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

export const scrollToY = (top: number) => {
  if (lenis) lenis.scrollTo(top, { duration: 1.6 });
  else scrollTo({ top, behavior: 'auto' });
};
