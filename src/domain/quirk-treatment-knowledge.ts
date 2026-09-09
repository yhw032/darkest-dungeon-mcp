export type QuirkTreatmentPriority = "critical" | "high" | "medium" | "low";

export type QuirkManagementAction = "remove_negative" | "lock_positive";

export type PositiveQuirkApplicability =
  | "universal"
  | "hero_class"
  | "build"
  | "region"
  | "conditional";

export type QuirkRiskFactor =
  | "forced_curio_interaction"
  | "loot_loss"
  | "resource_loss"
  | "combat_penalty"
  | "stress_penalty"
  | "disease"
  | "other";

export type PositiveQuirkValueFactor =
  | "accuracy"
  | "critical"
  | "damage"
  | "durability"
  | "healing"
  | "resistance"
  | "scouting"
  | "speed"
  | "stress_control"
  | "town"
  | "other";

export interface QuirkTreatmentSource {
  kind: "game" | "wiki" | "community";
  title: string;
  reference: string;
  verifiedAt: string;
}

interface QuirkManagementRuleBase {
  quirkId: string;
  priority: QuirkTreatmentPriority;
  reasons: string[];
  notes: string[];
  sources: QuirkTreatmentSource[];
}

export interface NegativeQuirkTreatmentRule
  extends QuirkManagementRuleBase {
  action: "remove_negative";
  factors: QuirkRiskFactor[];
}

export interface PositiveQuirkLockRule extends QuirkManagementRuleBase {
  action: "lock_positive";
  factors: PositiveQuirkValueFactor[];
  applicability: PositiveQuirkApplicability;
  heroClasses: string[];
  cautions: string[];
}

export type QuirkManagementRule =
  | NegativeQuirkTreatmentRule
  | PositiveQuirkLockRule;

export type QuirkTreatmentRule = NegativeQuirkTreatmentRule;

export interface QuirkTreatmentKnowledgeBase {
  schemaVersion: 2;
  policy: {
    title: string;
    disclaimer: string;
  };
  rules: QuirkManagementRule[];
}
