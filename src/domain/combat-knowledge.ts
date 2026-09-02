export type CombatRegionId =
  | "ruins"
  | "warrens"
  | "weald"
  | "cove"
  | "courtyard"
  | "farmstead"
  | "darkest_dungeon";

export type CombatEffectType =
  | "bleed"
  | "blight"
  | "stun"
  | "debuff"
  | "move";

export type ResistanceTendency = "low" | "mixed" | "high";
export type EnemyPriority = "low" | "medium" | "high" | "critical";
export type EnemyType = "common" | "elite" | "miniboss";
export type CombatThreatType =
  | "health_damage"
  | "stress"
  | "bleed"
  | "blight"
  | "disease"
  | "stun"
  | "mark"
  | "debuff"
  | "movement"
  | "guard"
  | "summon"
  | "stealth"
  | "healing"
  | "other";

export interface CombatKnowledgeSource {
  title: string;
  url: string;
  verifiedAt: string;
}

export interface RegionThreatKnowledge {
  id: string;
  type: CombatThreatType;
  description: string;
  counters: string[];
}

export interface RegionResistanceKnowledge {
  effect: CombatEffectType;
  tendency: ResistanceTendency;
  note: string;
}

export interface RegionCombatKnowledge {
  id: CombatRegionId;
  dlcs: string[];
  overview: string;
  commonThreats: RegionThreatKnowledge[];
  resistanceTendencies: RegionResistanceKnowledge[];
  recommendedCapabilities: string[];
  cautions: string[];
  sources: CombatKnowledgeSource[];
}

export interface EnemyActionKnowledge {
  id: string;
  localizationIds: string[];
  threats: CombatThreatType[];
  description: string;
  counters: string[];
}

export interface EnemyCombatKnowledge {
  id: string;
  enemyType: EnemyType;
  localizationId: string;
  aliases: string[];
  regions: CombatRegionId[];
  dlcs: string[];
  priority: EnemyPriority;
  priorityReasons: string[];
  traits: string[];
  dangerousActions: EnemyActionKnowledge[];
  effectiveResponses: string[];
  cautions: string[];
  sources: CombatKnowledgeSource[];
}

export interface CombatKnowledgeBase {
  schemaVersion: 2;
  regions: RegionCombatKnowledge[];
  enemies: EnemyCombatKnowledge[];
}
