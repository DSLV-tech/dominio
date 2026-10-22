# Dominio — Piano dei miglioramenti

> Piano di implementazione (nessun codice ancora scritto). Prodotto dal prompt in `docs/PROMPT_PIANO.md`.
> Stato del codice verificato il 22/10/2026. Ogni fase è rilasciabile da sola e deve lasciare verdi
> `npm run build`, `npm run lint`, `npm run simulate -- 20 4`, `npm run story -- 30 3`.

## Avanzamento (22/10/2026)

- **Fase A — fatta (parziale):** tregua dentro `validateAttack` (con scadenza `untilTurn`), type guard `isEffect`/`hasTruce`,
  barricata = 3° dado in difesa, RNG iniettabile in `combat.ts`. Poi chiuse D1 e D2:
  Rappresaglia = all'inizio del proprio turno, primo lancio sul territorio perduto senza perdite per l'attaccante (`RAPPRESAGLIA_TARGET`);
  spostamento = regola scelta in lobby (`GameConfig.movementRule`: `adjacent` | `chain`, `engine/movement.ts → reachableFriendly`).
- **Fase B — fatta:** `AttackOrder`/`AttackPreferences`/`PendingOccupation` (`types/combat.ts`), `resolveAttackOrder` (singolo/blitz),
  `gameStore.attackTerritory(order)` + `occupy(count)`, `uiStore.attackPrefs` (persistite in `dominio.attack`), `AttackPanel`,
  `OccupyDialog`, `BlitzSummary` in `CombatModal`, CPU in blitz con vantaggio ≥ 2 (`stopAt` 3), `TroopStepper` estratto in `common/`.
  Nuovo script `npm run combat` (RNG deterministico). La CPU occupa sempre col minimo (nessuna `aiChooseOccupation` ancora);
  i difensori umani difendono al massimo (D4 aperta).
