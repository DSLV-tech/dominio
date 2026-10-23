/// <reference types="vite/client" />

// Variabili d'ambiente lette dal gioco (file .env.local, vedi .env.example).
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  /** Host degli emulatori Firebase (es. 127.0.0.1) per provare senza progetto reale. */
  readonly VITE_FIREBASE_EMULATOR_HOST?: string;
}
