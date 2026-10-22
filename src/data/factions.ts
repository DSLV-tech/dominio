// ─── Faction Definitions ──────────────────────────────────────────────────────

import type { FactionDefinition, FactionId } from '../types';

export const FACTION_DEFINITIONS: Record<FactionId, FactionDefinition> = {
  BIANCHI: {
    id: 'BIANCHI',
    name: 'I Colletti Bianchi',
    shortName: 'Bianchi',
    color: '#4a7acd',
    bgColor: '#1a2f5e',
    textColor: '#a8c4f0',
    startingZone: 'CS',
    abilityName: 'Lobbying',
    abilityDescription:
      'Quando attacchi un territorio adiacente al Centro Storico, tiri 1 dado extra (max 4 dadi).',
  },
  MANO_NERA: {
    id: 'MANO_NERA',
    name: 'La Mano Nera',
    shortName: 'Mano Nera',
    color: '#cd4a4a',
    bgColor: '#5e1a1a',
    textColor: '#f0a8a8',
    startingZone: 'PV',
    abilityName: 'Racket',
    abilityDescription:
      '+1 truppa di rinforzo per ogni zona del Porto Vecchio controllata (cumulativo, max +4).',
  },
  STRADA: {
    id: 'STRADA',
    name: 'I Figli della Strada',
    shortName: 'Strada',
    color: '#c0561a',
    bgColor: '#4a2008',
    textColor: '#f0c090',
    startingZone: 'SE',
    abilityName: 'Radicamento',
    abilityDescription:
      '+1 a tutti i tiri difensivi in zone della Suburbia Est o della Periferia Nord (massimo dado = 6).',
  },
  ORDINE: {
    id: 'ORDINE',
    name: "L'Ordine Civico",
    shortName: 'Ordine',
    color: '#4acd4a',
    bgColor: '#1a3a1a',
    textColor: '#a8f0a8',
    startingZone: 'CR',
    abilityName: 'Barricata',
    abilityDescription:
      '1 volta per turno: converti 2 truppe in una Barricata (+1 difesa permanente su quel territorio, max 1 per zona).',
  },
};

export const ALL_FACTION_IDS: readonly FactionId[] = [
  'BIANCHI',
  'MANO_NERA',
  'STRADA',
  'ORDINE',
];
