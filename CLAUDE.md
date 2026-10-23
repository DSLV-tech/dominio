# Dominio — note per Claude

Gioco web di strategia territoriale tipo Risiko ambientato a Novarata (città immaginaria).
Stack: React 19 + TypeScript strict, Zustand, Vite, three.js (@react-three/fiber) per la vista 3D.
Modelli 3D generati da Blender (`blender/`): città/monumenti da `build_dominio.py` + `export_gltf.py`;
truppe, bandiere, dadi, arena e stemmi (PNG in `public/ui/`) da `build_pezzi.py` → `./scripts/models.sh`. Game design completo in `../GDD_Dominio.md`.

## Parti da qui: grafo Graphify
Prima di esplorare i file, leggi `graphify-out/GRAPH_REPORT.md` (nodi centrali, comunità, struttura).
Per domande mirate usa il grafo invece di rileggere tutto:
- `graphify query "domanda"` · `graphify explain "useGameStore"` · `graphify path "A" "B"`
Dopo modifiche al codice aggiorna il grafo: `./scripts/graph.sh` (nessuna API key necessaria).

## Architettura
- `src/engine/` regole pure (combattimento, rinforzi, vittoria, eventi, CPU, `narrative.ts`)
- `src/store/` Zustand: `gameStore` (stato di gioco), `uiStore` (selezioni, schede, toast), `storyStore` (Gazzetta, interludi)
- `src/hooks/` `useAIPlayer` (turni CPU, in pausa durante gli interludi), `useStoryDirector` (gameStore → motore narrativo → Gazzetta), `useTerritoryInteraction` (click condivisi 2D/3D)
- `src/components/` `hud/` (PhaseBar, Sidebar a schede, PlayerPanel, GuidePanel), `story/` (Prologo, ActInterlude, ChroniclePanel, TerritoryInfoCard), `board3d/`, `map/` (2D SVG), `modals/`, `setup/`
- `src/audio/` audio sintetizzato con Web Audio (nessun file): `engine.ts` (singleton `audio.play('clash')`, `audio.setMood('combat')`), `sfx.ts` (catalogo effetti), `music.ts` (colonna sonora generativa a strati). Preferenze in `store/audioStore.ts` (localStorage); `hooks/useGameAudio.ts` collega gameStore → suoni e sblocca l'AudioContext al primo gesto.
- `src/components/combat/` scontro: `CombatArena3D` (piazza 3D, dadi che atterrano sulla faccia decisa dalle regole, carica, cadute, scintille), `CombatDice2D` (riserva senza WebGL), `combatView.ts` (PendingAttack → vista), scaletta in `src/data/combatTimeline.ts`. La fase corrente va in `uiStore.combatStage`: la CPU aspetta l'esito prima di proseguire.
- `src/components/cards/` mano di carte: `TerritoryCardView` (insegna SVG per grado: bronzo/argento/oro), `EventCardView` (dispaccio), `SetBonusBar`, `useCardTilt` (tilt 3D via custom properties, niente re-render), metadati in `cardMeta.ts`; stili in `src/styles/cards.css`.
- Animazioni mappa 3D: volo d'ingresso in `CameraRig`, sollevamento hover + `ConquestPulse` in `Territory3D`, colori che sfumano in `HexBase`, archi animati in `ConnectionArcs`, braci e bagliore in `BoardEnvironment`. Tutte rispettano `prefersReducedMotion()` (`components/common/motion.ts`).
- Vita della città (`board3d/ambient/`, puramente decorativa, con ErrorBoundary propria): `Traffic` (auto in InstancedMesh sulle strade di `src/data/traffic.json`), `Boats` (rotte in `src/data/ambient.ts`), `Lighthouse`, `Gulls`. Le strade sono cotte in `citta.glb`: se cambia la mappa in Blender rigenera i tracciati con `npm run traffic`.
- Mappa 2D (`components/map/`): geometria in `layout2d.ts` (cornici delle zone ricavate da `svgPosition`, strade curve calcolate attorno ai territori); `svgBounds` delle zone serve solo a `board3d/ZoneOutline`.
- Cornice "DOMINIO" della plancia: `useBoardModels.prepareModel` rende opachi i fianchi della vasca del mare e abbassa il filetto d'oro (niente riflesso/sfarfallio sul bordo).
- Profondità UI: token `--bevel`, `--sunken`, `--shadow-s/m`, `--surface-1/2/3` in `src/index.css`; usarli invece di fondi piatti.
- Stili: CSS globale con token in `src/index.css`; componenti in `src/styles/ui.css` e `src/styles/story.css`. Niente colori sparsi: usare le variabili (`--ink-*`, `--sodium`, `--paper`, `--phase-*`).

