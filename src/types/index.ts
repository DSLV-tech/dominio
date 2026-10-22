export type {
  ZoneId, TerritoryId, TerritoryDefinition, ZoneDefinition, SvgPosition, SvgBounds,
  TerritoryVariant, TerritoryPair,
} from './map';
export type { Vec3, TerritoryAnchor, BoardMeta, MapMode, BoardModels } from './board3d';
export type { FactionId, PlayerId, FactionDefinition, Player } from './player';
export type {
  CardSymbol, EventCardId, TerritoryCard, EventCard, Card, CardSet,
  SetBonus, CashSetResult, ActiveEffect, EventTargetKind, EventTargetSpec, PlayedEvent,
} from './cards';
export { isTerritoryCard, isEventCard } from './cards';
export type {
  GamePhase, VictoryCondition, TerritoryState, PendingAttack,
  PlayerCount, GameConfig, GameState, MovementRule,
} from './game';
export type {
  StoryPage, StoryAct, FactionGrammar, FactionLore, TerritoryLore, ZoneLore, Epilogues,
  StoryBeat, DispatchTone, Dispatch,
} from './story';
export type { SfxName, MusicMood, SfxOptions, AudioSettings } from './audio';
export type { RoadPath, TrafficData, BoatKind, BoatRoute, GullFlock } from './ambient';
export type {
  CombatStage, CombatSide, DieVerdict, CombatSideView, CombatView,
  AttackMode, AttackOrder, CombatRoundLog, AttackPreferences, PendingOccupation,
} from './combat';
export type { CpuSpeed, CameraFocus, ActionTrace, TurnRecap } from './cpu';
export type { SkyState, SkyKey, GraphicsQuality, GraphicsBudget } from './board3d';
