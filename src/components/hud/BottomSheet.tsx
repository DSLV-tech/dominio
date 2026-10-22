// ─── BottomSheet ──────────────────────────────────────────────────────────────
// Cassetto dal basso per gli schermi stretti: la mappa usa tutto lo schermo e
// il contenuto (fazioni, Gazzetta, carte) si apre a richiesta, a tre altezze:
// chiuso (solo la maniglia), metà, pieno.

import { memo, useCallback, useState, type ReactNode } from 'react';

type SheetLevel = 'peek' | 'half' | 'full';

const NEXT: Readonly<Record<SheetLevel, SheetLevel>> = { peek: 'half', half: 'full', full: 'peek' };
const LABEL: Readonly<Record<SheetLevel, string>> = {
  peek: 'Apri il pannello', half: 'Espandi il pannello', full: 'Chiudi il pannello',
};

export const BottomSheet = memo(function BottomSheet({ children }: { readonly children: ReactNode }) {
  const [level, setLevel] = useState<SheetLevel>('peek');
  const cycle = useCallback(() => setLevel(l => NEXT[l]), []);
  return (
    <section className={`sheet sheet--${level}`} aria-label="Pannello di gioco">
      <button type="button" className="sheet__handle" onClick={cycle} aria-expanded={level !== 'peek'}>
        <span className="sheet__grip" aria-hidden="true" />
        <span className="sheet__label">{LABEL[level]}</span>
      </button>
      <div className="sheet__body" hidden={level === 'peek'}>{children}</div>
    </section>
  );
});
