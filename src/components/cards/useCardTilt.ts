// ─── useCardTilt ──────────────────────────────────────────────────────────────
// Inclinazione 3D + riflesso che segue il puntatore. Scrive custom properties
// CSS direttamente sull'elemento (--rx, --ry, --mx, --my) in requestAnimationFrame:
// nessun re-render React durante il movimento. Solo mouse/penna, non touch;
// disattivato con "riduci animazioni". Usa e.currentTarget: nessun ref da passare.

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { prefersReducedMotion } from '../common/motion';

const MAX_TILT_DEG = 9;

export interface CardTiltHandlers<T extends HTMLElement> {
  readonly onPointerMove: (e: ReactPointerEvent<T>) => void;
  readonly onPointerLeave: (e: ReactPointerEvent<T>) => void;
}

export function useCardTilt<T extends HTMLElement>(): CardTiltHandlers<T> {
  const frame = useRef(0);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const onPointerMove = useCallback((e: ReactPointerEvent<T>) => {
    if (e.pointerType === 'touch' || prefersReducedMotion()) return;
    const el = e.currentTarget;
    const { clientX, clientY } = e;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      const px = (clientX - r.left) / r.width;    // 0..1
      const py = (clientY - r.top) / r.height;
      el.style.setProperty('--ry', `${(px - 0.5) * 2 * MAX_TILT_DEG}deg`);
      el.style.setProperty('--rx', `${(0.5 - py) * 2 * MAX_TILT_DEG}deg`);
      el.style.setProperty('--mx', `${px * 100}%`);
      el.style.setProperty('--my', `${py * 100}%`);
      el.dataset.tilting = 'true';
    });
  }, []);

  const onPointerLeave = useCallback((e: ReactPointerEvent<T>) => {
    const el = e.currentTarget;
    cancelAnimationFrame(frame.current);
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
    delete el.dataset.tilting;
  }, []);

  return { onPointerMove, onPointerLeave };
}
