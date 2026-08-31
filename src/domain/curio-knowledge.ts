export type CurioRegion =
  | "ruins"
  | "warrens"
  | "weald"
  | "cove"
  | "courtyard"
  | "farmstead"
  | "darkest_dungeon"
  | "old_road"
  | "hamlet";

export type CurioAvailability =
  | { type: "standard" }
  | { type: "quest"; questIds: string[] };

export type CurioRecommendation = "recommended" | "situational" | "avoid";
export type OutcomeCertainty = "guaranteed" | "possible";
export type OutcomePolarity = "positive" | "negative" | "neutral" | "mixed";
export type CurioOutcomeType =
  | "loot"
  | "stress"
  | "health"
  | "quirk"
  | "disease"
  | "status"
  | "buff"
  | "combat"
  | "nothing"
  | "other";

export interface CurioOutcome {
  type: CurioOutcomeType;
  polarity: OutcomePolarity;
  description: string;
  chancePercent?: number;
}

export interface CurioInteraction {
  item: string | null;
  recommendation: CurioRecommendation;
  certainty: OutcomeCertainty;
  outcomes: CurioOutcome[];
  note?: string;
}

export interface KnowledgeSource {
  title: string;
  url: string;
  verifiedAt: string;
}

export interface CurioKnowledge {
  id: string;
  names: {
    en: string;
    ko?: string;
  };
  aliases: string[];
  regions: CurioRegion[];
  dlcs: string[];
  availability: CurioAvailability;
  interactions: CurioInteraction[];
  notes: string[];
  sources: KnowledgeSource[];
}

export interface CurioKnowledgeBase {
  schemaVersion: 1;
  curios: CurioKnowledge[];
}
