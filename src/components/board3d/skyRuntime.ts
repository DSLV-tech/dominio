// ─── skyRuntime ───────────────────────────────────────────────────────────────
// Valori del cielo che cambiano ogni frame e servono a più componenti
// (materiale delle finestre, fari delle auto, faro). Oggetto mutabile fuori da
// React: BoardEnvironment lo aggiorna in useFrame, gli altri lo leggono in
// useFrame — nessun re-render.

export const skyRuntime = { glow: 0.6, headlights: 0.45 };
