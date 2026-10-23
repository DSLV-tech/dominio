// ─── JoinScreen ───────────────────────────────────────────────────────────────
// Si apre dal link d'invito (?stanza=CODICE): basta scrivere il proprio nome
// ed entrare. Il nome si ricorda per i prossimi inviti.

import { useState, type FormEvent } from 'react';
import { useOnlineStore } from '../../online/onlineStore';
import { loadPlayerName, savePlayerName } from '../../online/playerName';

export function JoinScreen() {
  const code = useOnlineStore(s => s.inviteCode);
  const busy = useOnlineStore(s => s.phase === 'busy');
  const error = useOnlineStore(s => s.error);
  const joinRoom = useOnlineStore(s => s.joinRoom);
  const dismissInvite = useOnlineStore(s => s.dismissInvite);
  const [name, setName] = useState(loadPlayerName);

  if (!code) return null;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!code || busy) return;
    savePlayerName(name);
    void joinRoom(code, name);
  }

  return (
    <main className="room room--join">
      <header className="room__head">
        <span className="brand-mark">DOMINIO</span>
        <span className="kicker">Invito</span>
      </header>

      <h1 className="room__title">Ti hanno sfidato a Novarata</h1>
      <p className="room__hint">Stanza <strong className="room__code room__code--inline">{code}</strong></p>

      <form className="join" onSubmit={submit}>
        <label className="label" htmlFor="join-name">Il tuo nome</label>
        <input
          id="join-name"
          className="input join__name"
          value={name}
          maxLength={18}
          autoComplete="nickname"
          placeholder="Come ti chiami?"
          onChange={e => setName(e.target.value)}
        />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn--sodium btn--xl" disabled={busy}>
          {busy ? 'Entro…' : 'Entra nella stanza →'}
        </button>
      </form>

      <button type="button" className="link" onClick={dismissInvite}>No grazie, gioco per conto mio</button>
    </main>
  );
}
