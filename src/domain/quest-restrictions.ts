export interface QuestRestrictionRules {
  maximumResolveLevelByDifficulty: number[];
}

export type QuestEligibilityReason =
  | "resolve_level_too_high"
  | "resolve_level_unavailable"
  | "restriction_rules_unavailable"
  | "quest_difficulty_undefined";

export interface QuestEligibility {
  questId: string;
  questDifficulty: number;
  status: "eligible" | "ineligible" | "unknown";
  isEligible: boolean | null;
  maximumResolveLevel: number | null;
  reason: QuestEligibilityReason | null;
}