- **Verifiche eseguite:** `tsc -b`, `eslint .`, `simulate 20 4`, `story 30 3`, `combat` → tutti ok. `vite build` e prova manuale
  nel browser **non eseguiti** (l'ambiente automatico non ha i binari nativi di vite): da lanciare in locale.
- **Fase C — fatta:** `getEventTargets` (passi `territory`/`player`/`cards`), `EventTargeting` in `uiStore`, `EventTargetBar` +
  `EventTargetDialog`, variante `targetable` (2D e 3D), Esc annulla; `aiChooseEvent` + gioco CPU all'inizio dei Rinforzi;
  `GameState.lastEvent` → beat `EVENT` → articoli in `data/story.ts → EVENT_ARTICLES`. Decisioni D3: Accordo Commerciale
  imposto e alla cieca (le tue carte offerte, altrettante a caso dall'altro); Corruzione pesca alla cieca. La CPU non gioca
  Accordo Commerciale né Sciopero. `simulate` ora verifica che le carte territorio non si perdano né duplichino.
- **Fase D — fatta:** `controlledZones`, `OwnershipDecal` + `ZoneOutline` (3D), riempimento zona e "+N" nella mappa 2D,
  zone con bonus nel `PlayerPanel`. Turno CPU: `settingsStore` (velocità, camera che segue), `CameraRig` che segue il focus
  e torna all'inquadratura dell'utente (smette se l'utente tocca la mappa), scie `ActionTrace`, `engine/recap.ts → summarizeTurn`,
  scheda `TurnRecap` ("Durante la notte di …").
- **Fase E — fatta (senza bloom):** `GraphicsBudget` (Auto/Alta/Bassa, `PerformanceMonitor`, parte bassa su mobile/touch),
  ciclo del cielo `data/sky.ts` (tramonto → sera → notte → notte fonda → alba) con luci, nebbia, stelle, finestre (`VC_Glow`),
  fari e faro; cassetto dal basso `BottomSheet` sotto i 768 px; bersagli touch ≥ 44 px; precaricamento del chunk 3D in lobby/prologo.
  D5 risolta senza `@react-three/postprocessing`: nessuna nuova dipendenza, il bagliore è emissivo. Lo split del chunk
  (`manualChunks`/`advancedChunks`) **non è stato toccato**: va misurato con un build reale.
- **Fase F — fatta:** `tutorialStore`, `data/coach.ts`, `CoachMark` (5 indicazioni, non modali, saltabili, "Rivedi la guida" nel pannello Guida).
- **D6:** nessun Vitest; la verifica resta su `simulate`, `story`, `combat`.
- **Non verificato:** `vite build` e tutto ciò che è visivo (cielo notturno, decalcomanie, contorni di zona, camera che segue,
  cassetto mobile). Serve una partita a mano in locale; taratura probabile di `data/sky.ts` e `OwnershipDecal`.


## Sintesi

| # | Intervento | Stima | Dipende da |
|---|------------|:----:|------------|
| 0 | Correzioni di regole emerse dall'analisi | S | — |
| 7 | Attacco: scelta dadi, attacco automatico, occupazione | M | 0 |
| 1 | Carte evento con bersaglio (umano + CPU + Gazzetta) | L | 0 |
| 3 | Turno della CPU leggibile | M | 7 |
| 2 | La notte che avanza | M | — (meglio dopo 5) |
| 4 | Leggibilità del possesso | S/M | — |
| 5 | Qualità grafica e mobile | M | — |
| 6 | Primo turno guidato | S/M | 7, 1 |

**Scoperte importanti durante l'analisi**
- Il motore degli eventi **supporta già i bersagli** (`EventCardContext` in `engine/events.ts`: `targetTerritoryId`,
  `targetPlayerId`, `myCardIds`, `targetCardIds`, `seTargetId`). Manca solo l'interfaccia e la CPU: l'intervento 1 è
  soprattutto UI.
- La **CPU non gioca mai carte evento** (`useAIPlayer` usa solo `cashCardSet`).
- **Bug di regole** (fase 0): la tregua blocca solo la CPU, la Rappresaglia non scatta mai, la barricata non ha
  effetto, lo spostamento è solo fra territori adiacenti (TODO nel codice).
- Non esiste un framework di test: la verifica oggi passa da `scripts/simulate.ts` e `scripts/story-check.ts`.

---

## 0. Correzioni di regole (prerequisito)

**Stato attuale**
- `engine/combat.ts → validateAttack` controlla solo `NO_ATTACK_CENTRO`. La tregua (`TRUCE`) è verificata solo in
  `engine/ai.ts → aiChooseAttack`: un giocatore umano può attaccare il partner di tregua.
- `RAPPRESAGLIA_READY` viene aggiunto da `resolveEventCard` ma **nessuno lo legge**.
- `resolveAttack`: `effectiveDefendDice = Math.min(2, …)` annulla il dado extra della barricata (il commento dice il
  contrario).
- `gameStore.moveTroops`: solo adiacenti (`// TODO: BFS path validation`), mentre la guida/GDD parla di catene.

**Soluzione**
- Spostare il controllo tregua dentro `validateAttack` (unica fonte di verità) e rimuoverlo da `aiChooseAttack`.
  Tipizzare gli effetti con un type guard invece dei cast `(e as { player1… })`:
  ```ts
  export function isEffect<T extends ActiveEffect['type']>(e: ActiveEffect, type: T): e is Extract<ActiveEffect, { type: T }>;
  export function hasTruce(effects: readonly ActiveEffect[], a: PlayerId, b: PlayerId | null, round: number): boolean;
  ```
- Barricata: cap a 3 dadi difesa quando c'è barricata (`Math.min(barricade ? 3 : 2, troops)`), da confermare col GDD.
- Rappresaglia: vedi domanda aperta D1; proposta minima = all'inizio del proprio turno successivo, se si è perso un
  territorio dopo aver giocato la carta, si ottiene un attacco gratuito contro quel territorio (registrato in
  `ActiveEffect` come `{ type: 'RAPPRESAGLIA_TARGET'; playerId; territoryId }`).
- Spostamento a catena: `engine/movement.ts → reachableFriendly(state, from, playerId): ReadonlySet<TerritoryId>` (BFS),
  usato da `moveTroops`, `useTerritoryInteraction.moveable` e `aiChooseMovement`. Solo se confermato (D2).

**Rischi**: cambia il bilanciamento (CPU più prudente con la tregua, difese più forti con la barricata).
**Verifica**: `simulate` deve ancora finire tutte le partite; aggiungere in `simulate.ts` un'asserzione che nessun
attacco avvenga fra partner di tregua. **Stima** S.

---

## 7. Attacco: scelta dei dadi e attacco automatico

**Stato attuale**
- `gameStore.attackTerritory(fromId, toId)` calcola sempre `maxAttackDice(...)` e risolve **un** lancio.
- Dopo la conquista entrano solo i dadi sopravvissuti (`movedIn = attackDice - attackerLosses`), senza scelta.
- `useTerritoryInteraction.handleClick` attacca al secondo click; `CombatModal` mette in scena ogni lancio
  (`CombatSequence` + `uiStore.combatStage`, che la CPU attende in `useAIPlayer`).
- `aiChooseAttack` restituisce già un campo `dice`, ma lo store lo ignora.

**Tipi** (in `src/types/combat.ts`)
```ts
export type AttackMode = 'single' | 'blitz';

/** Ordine di attacco deciso dal giocatore (o dalla CPU). */
export interface AttackOrder {
  readonly fromId: TerritoryId;
  readonly toId: TerritoryId;
  /** 1..maxAttackDice (Colletti Bianchi fino a 4). */
  readonly dice: number;
  readonly mode: AttackMode;
  /** Solo blitz: si ferma quando la fonte scende a questo numero di truppe (minimo 2). */
  readonly stopAt: number;
}

/** Un singolo lancio dentro un attacco (anche automatico). */
export interface CombatRoundLog {
  readonly attacker: readonly number[];
  readonly defender: readonly number[];
  readonly attackerLosses: number;
  readonly defenderLosses: number;
}

/** Preferenze persistite (localStorage 'dominio.attack'). */
export interface AttackPreferences {
  /** 'max' = sempre il massimo consentito. */
  readonly dice: 'max' | 1 | 2 | 3;
  readonly mode: AttackMode;
  readonly stopAt: number;
  /** false = il secondo click attacca subito con queste preferenze. */
  readonly confirmEachAttack: boolean;
}

/** Occupazione dopo una conquista: quante truppe entrano. */
export interface PendingOccupation {
  readonly fromId: TerritoryId;
  readonly toId: TerritoryId;
  readonly min: number;   // dadi usati nell'ultimo lancio
  readonly max: number;   // truppe della fonte - 1
}
```
`PendingAttack` (in `types/game.ts`) si estende con `readonly mode: AttackMode` e `readonly rounds: readonly CombatRoundLog[]`;
i campi esistenti (`attackerLosses`, `defenderLosses`, `rolls`) diventano rispettivamente i totali e l'ultimo lancio, così
`CombatModal`, `narrative.ts` e `useGameAudio` continuano a funzionare.
`GameState` guadagna `pendingOccupation: PendingOccupation | null`.

**Motore** (`engine/combat.ts`, puro)
```ts
export type Rng = () => number;
export function rollDice(count: number, rng?: Rng): number[];
export interface BlitzResult { readonly rounds: readonly CombatRoundLog[]; readonly conquered: boolean; readonly attackerLosses: number; readonly defenderLosses: number }
export function resolveBlitz(input: {
  fromTroops: number; toTroops: number; dice: number; stopAt: number;
  attackerFaction: FactionId; defenderFaction: FactionId | null; toId: TerritoryId; fromId: TerritoryId; barricade: boolean;
}, rng?: Rng): BlitzResult;
```
Il ciclo ricalcola a ogni lancio i dadi disponibili (`min(dice scelti, maxAttackDice(truppe correnti))`) e si ferma alla
conquista, alla soglia o a un tetto di sicurezza (es. 60 lanci). L'RNG iniettabile rende i test deterministici.

**Store** (`gameStore`)
- `attackTerritory(order: AttackOrder)` sostituisce la firma attuale (aggiornare `useAIPlayer`, `useTerritoryInteraction`,
  `scripts/simulate.ts`). Valida `dice` contro `maxAttackDice`.
- Alla conquista: se l'attaccante è umano e `max > min`, imposta `pendingOccupation` e attende
  `occupy(count: number)`; la CPU sceglie subito (`aiChooseOccupation`). Finché c'è un'occupazione pendente,
  `handleClick` e `endAttackPhase` sono bloccati.
- Preferenze in `uiStore` (`attackPrefs` + `setAttackPrefs`), persistite come `mapMode`: sono presentazione/input, non
  stato di gioco.

**UI**
- `components/hud/AttackPanel.tsx` (nuovo): appare quando c'è una fonte selezionata in fase Attacco (ancorato in basso
  sulla mappa, non modale). Contiene:
  - dadi: `SegmentedControl<number>` da 1 al massimo;
  - modalità: "Un lancio" / "Fino alla conquista";
  - soglia: riuso di `TroopStepper` (da estrarre da `PhaseBar` in `components/common/`);
  - interruttore "Chiedi ogni volta";
  - probabilità di successo stimata (opzionale, D4).
  
  Con "Chiedi ogni volta" spento, il click sul bersaglio attacca subito.
- `CombatModal`: per `mode === 'blitz'` una `BlitzSummary` (numero di lanci, perdite totali, barra delle truppe che
  scende) e l'animazione 3D del **solo ultimo lancio** a velocità aumentata; "Salta" resta.
- `components/modals/OccupyDialog.tsx` (nuovo): slider truppe da spostare con default = massimo sensato.

**CPU**: `aiChooseAttack` restituisce un `AttackOrder` (blitz quando il vantaggio è ≥ 2, `stopAt` 3), così il turno CPU
dura molto meno (aiuta anche l'intervento 3).

**Alternative scartate**
- Blitz come N chiamate di `attackTerritory` con N animazioni: lento, e la CPU attenderebbe N scene.
- Preferenze nel `gameStore`: finirebbero nello stato della partita e nelle simulazioni.

**Rischi**: la nuova firma tocca CPU, simulazione e interazione; la scena 3D del combattimento assume un solo lancio.
**Verifica**
- `simulate` con RNG fisso: conservazione delle truppe; il blitz non scende mai sotto `stopAt`; nessun attacco con
  più dadi del consentito.
- Manuale: attacco con 1/2/3 dadi, blitz interrotto dalla soglia, occupazione con slider, preferenze ricordate dopo
  il ricaricamento della pagina.

**Stima** M.

---

## 1. Carte evento con bersaglio

**Stato attuale**
- `CardHandPanel.handlePlayEvent` gioca solo gli eventi in `INSTANT_EVENTS` (`cards/cardMeta.ts`); per gli altri
  mostra un avviso.
- `resolveEventCard` restituisce `needsInput: true` finché il contesto è incompleto.
- La Gazzetta non vede gli eventi: `detectStoryBeats(prev, next)` confronta solo territori e giocatori.

**Tipi**
```ts
// types/cards.ts
export type EventTargetKind = 'territory' | 'player' | 'card';

/** Cosa serve a un evento per essere risolto, calcolato dal motore. */
export interface EventTargetSpec {
  readonly steps: readonly EventTargetKind[];               // es. CORRUZIONE: ['player', 'card']
  readonly territories: ReadonlySet<TerritoryId>;           // bersagli validi
  readonly players: readonly PlayerId[];
  /** Per ACCORDO_COMM: quante carte per lato (max 2). */
  readonly maxCards?: number;
}

// types/game.ts — per la Gazzetta e il riepilogo CPU
export interface PlayedEvent {
  readonly eventId: EventCardId;
  readonly playerId: PlayerId;
  readonly targetTerritoryId?: TerritoryId;
  readonly targetPlayerId?: PlayerId;
  readonly round: number;
}
// GameState: lastEvent: PlayedEvent | null

// uiStore
export interface EventTargeting {
  readonly cardId: string;
  readonly eventId: EventCardId;
  readonly spec: EventTargetSpec;
  readonly step: number;
  readonly ctx: Partial<EventCardContext>;
}
```

**Motore**
- `engine/events.ts → getEventTargets(state, eventId, playerId): EventTargetSpec` (pura):
  - OPERAZIONE: tutti i territori con truppe;
  - IMMIGRAZIONE: i propri territori SE;
  - ACCORDO_PACE: avversari vivi;
  - CORRUZIONE: avversari con carte territorio;
  - ACCORDO_COMM: avversari con carte.
- `resolveEventCard` scrive `lastEvent`.
- `TerritoryVariant` guadagna `'targetable'` (anello color sodio in `board3d/constants.ts → VARIANT_RING` e nella mappa 2D).

**UI**
- `uiStore.eventTargeting` + azioni `beginEventTargeting`, `advanceEventTargeting`, `cancelEventTargeting`.
  Esc annulla (stesso listener di `GameBoard3D`).
- `useTerritoryInteraction`: se `eventTargeting` è attivo, ha precedenza sulla fase; `getVariant` restituisce
  `'targetable'` per `spec.territories`.
- `components/cards/EventTargetBar.tsx` (nuovo): barra in alto sulla mappa con nome della carta, istruzione del passo
  e Annulla.
- `components/cards/EventTargetDialog.tsx` (nuovo): scelta del giocatore (stemmi) e delle carte (riuso di
  `TerritoryCardView` in sola lettura).
- `CardHandPanel.handlePlayEvent` usa `getEventTargets`: se non ci sono passi gioca subito, altrimenti avvia la
  modalità bersaglio. Con nessun bersaglio valido il bottone "Gioca" è disabilitato e spiega perché.

**CPU**
- `engine/ai.ts → aiChooseEvent(state, playerId): { cardId; eventId; ctx } | null`, con euristiche semplici:
  - OPERAZIONE sul nemico più forte confinante;
  - IMMIGRAZIONE sul proprio confine SE più esposto;
  - CORRUZIONE al giocatore con più carte;
  - TREGUA col vicino più minaccioso.
- Si gioca all'inizio dei Rinforzi in `useAIPlayer`, con un ritardo leggibile e notifica.

**Gazzetta**: nuovo `StoryBeat` `{ kind: 'EVENT'; event: PlayedEvent; faction: FactionId }`, rilevato quando
`next.lastEvent !== prev.lastEvent`, con testi in `data/story.ts` per ciascuno dei 12 eventi (o per famiglia).

**Alternative scartate**: un modale unico con tutti i bersagli in elenco (perde il legame con la mappa, che è il punto
forte del gioco).

**Rischi**
- ACCORDO_COMM implica il consenso dell'altro giocatore (D3).
- Il furto con CORRUZIONE espone carte avversarie (D3).
- Gli eventi della CPU devono rispettare l'attesa degli interludi (`useAIPlayer` è già in pausa durante `ActInterlude`).

**Verifica**
- `simulate`: la CPU gioca eventi, le partite finiscono, nessuna carta duplicata o persa (conteggio mazzi + mani +
  scarti costante).
- `story-check`: articoli per gli eventi.
- Manuale: ognuno dei 12 eventi giocato da umano, con Esc a ogni passo.

**Stima** L.

---

## 3. Turno della CPU leggibile

**Stato attuale**: ritardi fissi in `useAIPlayer` (`DELAY_*`); la camera non segue nulla; gli spostamenti non lasciano
traccia; nessun riepilogo.

**Soluzione**
```ts
// uiStore
export interface CameraFocus { readonly x: number; readonly z: number; readonly distance: number; readonly key: string }
export interface ActionTrace { readonly id: string; readonly kind: 'attack' | 'move' | 'reinforce'; readonly from?: TerritoryId; readonly to: TerritoryId; readonly at: number }
export type CpuSpeed = 'cinematic' | 'normal' | 'fast';
// cameraFocus: CameraFocus | null · traces: readonly ActionTrace[] · cpuSpeed (persistito)

// engine/recap.ts (puro)
export interface TurnRecap { readonly playerId: PlayerId; readonly reinforced: number; readonly conquered: readonly TerritoryId[]; readonly lost: readonly TerritoryId[]; readonly cardsDrawn: number; readonly event: PlayedEvent | null }
export function summarizeTurn(before: GameState, after: GameState, playerId: PlayerId): TurnRecap;
```
- `CameraRig`: segue `cameraFocus` con lo stesso smorzamento del volo d'ingresso. Al termine del turno CPU torna
  all'inquadratura dell'utente (salvata). Se l'utente tocca la mappa, la camera smette di seguire per quel turno.
  Toggle "Segui la CPU".
- `ConnectionArcs` riusato per `traces` (svaniscono in ~2,5 s) e un "+N" fluttuante sui rinforzi.
- `components/hud/TurnRecap.tsx`: card in sovrimpressione a fine turno CPU ("Durante la notte di Rosaria…"),
  chiudibile e auto-chiusa. I testi riusano le forme grammaticali di `FACTION_LORE`.
- `useAIPlayer`: i ritardi diventano funzione di `cpuSpeed`.

**Rischi**: la camera che si muove da sola può infastidire, quindi deve restare disattivabile; c'è possibile
conflitto con `OrbitControls` (gestito come per l'intro).
**Verifica**: manuale con 3 CPU; `simulate` invariato (logica solo UI).
**Stima** M (dopo 7, che accorcia già i turni con il blitz).

---

## 2. La notte che avanza

**Stato attuale**: `BoardEnvironment` ha luce diurna fissa (sole `#ffe7c8`, emisferica chiara, sfondo `#0f1622`).
`useBoardModels` sostituisce `VC_Glow` con un `MeshBasicMaterial` sempre acceso. Le auto hanno fari, il faro ruota.

**Soluzione** (solo three.js, nessuna riesportazione da Blender nella prima versione)
```ts
// types/board3d.ts
export interface SkyState {
  readonly background: string;
  readonly fog: readonly [near: number, far: number];
  readonly sun: { readonly color: string; readonly intensity: number; readonly elevation: number; readonly azimuth: number };
  readonly hemi: { readonly sky: string; readonly ground: string; readonly intensity: number };
  readonly glow: number;        // 0..1 intensità di finestre/lampioni (VC_Glow)
  readonly headlights: number;  // 0..1
  readonly stars: number;       // 0..1
}
// data/sky.ts: chiavi 'dusk' | 'evening' | 'night' | 'deep' | 'dawn' → SkyState
export function skyForRound(round: number, phase: GamePhase): SkyState; // 1 tramonto · 2–3 sera · 4–6 notte · 7+ notte fonda · GAME_OVER alba
```
- `BoardEnvironment` interpola verso lo `SkyState` corrente (smorzamento in `useFrame`, come `HexBase`).
- Luna: luce direzionale fredda che diventa la "chiave" di notte.
- Stelle: `<Stars>` di drei con opacità variabile.
- Il materiale glow condiviso (`GLOW_MATERIAL`) riceve un colore moltiplicato da `glow`.
- `Traffic` e `Lighthouse` leggono `headlights`.
- Opzionale, solo in qualità alta: bloom con `@react-three/postprocessing` per far "brillare" finestre, fari e faro (D5).

**Alternative scartate**
- Luci puntiformi per ogni lampione: centinaia di luci, costo enorme.
- Riesportare la città con texture notturne: lavoro Blender più lungo, da valutare solo se il risultato in three.js
  non basta.

**Rischi**
- Di notte la città a colori vertex può diventare troppo scura: serve taratura (lettura dei gettoni prima di tutto).
- Il bloom costa sui telefoni, quindi solo in qualità alta.

**Verifica**: screenshot per ogni stato (round 1/3/5/7 e GAME_OVER), leggibilità di gettoni e confini; FPS su mobile
in qualità bassa.

**Stima** M.

---

## 4. Leggibilità del possesso

**Soluzione**
- 3D: `board3d/OwnershipDecal.tsx`:
  - disco esagonale sul terreno attorno a ogni territorio, colore della fazione, sfumato ai bordi;
  - una `CanvasTexture` radiale condivisa, trasparente, `depthWrite=false`;
  - il colore sfuma al cambio proprietario, come `HexBase`.
- Zone controllate: `board3d/ZoneOutline.tsx`:
  - rettangolo arrotondato calcolato da `ZONE_DEFINITIONS[z].svgBounds` (stessa formula `zone_rect` di
    `build_dominio.py`, con `unitPerSvgPx` e `svgOrigin` da `board3d.json`);
  - si accende nel colore della fazione che la controlla tutta, con l'etichetta "+N" del bonus (Html).
- 2D (`components/map/GameMap.tsx`): stesse regole (riempimento zona e contorno).
- `PlayerPanel`: elenco delle zone controllate con il bonus.
- Funzione pura condivisa: `engine/reinforcements.ts → controlledZones(state): ReadonlyMap<ZoneId, PlayerId>`
  (oggi la logica è dentro `calculateReinforcements`).

**Rischi**: sovrapposizione con i confini cotti nella città (servono offset/spessori più grandi).
**Verifica**: screenshot con zone conquistate.
**Stima** S/M.

---

## 5. Qualità grafica e mobile

**Soluzione**
```ts
// store/graphicsStore.ts (persistito 'dominio.graphics', come audioStore)
export type GraphicsQuality = 'auto' | 'high' | 'low';
export interface GraphicsBudget { readonly shadows: boolean; readonly shadowMapSize: 1024 | 2048; readonly dpr: readonly [number, number]; readonly embers: number; readonly cars: number; readonly gulls: boolean; readonly bloom: boolean }
export function budgetFor(q: Exclude<GraphicsQuality, 'auto'>): GraphicsBudget;
```
- `'auto'` usa `PerformanceMonitor` di drei per scendere a `'low'` se gli FPS calano. Il selettore sta nel menu audio,
  che diventa "Impostazioni".
- Bundle:
  - misurare con `rollup-plugin-visualizer`;
  - il chunk da ~950 KB è three/drei;
  - importare solo i moduli drei usati;
  - precaricare `GameBoard3D` durante il prologo, così il costo si paga mentre si legge.
- Mobile sotto i 768 px:
  - la sidebar diventa un cassetto dal basso (`components/hud/BottomSheet.tsx`, tre altezze: chiuso con le
    schede, metà, pieno);
  - la barra del turno diventa compatta;
  - bersagli touch ≥ 44 px.

**Rischi**: il cassetto può coprire i territori in basso (camera con offset quando è aperto).
**Verifica**: Lighthouse/Chrome DevTools su profilo mobile; FPS in `'low'` ≥ 45 su un telefono medio.
**Stima** M.

---

## 6. Primo turno guidato

**Soluzione**
```ts
// store/tutorialStore.ts (persistito 'dominio.tutorial')
export type CoachStepId = 'place' | 'attack' | 'dice' | 'move' | 'cards';
export interface CoachStep { readonly id: CoachStepId; readonly when: (g: GameState, ui: UIState) => boolean; readonly anchor: string /* data-coach */; readonly text: string }
// seen: ReadonlySet<CoachStepId>, enabled: boolean
```
- `components/hud/CoachMark.tsx`: fumetto ancorato a un elemento `[data-coach="…"]` o a un territorio. Le ancore 3D
  passano da un `Html` dedicato. Ha "Ho capito" e "Salta la guida".
- Si mostra solo nei turni umani, quindi non blocca la CPU, e un passo alla volta.
- "Rivedi la guida" in `GuidePanel`.

**Verifica**: prima partita da profilo pulito, un fumetto per fase; nessuno alla seconda partita.
**Stima** S/M.

---

## Ordine di esecuzione

1. **Fase A — Regole solide**: intervento 0 (+ RNG iniettabile in `combat.ts`).
2. **Fase B — Attacco**: intervento 7 (scelta dadi → blitz → occupazione → preferenze → CPU).
3. **Fase C — Eventi completi**: intervento 1 (motore + UI umana → CPU → Gazzetta).
4. **Fase D — Leggibilità**: interventi 4 e 3.
5. **Fase E — Atmosfera e prestazioni**: intervento 5 (budget grafico), poi 2 (notte, con bloom solo in alta qualità).
6. **Fase F — Accoglienza**: intervento 6, scritto per ultimo perché descrive l'interfaccia finale.

Ogni fase si chiude con build, lint, simulate, story-check, una partita manuale completa e l'aggiornamento di
`CLAUDE.md` e del grafo (`./scripts/graph.sh`).

## Domande aperte (da decidere)

- **D1 · Rappresaglia**: deve scattare subito durante il turno avversario (interrompe il flusso, più complesso) o
  all'inizio del proprio turno (proposta)?
- **D2 · Spostamento**: solo adiacenti (come oggi) o lungo catene di territori propri (Risiko classico)?
- **D3 · Eventi tra giocatori**:
  - Accordo Commerciale richiede il consenso dell'altro (con la CPU che valuta lo scambio) o è imposto?
  - Con Corruzione le carte avversarie si vedono o si pesca alla cieca?
- **D4 · Attacco**:
  - mostrare la probabilità di vittoria stimata nel pannello (aiuta i nuovi giocatori, toglie un po' di tensione)?
  - i difensori umani in hotseat scelgono i propri dadi o difendono sempre al massimo?
- **D5 · Notte**: va bene aggiungere `@react-three/postprocessing` (bloom) solo in qualità alta?
- **D6 · Test**: introdurre Vitest per il motore (consigliato per blitz ed eventi) o continuare solo con gli script
  di simulazione?
- **D7 · Barricata**: confermare dal GDD che concede un terzo dado in difesa.