## Attacco
`gameStore.attackTerritory(order: AttackOrder)`: dadi scelti, modalità `single`/`blitz` (`engine/combat.ts → resolveAttackOrder`).
Preferenze in `uiStore.attackPrefs` (localStorage `dominio.attack`), pannello `hud/AttackPanel`. Dopo una conquista umana
`pendingOccupation` + `occupy(n)` (`modals/OccupyDialog`). La tregua è verificata in `validateAttack`. Rappresaglia: `RAPPRESAGLIA_READY` → `RAPPRESAGLIA_TARGET` (primo lancio senza perdite). Spostamento: `GameState.movementRule` (`adjacent`/`chain`, scelto in lobby), `engine/movement.ts`.

## Eventi, CPU, grafica, guida
- Eventi con bersaglio: `engine/events.ts → getEventTargets`, `uiStore.eventTargeting`, `cards/EventTargetBar`; la CPU gioca via `ai.ts → aiChooseEvent`; Gazzetta: `GameState.lastEvent` → beat `EVENT`.
- Turno CPU: `store/settingsStore` (velocità, camera), `uiStore.cameraFocus/traces/turnRecap`, `engine/recap.ts`, `hud/TurnRecap`.
- Possesso: `engine/reinforcements.ts → controlledZones`, `board3d/OwnershipDecal`, `board3d/ZoneOutline`.
- Cielo: `data/sky.ts` + `BoardEnvironment` (SkyDirector); valori condivisi per frame in `board3d/skyRuntime.ts`. Qualità: `board3d/graphics.ts` (`useGraphicsBudget`).
- Mobile: `hud/BottomSheet` sotto i 768 px o con telefono in orizzontale (`hooks/useIsNarrow`, stessa condizione in `styles/mobile.css`). `styles/mobile.css` (importato per ultimo) tiene la partita a schermo intero senza scroll di pagina, compatta topbar/barra del turno e i pannelli sulla mappa, scontro su due colonne in orizzontale, carta 2D scorrevole col dito. La camera 3D (`CameraRig.cameraView`) nei pannelli verticali gira di 90° (porto in basso), guarda il centro dei territori e si allontana quanto basta a inquadrarli con le targhe; in orizzontale (pannello molto largo) conta anche l'altezza; si reinquadra quando cambia la distanza necessaria (rotazione del telefono). Nei nomi della mappa 2D il colore è inline (`TerritoryNode`, Safari iOS). `board3d.css` arriva dopo `mobile.css` (chunk a richiesta): per sovrascriverlo serve più specificità (`.stage .b3d-root`). Sui telefoni i riquadri che su desktop galleggiano sulla mappa (scheda territorio, pannello d'attacco compatto, carte evento, riepilogo CPU, guida, suggerimento di fase) stanno in `hud/MapDock`, fascia ad altezza fissa sotto la mappa (a destra in orizzontale) che mostra un riquadro alla volta: non coprono mai i territori e la mappa non si sposta. Schermi bassi (telefono in orizzontale): blocco in fondo a `mobile.css` che compatta prologo, interludi, prima pagina finale, lobby e mette il cassetto su due colonne. Lobby sul telefono (`setup/SetupScreen`, `useIsNarrow` → `.lobby--compact`): tutta in uno schermo senza scorrere; righe giocatore compatte (`PlayerRow`), un solo `FactionPicker` e un solo `Dossier` per la riga selezionata; il dossier mostra fazione e abilità e apre il resto a richiesta, ed è l'unica parte che scorre se manca spazio. Toccare la fazione di un altro giocatore la scambia (`applyPatch`).
- PWA: `public/manifest.webmanifest`, icone in `public/icons/` (sorgente `public/favicon.svg`), service worker `public/sw.js` (cambiare `VERSION` per svuotare le cache), registrazione e prompt d'installazione in `src/pwa/install.ts`, invito in lobby `setup/InstallHint`. Il service worker è attivo solo nella build (`npm run build && npm run preview`).
- Guida del primo turno: `store/tutorialStore`, `data/coach.ts`, `hud/CoachMark`.

## Storia: "La Notte Lunga di Novarata"
Contenuti in `src/data/story.ts`: prologo (3 pagine), 4 atti per turno (1, 3, 5, 7) con indizi sul mistero
dell'incendio, dossier delle fazioni (leader, motto, movente, segreto, forme grammaticali), riga di racconto
per ogni territorio, 12 epiloghi (fazione × condizione di vittoria).
`engine/narrative.ts`: `detectStoryBeats(prev, next)` → `filterNewsworthy` (anti-ripetizione) → `beatToDispatch`.

## Comandi
- `npm run dev` · `npm run build` · `npm run lint`
- `npm run simulate -- 20 4` partite CPU vs CPU (verifica che finiscano)
- `npm run story -- 30 3` verifica narrativa (articoli generati, grammatica, epiloghi)
- `npm run combat` verifica deterministica del motore di combattimento (blitz, tregua)
- `npm run traffic` rigenera i tracciati delle auto da `citta.glb` (dopo modifiche alla mappa in Blender)

## Preferenze
Rispondere in italiano. Modifiche mirate e incrementali, niente rifacimenti totali.
