import type {
  RegionResistanceKnowledge,
  RegionThreatKnowledge,
} from "./combat-knowledge.js";
import type { LocalizedEnemyCombatKnowledge } from "../queries/query-combat.js";
import type { ExpeditionCampingStrategy } from "./camping-skills.js";

export interface ExpeditionQuestContext {
  id: string;
  dungeon: string;
  dungeonName: string | null;
  difficulty: number;
  length: number;
  questName: string | null;
  questDescription: string | null;
  isPlotQuest: boolean;
  goalIds: string[];
  bossGuidance: LocalizedEnemyCombatKnowledge | null;
  regionOverview: string | null;
  regionCommonThreats: RegionThreatKnowledge[];
  regionResistanceTendencies: RegionResistanceKnowledge[];
  regionRecommendedCapabilities: string[];
  regionCautions: string[];
}

export interface ExpeditionHeroCandidate {
  id: string;
  name: string;
  heroClass: string;
  heroClassName: string | null;
  resolveLevel: number | null;
  stress: number;
  roleScore: number;
  suitabilityReasons: string[];
  cautions: string[];
  recommendedTrinketIds: string[];
  isPreferred: boolean;
}

export interface ExpeditionRolePool {
  frontlineDps: ExpeditionHeroCandidate[];
  controlDisruptor: ExpeditionHeroCandidate[];
  supportStressHealer: ExpeditionHeroCandidate[];
  primaryHealer: ExpeditionHeroCandidate[];
}

export interface IneligibleHero {
  id: string;
  name: string;
  heroClass: string;
  heroClassName: string | null;
  resolveLevel: number | null;
  stress: number;
  reasons: string[];
}

export interface ExpeditionProvisionItem {
  id: string;
  name: string;
  amount: number;
  costPerUnit: number;
  totalCost: number;
  purpose: string;
}

export interface ExpeditionProvisionEstimate {
  items: ExpeditionProvisionItem[];
  totalEstimatedCost: number;
  notes: string[];
}

export interface ExpeditionPlanResult {
  quest: ExpeditionQuestContext;
  rolePool: ExpeditionRolePool;
  ineligibleHeroes: IneligibleHero[];
  unverifiedHeroes: IneligibleHero[];
  provisions: ExpeditionProvisionEstimate;
  campingStrategy: ExpeditionCampingStrategy;
  tacticalAdvice: string[];
}
