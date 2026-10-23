// ─── VictoryModal ─────────────────────────────────────────────────────────────
// Fine partita come prima pagina della Gazzetta: il vincitore decide quale
// verità sull'incendio viene stampata (epilogo per fazione × condizione).

import { memo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useStoryStore } from '../../store/storyStore';
import { FACTION_DEFINITIONS, FACTION_LORE, EPILOGUES, NEWSPAPER, CHRONICLER } from '../../data';
import type { VictoryCondition } from '../../types';
import { cssVars } from '../common/cssVars';
import { useOnlineStore } from '../../online/onlineStore';

const CONDITION_LABELS: Readonly<Record<VictoryCondition, string>> = {
  TOTAL_DOMINATION: 'Dominio totale',
  POLITICAL_CONTROL: 'Controllo politico',
  ELIMINATION: 'Eliminazione',
};

export const VictoryModal = memo(function VictoryModal() {
  const game      = useGameStore(s => s.game);
  const resetGame = useGameStore(s => s.resetGame);
  const online    = useOnlineStore(s => s.room !== null);
  const leaveRoom = useOnlineStore(s => s.leave);
  const dispatches = useStoryStore(s => s.dispatches);

  if (game?.phase !== 'GAME_OVER' || !game.winner) return null;

  const winner = game.players.find(p => p.id === game.winner);
  if (!winner) return null;
  const faction = FACTION_DEFINITIONS[winner.factionId];
  const lore = FACTION_LORE[winner.factionId];
  const condition = game.victoryCondition ?? 'ELIMINATION';
  const epilogue = EPILOGUES[winner.factionId][condition];
  const survivors = game.players.filter(p => !p.isEliminated).length;

  return (
    <div className="victory" role="dialog" aria-modal="true" aria-labelledby="victory-title">
      <article className="frontpage" style={cssVars({ '--faction': faction.color })}>
        <header className="frontpage__masthead">
          <span>{NEWSPAPER}</span>
          <span>Edizione straordinaria · Notte {game.round}</span>
        </header>
        <p className="frontpage__kicker">{CONDITION_LABELS[condition]}</p>
        <h2 id="victory-title" className="frontpage__headline">
          Novarata è {lore.grammar.of}
        </h2>
        <p className="frontpage__deck">
          {lore.leader} riceve il commissario. «{lore.motto}» — Vince <strong>{winner.name}</strong>.
        </p>
        <p className="frontpage__body">{epilogue}</p>
        <footer className="frontpage__foot">
          <span>di {CHRONICLER}</span>
          <span>{survivors} {survivors === 1 ? 'fazione rimasta' : 'fazioni rimaste'} · {dispatches.length} articoli in archivio</span>
        </footer>
        <button type="button" className="btn btn--ink btn--xl" onClick={online ? leaveRoom : resetGame} autoFocus>
          {online ? 'Esci dalla stanza' : 'Nuova partita'}
        </button>
      </article>
    </div>
  );
});
