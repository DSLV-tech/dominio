# Graph Report - dominio-game  (2026-10-22)

## Corpus Check
- 73 files · ~28,369 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: .css 6, (none) 1)

## Summary
- 461 nodes · 1316 edges · 17 communities (14 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- useGameStore
- engine/index.ts
- types/index.ts
- BoardScene.tsx
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
- vite
- tsconfig.json
- graph.sh

## God Nodes (most connected - your core abstractions)
1. `useGameStore` - 48 edges
2. `TerritoryId` - 47 edges
3. `react` - 37 edges
4. `compilerOptions` - 21 edges
5. `GameState` - 19 edges
6. `useStoryStore` - 18 edges
7. `useUIStore` - 18 edges
8. `PlayerId` - 18 edges
9. `compilerOptions` - 18 edges
10. `FactionId` - 17 edges

## Surprising Connections (you probably didn't know these)
- `Architettura` --references--> `useAIPlayer()`  [INFERRED]
  CLAUDE.md → src/hooks/useAIPlayer.ts
- `Architettura` --references--> `useStoryDirector()`  [INFERRED]
  CLAUDE.md → src/hooks/useStoryDirector.ts
- `Architettura` --references--> `useTerritoryInteraction()`  [INFERRED]
  CLAUDE.md → src/hooks/useTerritoryInteraction.ts
- `Storia: "La Notte Lunga di Novarata"` --references--> `filterNewsworthy()`  [INFERRED]
  CLAUDE.md → src/engine/narrative.ts
- `Storia: "La Notte Lunga di Novarata"` --references--> `beatToDispatch()`  [INFERRED]
  CLAUDE.md → src/engine/narrative.ts

## Import Cycles
- None detected.

## Communities (17 total, 3 thin omitted)

### Community 0 - "useGameStore"
Cohesion: 0.07
Nodes (59): react, react-dom, zustand, App(), AppCrash(), GameBoard3D, GameScreen(), MAP_MODES (+51 more)

### Community 1 - "engine/index.ts"
Cohesion: 0.07
Nodes (62): GAMES, PLAYERS, results, rounds, chronicle, GAMES, kinds, lastChronicle (+54 more)

### Community 2 - "types/index.ts"
Cohesion: 0.09
Nodes (50): ConnectionArcsProps, Territory3DProps, PlayerRowProps, NodeVariant, Props, PlayerCardProps, PlayerDraft, PROLOGUE (+42 more)

### Community 3 - "BoardScene.tsx"
Cohesion: 0.07
Nodes (42): @react-three/drei, @react-three/fiber, three, Board3DFallback, BoardEnvironment, BoardLoadingOverlay, BoardScene(), TERRITORY_IDS (+34 more)

### Community 4 - "data/index.ts"
Cohesion: 0.09
Nodes (35): Board3DFallbackProps, GLOW_MATERIAL, isFactionId(), prepare(), ShadowFlags, useBoardModels(), ZONE_ORDER, ConnectionLines (+27 more)

### Community 5 - "narrative.ts"
Cohesion: 0.12
Nodes (23): Architettura, Comandi, Dominio — note per Claude, Parti da qui: grafo Graphify, Preferenze, Storia: "La Notte Lunga di Novarata", actForRound(), actNumber() (+15 more)

### Community 6 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+14 more)

### Community 7 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+11 more)

### Community 8 - "package.json"
Cohesion: 0.14
Nodes (16): name, private, type, version, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh (+8 more)

### Community 9 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, tsx, @types/node (+7 more)

### Community 10 - "CardHandPanel.tsx"
Cohesion: 0.27
Nodes (10): CardHandPanel, computeSetBonus(), EventCardChip(), headerStyle, panelStyle, SYMBOL_COLOR, SYMBOL_ICON, TerritoryCardChip() (+2 more)

### Community 11 - "dependencies"
Cohesion: 0.29
Nodes (7): dependencies, react, react-dom, @react-three/drei, @react-three/fiber, three, zustand

### Community 12 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, preview, simulate, story

### Community 13 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

## Knowledge Gaps
- **6 isolated node(s):** `@types/node`, `@types/react`, `@types/react-dom`, `@types/three`, `tsx` (+1 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 144 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `useGameStore` to `engine/index.ts`, `types/index.ts`, `BoardScene.tsx`, `data/index.ts`, `package.json`, `CardHandPanel.tsx`?**
  _High betweenness centrality (0.169) - this node is a cross-community bridge._
- **What connects `@types/node`, `@types/react`, `@types/react-dom` to the rest of the system?**
  _6 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `useGameStore` be split into smaller, more focused modules?**
  _Cohesion score 0.06846899794299148 - nodes in this community are weakly interconnected._
- **Why does `useGameStore` connect `useGameStore` to `engine/index.ts`, `types/index.ts`, `BoardScene.tsx`, `data/index.ts`, `CardHandPanel.tsx`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Should `engine/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06735159817351598 - nodes in this community are weakly interconnected._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Should `types/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09370199692780339 - nodes in this community are weakly interconnected._