// ─── ChroniclePanel ───────────────────────────────────────────────────────────
// La Gazzetta di Novarata: gli articoli generati dal motore narrativo,
// dal più recente. Il primo articolo è in formato "apertura".

import { memo, useEffect, useState } from 'react';
import { useStoryStore } from '../../store/storyStore';
import { FACTION_DEFINITIONS, NEWSPAPER, CHRONICLER } from '../../data';
import type { Dispatch } from '../../types';

const PREVIEW_COUNT = 6;

const TONE_LABEL: Readonly<Record<Dispatch['tone'], string>> = {
  news: 'Cronaca',
  alert: 'Ultim\'ora',
  act: 'Inchiesta',
  obituary: 'Necrologio politico',
};

const DispatchItem = memo(function DispatchItem({ d, lead }: { d: Dispatch; lead: boolean }) {
  const color = d.faction ? FACTION_DEFINITIONS[d.faction].color : undefined;
  return (
    <article className={`dispatch dispatch--${d.tone}${lead ? ' dispatch--lead' : ''}`}>
      <header className="dispatch__meta">
        <span className="dispatch__tone">{TONE_LABEL[d.tone]}</span>
        <span>Notte {d.round}</span>
      </header>
      <h3 className="dispatch__headline">
        {color && <span className="dispatch__swatch" style={{ background: color }} aria-hidden="true" />}
        {d.headline}
      </h3>
      <p className="dispatch__body">{d.body}</p>
    </article>
  );
});

export const ChroniclePanel = memo(function ChroniclePanel() {
  const dispatches = useStoryStore(s => s.dispatches);
  const markRead = useStoryStore(s => s.markRead);
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? dispatches : dispatches.slice(0, PREVIEW_COUNT);
  const hidden = dispatches.length - visible.length;

  // la scheda è visibile → tutto letto (anche quando arrivano nuovi articoli)
  useEffect(() => { markRead(); }, [dispatches, markRead]);

  return (
    <section className="gazette" aria-label={NEWSPAPER}>
      <header className="gazette__masthead">
        <span className="gazette__name">{NEWSPAPER}</span>
        <span className="gazette__byline">di {CHRONICLER}</span>
      </header>
      {dispatches.length === 0 ? (
        <p className="gazette__empty">La redazione aspetta notizie dalle strade…</p>
      ) : (
        <div className="gazette__list">
          {visible.map((d, i) => <DispatchItem key={d.id} d={d} lead={i === 0} />)}
        </div>
      )}
      {(hidden > 0 || expanded) && dispatches.length > PREVIEW_COUNT && (
        <button type="button" className="gazette__more" onClick={() => setExpanded(e => !e)}>
          {expanded ? 'Chiudi l\'archivio' : `Archivio · altri ${hidden} articoli`}
        </button>
      )}
    </section>
  );
});
