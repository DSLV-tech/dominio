# Pianificazione miglioramenti — Dominio

Sei nel repository di **Dominio** (cartella `dominio-game`). Prima di tutto leggi `CLAUDE.md`
e `graphify-out/GRAPH_REPORT.md`, poi esplora solo i file che ti servono.

## Obiettivo di questa sessione
Produrre un **piano di implementazione**, NON codice. Salvalo in `docs/PIANO_MIGLIORAMENTI.md`
e fermati lì: lo rivedo io prima di iniziare.

## Vincoli (non negoziabili)
- React 19 + TypeScript strict, niente `any`; tipi/interfacce definiti prima dell'implementazione.
- Modifiche mirate e incrementali: niente rifacimenti totali, riusa i componenti esistenti.
- Regole di gioco solo in `src/engine/` (funzioni pure); stato in Zustand (`gameStore`, `uiStore`, `storyStore`).
- Stili solo con i token di `src/index.css` (`--ink-*`, `--sodium`, `--phase-*`, `--bevel`, `--surface-*`…).
- Ogni nuova parte con stati di caricamento ed ErrorBoundary dove ha senso; animazioni che rispettano
  `prefersReducedMotion()` (`src/components/common/motion.ts`).
- Il gioco deve restare giocabile dopo ogni fase: `npm run build`, `npm run lint`,
  `npm run simulate -- 20 4` e `npm run story -- 30 3` devono passare.

## Interventi da pianificare

### 1. Carte evento con bersaglio
Oggi 5 eventi su 12 (OPERAZIONE, ACCORDO_PACE, IMMIGRAZIONE, CORRUZIONE, ACCORDO_COMM) mostrano solo
"seleziona un bersaglio" e non hanno effetto (`CardHandPanel` → `INSTANT_EVENTS`, `engine/events.ts` →
`resolveEventCard` / `needsInput`). Voglio una modalità "scelta bersaglio" condivisa fra mappa 2D e 3D
(`useTerritoryInteraction`): clicchi "Gioca", i bersagli validi si illuminano come per l'attacco, scegli,
confermi o annulli (Esc). Per eventi su un giocatore o sulle carte (tregua, furto, scambio) un piccolo pannello
di scelta. Anche la CPU (`engine/ai.ts`, `useAIPlayer`) deve saper giocare questi eventi, e la Gazzetta
(`engine/narrative.ts`) raccontarli.

### 2. La notte che avanza
La scena 3D è illuminata di giorno ma il gioco è "La Notte Lunga di Novarata". Voglio un ciclo crepuscolo →
notte fonda → alba legato ai turni (`round`, atti in `data/story.ts`), con transizioni morbide: luci e cielo
(`BoardEnvironment`), materiale `VC_Glow` di finestre e lampioni (`useBoardModels`), fari delle auto e faro
(`board3d/ambient/`). Valuta se basta three.js o serve rigenerare materiali in Blender (`blender/`).
Indica l'impatto sulle prestazioni.

### 3. Turno della CPU leggibile
Le mosse CPU sono troppo rapide da seguire. Valuta: camera che si avvicina a ogni scontro (`CameraRig`),
scia animata per gli spostamenti, riepilogo a fine turno ("Durante la notte di …"). Rispetta il meccanismo
esistente per cui la CPU attende `uiStore.combatStage`.

### 4. Leggibilità del possesso
Il possesso si legge quasi solo dal colore del gettone. Valuta una tinta della fazione sul terreno attorno
all'esagono e i confini di zona che si accendono quando una fazione controlla una zona intera (bonus visibile),
sia in 3D sia nella mappa 2D (`components/map/`).

### 5. Prestazioni e mobile
Impostazione qualità alta/bassa (ombre 2048, particelle, traffico) persistita come le preferenze audio;
valuta lo split del chunk dei modelli (~950 KB). Su schermi stretti, sidebar come cassetto dal basso così
la mappa usa tutto lo schermo.

### 6. Primo turno guidato
3–4 indicazioni contestuali alla prima partita (piazza, attacca, sposta, carte), saltabili, non mostrate
di nuovo, che non blocchino la CPU.

### 7. Attacco: scelta dei dadi e attacco automatico
Oggi `gameStore.attackTerritory` lancia sempre `maxAttackDice` e ogni lancio richiede la scena di combattimento.
Voglio:
- scegliere con quanti dadi attaccare (da 1 al massimo consentito, inclusi il dado extra dei Colletti Bianchi);
- scegliere se attaccare un lancio alla volta oppure in automatico fino alla conquista, con una soglia di
  arresto ("fermati se mi restano N truppe");
- una scena di combattimento riassuntiva per l'attacco automatico (non N animazioni di fila);
- preferenze ricordate fra una partita e l'altra, con la possibilità di attaccare subito con le impostazioni
  salvate senza aprire ogni volta il pannello.
Valuta anche la scelta delle truppe da spostare dopo una conquista (oggi entrano solo i dadi sopravvissuti),
come la CPU deve usare queste opzioni e se i difensori umani (partite in hotseat) debbano scegliere i loro dadi.

## Cosa deve contenere il piano
Per ogni intervento:
1. **Stato attuale**: file e funzioni coinvolti (percorsi reali verificati nel codice).
2. **Soluzione proposta**: nuovi tipi/interfacce (scritti per esteso), componenti, hook e azioni dello store
   da aggiungere o modificare, scelta di state management motivata.
3. **Alternative scartate** e perché.
4. **Rischi**: regressioni su motore, CPU, narrativa, prestazioni.
5. **Verifica**: test o script da aggiungere/aggiornare, criteri di accettazione osservabili.
6. **Stima** (S/M/L) e dipendenze da altri interventi.

In fondo: un **ordine di esecuzione in fasi**, ognuna rilasciabile da sola, e le **domande aperte**
su cui devo decidere io (game design, priorità, compromessi).
