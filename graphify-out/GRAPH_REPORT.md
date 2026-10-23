# Graph Report - dominio  (2026-10-23)

## Corpus Check
- 158 files · ~69,317 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 15 file(s) not represented in the graph (top: .css 12, (none) 2, .rules 1)

## Summary
- 1125 nodes · 3321 edges · 58 communities (52 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 34 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0b0183cc`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- react
- engine/index.ts
- types/index.ts
- CameraRig.tsx
- data/index.ts
- narrative.ts
- compilerOptions
- compilerOptions
- package.json
- devDependencies
- CardHandPanel.tsx
- dependencies
- scripts
- React + TypeScript + Vite
- onlineStore.ts
- tsconfig.json
- graph.sh
- SetupScreen.tsx
- GameMap.tsx
- useBoardModels.ts
- useGameStore
- Territory3D.tsx
- Traffic.tsx
- App.tsx
- CombatSquad.tsx
- CombatArena3D.tsx
- CombatModal.tsx
- traffic.ts
- GameBoard3D.tsx
- CityLife.tsx
- ai.ts
- install.ts
- AudioControls.tsx
- Sidebar.tsx
- story-check.ts
- gameStore.ts
- MusicDirector
- CombatDie.tsx
- engine.ts
- BoardScene.tsx
- AudioEngine
- sfx.ts
- PhaseBar.tsx
- tutorialStore.ts
- Boats.tsx
- BoardEnvironment.tsx
- events.ts
- settingsStore.ts
- useStageCursorSide.ts
- TerritoryBadge.tsx
- CombatDice2D.tsx
- Dominio — note per Claude
- music.ts
- reinforcements.ts
- firebase-setup.sh
- deploy.sh
- models.sh
- vite-env.d.ts

## God Nodes (most connected - your core abstractions)
1. `react` - 79 edges
2. `useGameStore` - 73 edges
3. `TerritoryId` - 69 edges
4. `GameState` - 34 edges
5. `useUIStore` - 31 edges
6. `PlayerId` - 31 edges
7. `FactionId` - 30 edges
8. `cssVars()` - 29 edges
9. `useOnlineStore` - 29 edges
10. `prefersReducedMotion()` - 25 edges

## Surprising Connections (you probably didn't know these)
- `Attacco` --references--> `validateAttack()`  [INFERRED]
  CLAUDE.md → src/engine/combat.ts
- `Eventi, CPU, grafica, guida` --references--> `useGraphicsBudget()`  [INFERRED]
  CLAUDE.md → src/components/board3d/graphics.ts
- `Architettura` --references--> `useCardTilt()`  [INFERRED]
  CLAUDE.md → src/components/cards/useCardTilt.ts
- `Online (`src/online/`)` --references--> `handleOnline()`  [INFERRED]
  CLAUDE.md → src/components/setup/SetupScreen.tsx
- `Architettura` --references--> `useAIPlayer()`  [INFERRED]
  CLAUDE.md → src/hooks/useAIPlayer.ts

## Import Cycles
- None detected.

## Communities (58 total, 6 thin omitted)

### Community 0 - "react"
Cohesion: 0.22
Nodes (13): react, CONDITION_LABELS, ActInterlude, ChroniclePanel, DispatchItem, TONE_LABEL, PrologueScreen(), FACTION_DEFINITIONS (+5 more)

### Community 1 - "engine/index.ts"
Cohesion: 0.15
Nodes (22): effects, fromId, AttackOrderContext, AttackValidationResult, CombatRoll, hasTruce(), isEffect(), MAX_BLITZ_ROUNDS (+14 more)

### Community 2 - "types/index.ts"
Cohesion: 0.06
Nodes (83): ConnectionArcsProps, FlowingArcProps, Territory3DProps, ZoneLabelProps, ZoneOutlineProps, CardPickerProps, PlayerPickerProps, Props (+75 more)

### Community 3 - "CameraRig.tsx"
Cohesion: 0.09
Nodes (28): CameraRig, CameraView, CITY_CENTER, clamp(), easeInOut(), fitDistance(), IntroState, OFFSET_LENGTH (+20 more)

### Community 4 - "data/index.ts"
Cohesion: 0.19
Nodes (15): ZONE_ORDER, EVENT_CARDS, EVENT_CARDS_2P, getSetBonus(), SYMBOL_ASSIGNMENT, TERRITORY_CARDS, PROLOGUE, ZONE_LORE (+7 more)

### Community 5 - "narrative.ts"
Cohesion: 0.15
Nodes (20): Storia: "La Notte Lunga di Novarata", actForRound(), EVENT_ARTICLES, STORY_ACTS, actNumber(), beatToDispatch(), capitalize(), detectStoryBeats() (+12 more)

### Community 6 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+14 more)

### Community 7 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+11 more)

### Community 8 - "package.json"
Cohesion: 0.11
Nodes (21): name, private, type, version, draco3dgltf, eslint, @eslint/js, eslint-plugin-react-hooks (+13 more)

### Community 9 - "devDependencies"
Cohesion: 0.11
Nodes (19): devDependencies, draco3dgltf, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, @gltf-transform/core (+11 more)

### Community 10 - "CardHandPanel.tsx"
Cohesion: 0.23
Nodes (15): Online (`src/online/`), CardHand, CardHandPanel, EMPTY_HAND, HandEmpty(), evaluateSet(), SetBonusBar, runsAI() (+7 more)

### Community 11 - "dependencies"
Cohesion: 0.25
Nodes (8): dependencies, firebase, react, react-dom, @react-three/drei, @react-three/fiber, three, zustand

### Community 12 - "scripts"
Cohesion: 0.20
Nodes (10): scripts, build, combat, deploy, dev, lint, preview, simulate (+2 more)

### Community 13 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 14 - "onlineStore.ts"
Cohesion: 0.05
Nodes (62): firebase, Connecting(), RoomScreen(), SeatRow, SeatRowProps, seatStatus(), ShareLink, ShareLinkProps (+54 more)

### Community 17 - "SetupScreen.tsx"
Cohesion: 0.05
Nodes (65): Eventi, CPU, grafica, guida, CardInsignia, CardInsigniaProps, METAL_STOPS, CardMetal, INSTANT_EVENTS, SetEvaluation, SYMBOL_META (+57 more)

### Community 18 - "GameMap.tsx"
Cohesion: 0.08
Nodes (38): Board3DFallback, Board3DFallbackProps, ConnectionLines, LineTone, Props, Backdrop, Cartouche, cornerTicks() (+30 more)

### Community 19 - "useBoardModels.ts"
Cohesion: 0.11
Nodes (26): Architettura, FRAME_SIDE_MATERIAL, GLOW_MATERIAL, isFactionId(), lowerGoldTrim(), prepareModel(), ShadowFlags, splitSeaSides() (+18 more)

### Community 20 - "useGameStore"
Cohesion: 0.22
Nodes (22): GameScreen(), EventTargetBar, INSTRUCTION, cardLabel(), CardPicker, PlayerPicker, AttackPanel, CoachMark (+14 more)

### Community 21 - "Territory3D.tsx"
Cohesion: 0.17
Nodes (19): @react-three/fiber, ConquestPulse, ConquestPulseProps, easeOut(), HEX_RADIUS, HEX_SKIRT_DEPTH, HEX_TOP_RADIUS, PAVING_COLOR (+11 more)

### Community 22 - "Traffic.tsx"
Cohesion: 0.13
Nodes (22): three, GullSpec, GullsProps, WING, mulberry32(), pick(), Rng, smoothstep() (+14 more)

### Community 23 - "App.tsx"
Cohesion: 0.11
Nodes (16): App(), AppCrash(), GameBoard3D, loadBoard3D(), MAP_MODES, MAP_MODES_SHORT, StageFallback(), ConfirmDialog() (+8 more)

### Community 24 - "CombatSquad.tsx"
Cohesion: 0.15
Nodes (24): collectMaterials(), CombatClock, DIE_COLUMN_X, dieRestPosition(), dieRowZ(), FIGURE_SCALE, figureHome(), figureTarget() (+16 more)

### Community 25 - "CombatArena3D.tsx"
Cohesion: 0.16
Nodes (23): CombatClockRef, ArenaScene(), CAM_CLASH, CAM_FROM, CAM_TO, ClockDriver(), ClockDriverProps, CombatArena3D (+15 more)

### Community 26 - "CombatModal.tsx"
Cohesion: 0.15
Nodes (20): buildCombatView(), diceVerdicts(), hasWebGL(), ArenaLoading(), attackKeys, BlitzSummary, CombatArena3D, CombatModal (+12 more)

### Community 27 - "traffic.ts"
Cohesion: 0.10
Nodes (15): three-mesh-bvh, Anchor, board, caster, ELEVATED, ids, io, LIGHTHOUSE_XZ (+7 more)

### Community 28 - "GameBoard3D.tsx"
Cohesion: 0.18
Nodes (13): @react-three/drei, BoardLoadingOverlay, CAMERA_FOV, CAMERA_OFFSET, GameBoard3D(), budgetFor(), HIGH, isConstrainedDevice() (+5 more)

### Community 29 - "CityLife.tsx"
Cohesion: 0.15
Nodes (12): CityLife, CityLifeContent, CityLifeProps, Gulls, beamGeometry(), Lighthouse, LighthouseProps, ErrorBoundary (+4 more)

### Community 30 - "ai.ts"
Cohesion: 0.26
Nodes (17): AIAction, aiChooseAttack(), aiChooseEvent(), aiChooseMovement(), aiChooseReinforcement(), AIMovementDecision, AITurnPlan, attackTargetScore() (+9 more)

### Community 31 - "install.ts"
Cohesion: 0.17
Nodes (12): react-dom, InstallHint, BeforeInstallPromptEvent, current(), InstallState, isIOS(), isStandalone(), listeners (+4 more)

### Community 32 - "AudioControls.tsx"
Cohesion: 0.18
Nodes (13): audio, AudioControls, QUALITY_OPTIONS, SpeakerIcon(), SPEED_OPTIONS, VolumeSlider, VolumeSliderProps, AudioStore (+5 more)

### Community 33 - "Sidebar.tsx"
Cohesion: 0.19
Nodes (12): SegmentedControl, SegmentedControlProps, SegmentOption, BottomSheet, LABEL, NEXT, SheetLevel, GuidePanel (+4 more)

### Community 34 - "story-check.ts"
Cohesion: 0.13
Nodes (14): GAMES, PLAYERS, results, rounds, chronicle, GAMES, kinds, lastChronicle (+6 more)

### Community 35 - "gameStore.ts"
Cohesion: 0.18
Nodes (13): AttackPanelProps, DiceChoice, MODE_OPTIONS, MODE_OPTIONS_SHORT, clampAttackDice(), maxAttackDice(), orderFromPrefs(), resolveAttackOrder() (+5 more)

### Community 37 - "CombatDie.tsx"
Cohesion: 0.18
Nodes (13): DIE_SIZE, BLACK, CombatDie, instantiate(), LOSE_TINT, WHITE, WIN_GLOW, bounceHeight() (+5 more)

### Community 38 - "engine.ts"
Cohesion: 0.20
Nodes (10): AudioContextCtor, Graph, isIOS(), makeSilentWavUrl(), NavigatorWithSession, playSfx(), SfxContext, TimedSfx (+2 more)

### Community 39 - "BoardScene.tsx"
Cohesion: 0.24
Nodes (12): BoardScene(), TERRITORY_IDS, ZONE_IDS, ConnectionArcs, FlowingArc, LABEL_Z, roundedRect(), useZoneGeometry() (+4 more)

### Community 40 - "AudioEngine"
Cohesion: 0.26
Nodes (5): AudioEngine, getAudioContextCtor(), isRunning(), perceptual(), MusicMood

### Community 41 - "sfx.ts"
Cohesion: 0.21
Nodes (10): bell(), brass(), makeImpulse(), makeNoiseBuffer(), midi(), NoiseSpec, SFX, SfxFn (+2 more)

### Community 42 - "PhaseBar.tsx"
Cohesion: 0.23
Nodes (9): TroopStepper, TroopStepperProps, PhaseStepper, PHASE_INDEX, PhaseMeta, PHASES, PlayablePhase, OccupyBody() (+1 more)

### Community 43 - "tutorialStore.ts"
Cohesion: 0.24
Nodes (10): zustand, COACH_STEPS, CoachContext, CoachStep, COACH_STEP_IDS, CoachStepId, Persisted, read() (+2 more)

### Community 44 - "Boats.tsx"
Cohesion: 0.27
Nodes (8): Boat, BoatProps, Boats, BoatsProps, HullStyle, STYLE, WAKE, BoatRoute

### Community 45 - "BoardEnvironment.tsx"
Cohesion: 0.31
Nodes (8): BoardEnvironment, CityGlow, SkyDirector, EMBER_FIELD, skyRuntime, setGlowLevel(), SKY_STATES, skyKeyForRound()

### Community 46 - "events.ts"
Cohesion: 0.31
Nodes (9): addEffect(), canPlayEventCard(), drawEventCards(), drawTerritoryCards(), EventCardResult, NO_TERRITORIES, removeCardFromHand(), resolveEventCard() (+1 more)

### Community 47 - "settingsStore.ts"
Cohesion: 0.31
Nodes (9): CPU_DELAY_FACTOR, DEFAULTS, QUALITIES, read(), Settings, SettingsStore, SPEEDS, GraphicsQuality (+1 more)

### Community 48 - "useStageCursorSide.ts"
Cohesion: 0.39
Nodes (7): getServerSnapshot(), getSnapshot(), listeners, onPointerMove(), StageSide, subscribe(), useStageCursorSide()

### Community 49 - "TerritoryBadge.tsx"
Cohesion: 0.38
Nodes (6): StableHtml(), NamePlate(), TerritoryBadge, TerritoryBadgeProps, Z_IDLE, Z_NAMED

### Community 50 - "CombatDice2D.tsx"
Cohesion: 0.43
Nodes (6): AnimatedDie, AnimatedDieProps, CombatDice2D, DiceRow(), CombatDieProps, DieVerdict

### Community 51 - "Dominio — note per Claude"
Cohesion: 0.33
Nodes (5): Attacco, Comandi, Dominio — note per Claude, Parti da qui: grafo Graphify, Preferenze

### Community 52 - "music.ts"
Cohesion: 0.33
Nodes (5): Layer, LAYERS, MIX, PROGRESSION, VICTORY_PAD

### Community 53 - "reinforcements.ts"
Cohesion: 0.60
Nodes (5): baseReinforcements(), calculateReinforcements(), factionBonus(), scioperoPenalty(), zoneBonus()

### Community 54 - "firebase-setup.sh"
Cohesion: 0.83
Nodes (3): bold(), json_get(), firebase-setup.sh script

## Knowledge Gaps
- **6 isolated node(s):** `@types/node`, `@types/react`, `@types/react-dom`, `@types/three`, `tsx` (+1 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 320 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `types/index.ts`, `CameraRig.tsx`, `data/index.ts`, `package.json`, `CardHandPanel.tsx`, `onlineStore.ts`, `SetupScreen.tsx`, `GameMap.tsx`, `useBoardModels.ts`, `useGameStore`, `Territory3D.tsx`, `Traffic.tsx`, `App.tsx`, `CombatSquad.tsx`, `CombatArena3D.tsx`, `CombatModal.tsx`, `GameBoard3D.tsx`, `CityLife.tsx`, `ai.ts`, `install.ts`, `AudioControls.tsx`, `Sidebar.tsx`, `gameStore.ts`, `CombatDie.tsx`, `BoardScene.tsx`, `PhaseBar.tsx`, `Boats.tsx`, `BoardEnvironment.tsx`, `useStageCursorSide.ts`, `TerritoryBadge.tsx`, `CombatDice2D.tsx`?**
  _High betweenness centrality (0.173) - this node is a cross-community bridge._
- **What connects `@types/node`, `@types/react`, `@types/react-dom` to the rest of the system?**
  _6 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `engine/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1477832512315271 - nodes in this community are weakly interconnected._
- **Why does `useGameStore` connect `useGameStore` to `react`, `engine/index.ts`, `types/index.ts`, `data/index.ts`, `CardHandPanel.tsx`, `onlineStore.ts`, `SetupScreen.tsx`, `GameMap.tsx`, `App.tsx`, `CombatModal.tsx`, `ai.ts`, `Sidebar.tsx`, `story-check.ts`, `gameStore.ts`, `BoardScene.tsx`, `PhaseBar.tsx`, `BoardEnvironment.tsx`, `events.ts`, `reinforcements.ts`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Should `types/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06178217821782178 - nodes in this community are weakly interconnected._
- **Why does `MusicDirector` connect `MusicDirector` to `AudioEngine`, `sfx.ts`, `music.ts`, `engine.ts`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Should `CameraRig.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09247311827956989 - nodes in this community are weakly interconnected._