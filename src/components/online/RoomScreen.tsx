// ─── RoomScreen ───────────────────────────────────────────────────────────────
// Sala d'attesa della partita online: codice e link da mandare agli amici,
// posti al tavolo (chi è già dentro, chi manca, le CPU). Chi ha creato la
// stanza avvia la partita quando tutti i posti per gli amici sono occupati.

import { memo, useEffect, useState } from 'react';
import { FACTION_DEFINITIONS } from '../../data';
import { inviteLink } from '../../online/codes';
import { allSeatsTaken, useOnlineStore } from '../../online/onlineStore';
import type { Seat } from '../../online/types';
import { cssVars } from '../common/cssVars';
import { FactionEmblem } from '../common/FactionEmblem';

// ─── Link d'invito ────────────────────────────────────────────────────────────

interface ShareLinkProps {
  readonly code: string;
  readonly link: string;
}

const ShareLink = memo(function ShareLink({ code, link }: ShareLinkProps) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator.share === 'function';

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(t);
  }, [copied]);

  async function share() {
    try {
      await navigator.share({ title: 'Dominio', text: `Giochiamo a Dominio? Stanza ${code}`, url: link });
    } catch { /* condivisione annullata */ }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch { /* appunti non disponibili: il link resta selezionabile */ }
  }

  return (
    <div className="share">
      <input
        className="input share__link"
        readOnly
        value={link}
        aria-label="Link d'invito"
        onFocus={e => e.currentTarget.select()}
      />
      <div className="share__actions">
        {canShare && (
          <button type="button" className="btn btn--sodium" onClick={() => void share()}>Condividi</button>
        )}
        <button type="button" className={`btn ${canShare ? 'btn--ghost' : 'btn--sodium'}`} onClick={() => void copy()}>
          {copied ? 'Copiato ✓' : 'Copia link'}
        </button>
      </div>
    </div>
  );
});

// ─── Posto al tavolo ──────────────────────────────────────────────────────────

interface SeatRowProps {
  readonly seat: Seat;
  readonly mine: boolean;
}

function seatStatus(seat: Seat, mine: boolean): { readonly label: string; readonly tone: 'me' | 'ok' | 'wait' | 'cpu' } {
  if (mine) return { label: 'Tu', tone: 'me' };
  if (seat.kind === 'cpu') return { label: 'CPU', tone: 'cpu' };
  if (seat.uid) return { label: seat.kind === 'host' ? 'Ha creato la stanza' : 'Pronto', tone: 'ok' };
  return { label: 'In attesa…', tone: 'wait' };
}

const SeatRow = memo(function SeatRow({ seat, mine }: SeatRowProps) {
  const faction = FACTION_DEFINITIONS[seat.factionId];
  const status = seatStatus(seat, mine);
  const open = seat.kind === 'friend' && !seat.uid;
  return (
    <li className={`seat${open ? ' is-open' : ''}`} style={cssVars({ '--faction': faction.color })}>
      <FactionEmblem faction={seat.factionId} size={30} />
      <span className="seat__text">
        <span className="seat__name">{open ? 'Posto per un amico' : seat.name}</span>
        <span className="seat__faction">{faction.name}</span>
      </span>
      <span className={`seat__status seat__status--${status.tone}`}>{status.label}</span>
    </li>
  );
});

// ─── Schermata ────────────────────────────────────────────────────────────────

function Connecting({ text }: { readonly text: string }) {
  return (
    <main className="room room--center">
      <span className="brand-mark">DOMINIO</span>
      <p className="room__status" role="status"><span className="spinner" aria-hidden="true" />{text}</p>
    </main>
  );
}

export function RoomScreen() {
  const room = useOnlineStore(s => s.room);
  const uid = useOnlineStore(s => s.uid);
  const error = useOnlineStore(s => s.error);
  const local = useOnlineStore(s => s.isLocalTransport);
  const startMatch = useOnlineStore(s => s.startMatch);
  const cancelRoom = useOnlineStore(s => s.cancelRoom);
  const leave = useOnlineStore(s => s.leave);

  if (!room) return <Connecting text="Mi collego alla stanza…" />;
  if (room.status === 'playing') return <Connecting text="La partita sta per iniziare…" />;

  const isHost = room.hostUid === uid;
  const ready = allSeatsTaken(room);
  const host = room.seats.find(s => s.kind === 'host');
  const missing = room.seats.filter(s => s.kind === 'friend' && !s.uid).length;

  return (
    <main className="room">
      <header className="room__head">
        <span className="brand-mark">DOMINIO</span>
        <span className="kicker">Partita online</span>
      </header>

      <section className="room__invite" aria-label="Invito">
        <span className="label">Codice stanza</span>
        <p className="room__code" aria-label={`Codice ${[...room.code].join(' ')}`}>{room.code}</p>
        <p className="room__hint">
          {missing > 0
            ? `Manda il link ${missing === 1 ? 'al tuo amico' : 'ai tuoi amici'}: lo apre${missing === 1 ? '' : 'no'} e ${missing === 1 ? 'entra' : 'entrano'} nella stanza.`
            : 'Ci siete tutti.'}
        </p>
        {missing > 0 && <ShareLink code={room.code} link={inviteLink(room.code, local)} />}
      </section>

      <section className="room__table" aria-label="Giocatori">
        <span className="label">Al tavolo</span>
        <ol className="seats">
          {room.seats.map((seat, i) => <SeatRow key={i} seat={seat} mine={seat.uid === uid} />)}
        </ol>
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="room__actions">
        {isHost ? (
          <>
            <button type="button" className="btn btn--sodium btn--xl" onClick={startMatch} disabled={!ready}>
              {ready ? 'Inizia la partita →' : 'Aspetto i giocatori…'}
            </button>
            <button type="button" className="link" onClick={() => void cancelRoom()}>Chiudi la stanza</button>
          </>
        ) : (
          <>
            <p className="room__status" role="status">
              <span className="spinner" aria-hidden="true" />
              Aspetta che {host?.name ?? 'chi ti ha invitato'} inizi la partita.
            </p>
            <button type="button" className="link" onClick={leave}>Esci</button>
          </>
        )}
      </div>
    </main>
  );
}
