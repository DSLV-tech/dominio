// ─── GuidePanel ───────────────────────────────────────────────────────────────
// Come si vince, bonus dei quartieri e regole rapide del turno.

import { memo } from 'react';
import { ZONE_DEFINITIONS, ZONE_LORE } from '../../data';
import { useTutorialStore } from '../../store/tutorialStore';
import type { ZoneId } from '../../types';

const ZONE_ORDER: readonly ZoneId[] = ['CS', 'PV', 'PN', 'CR', 'SE'];

export const GuidePanel = memo(function GuidePanel() {
  const restart = useTutorialStore(s => s.restart);
  return (
    <div className="guide">
      <section>
        <h3 className="guide__title">Come si vince</h3>
        <ul className="guide__list">
          <li><strong>Controllo politico</strong> — tieni Piazza Grande per 2 turni di fila con almeno 3 quartieri interi.</li>
          <li><strong>Dominio totale</strong> — tutte le 20 zone sono tue.</li>
          <li><strong>Eliminazione</strong> — resti l'ultima fazione in città.</li>
        </ul>
      </section>

      <section>
        <h3 className="guide__title">Quartieri</h3>
        <ul className="zone-list">
          {ZONE_ORDER.map(id => {
            const z = ZONE_DEFINITIONS[id];
            if (!z) return null;
            return (
              <li key={id} className="zone-list__item">
                <span className="zone-list__swatch" style={{ background: z.color }} aria-hidden="true" />
                <span className="zone-list__name">{z.name}</span>
                <span className="zone-list__bonus">+{z.troopBonus}{z.eventCardBonus ? ' · evento' : ''}</span>
                <span className="zone-list__tag">{ZONE_LORE[id].tagline}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h3 className="guide__title">Il turno</h3>
        <ol className="guide__list guide__list--num">
          <li><span style={{ color: 'var(--phase-reinforce)' }}>Rinforzi</span> — piazza tutte le truppe ricevute; incassa i set di carte.</li>
          <li><span style={{ color: 'var(--phase-attack)' }}>Attacco</span> — da un territorio con ≥2 truppe verso uno adiacente. Il difensore vince i pareggi.</li>
          <li><span style={{ color: 'var(--phase-move)' }}>Spostamento</span> — sposta truppe tra tuoi territori (vicini o a catena, secondo la regola scelta in lobby), poi chiudi la notte.</li>
        </ol>
        <p className="guide__note">★ = snodo strategico. Esc annulla la selezione.</p>
        <button type="button" className="btn btn--ghost btn--sm" onClick={restart}>Rivedi la guida del primo turno</button>
      </section>
    </div>
  );
});
