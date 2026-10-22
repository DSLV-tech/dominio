// ─── App installabile (PWA) ───────────────────────────────────────────────────
// Registra il service worker (solo in produzione) e cattura subito l'evento
// `beforeinstallprompt` di Chrome/Android, che può arrivare prima che la lobby
// sia montata. Su iPhone/iPad non c'è prompt: si installa da Condividi →
// "Aggiungi alla schermata Home", quindi la lobby mostra l'istruzione.

import { useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ readonly outcome: 'accepted' | 'dismissed' }>;
}

/** `prompt`: Chrome ha un prompt pronto · `ios`: istruzioni manuali ·
 *  `none`: già installata o browser che non lo consente. */
export type InstallState = 'prompt' | 'ios' | 'none';

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = (): void => listeners.forEach(l => l());

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

function isIOS(): boolean {
  const ua = navigator.userAgent;
  // iPadOS si presenta come Mac: lo riconosce il touch
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function current(): InstallState {
  if (isStandalone()) return 'none';
  if (deferred) return 'prompt';
  return isIOS() ? 'ios' : 'none';
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();              // niente mini-barra automatica: decide il pulsante in lobby
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => { deferred = null; notify(); });

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    });
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribe, current, () => 'none');
}

/** Apre il prompt di installazione di Chrome; true se l'utente ha accettato. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  deferred = null;
  notify();
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome === 'accepted';
}
