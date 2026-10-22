// ─── PrologueScreen ───────────────────────────────────────────────────────────
// Apertura narrativa prima della lobby: tre pagine, navigabili con
// tastiera (→ / Invio avanti, ← indietro, Esc salta).

import { useCallback, useEffect, useState } from 'react';
import { PROLOGUE, NEWSPAPER } from '../../data';
import { useStoryStore } from '../../store/storyStore';

export function PrologueScreen() {
  const finishPrologue = useStoryStore(s => s.finishPrologue);
  const [index, setIndex] = useState(0);
  const page = PROLOGUE[index];
  const isLast = index === PROLOGUE.length - 1;

  const next = useCallback(() => {
    if (isLast) finishPrologue();
    else setIndex(i => i + 1);
  }, [isLast, finishPrologue]);

  const back = useCallback(() => setIndex(i => Math.max(0, i - 1)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') back();
      else if (e.key === 'Escape') finishPrologue();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, back, finishPrologue]);

  if (!page) return null;

  return (
    <main className="prologue">
      <div className="prologue__glow" aria-hidden="true" />
      <header className="prologue__masthead">
        <span className="brand-mark">DOMINIO</span>
        <span className="prologue__paper">{NEWSPAPER}</span>
      </header>

      {/* key → l'animazione d'ingresso riparte a ogni pagina */}
      <article key={index} className="prologue__page" aria-live="polite">
        <p className="kicker">{page.kicker}</p>
        <h1 className="prologue__title">{page.title}</h1>
        {page.paragraphs.map((p, i) => (
          <p key={i} className="prologue__text" style={{ animationDelay: `${200 + i * 220}ms` }}>{p}</p>
        ))}
      </article>

      <footer className="prologue__nav">
        <div className="prologue__dots" aria-label={`Pagina ${index + 1} di ${PROLOGUE.length}`}>
          {PROLOGUE.map((_, i) => (
            <span key={i} className={`dot${i === index ? ' is-active' : ''}`} />
          ))}
        </div>
        <div className="prologue__actions">
          <button type="button" className="btn btn--ghost" onClick={finishPrologue}>Salta</button>
          {/* sempre presente (nascosto in prima pagina): i pulsanti non cambiano posto tra le pagine */}
          <button
            type="button"
            className={`btn btn--ghost prologue__back${index === 0 ? ' is-hidden' : ''}`}
            onClick={back}
            disabled={index === 0}
            aria-hidden={index === 0}
            tabIndex={index === 0 ? -1 : undefined}
          >
            ← Indietro
          </button>
          <button type="button" className="btn btn--sodium prologue__next" onClick={next} data-shot-next>
            {isLast ? 'Scegli la tua fazione →' : 'Continua →'}
          </button>
        </div>
      </footer>
    </main>
  );
}
