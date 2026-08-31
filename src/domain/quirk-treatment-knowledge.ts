export type QuirkTreatmentPriority = "critical" | "high" | "medium" | "low";

export type QuirkRiskFactor =
  | "forced_curio_interaction"
  | "loot_loss"
  | "resource_loss"
  | "combat_penalty"
  | "stress_penalty"
  | "disease"
  | "other";

export interface QuirkTreatmentSource {
  title: string;
  reference: string;
}

export interface QuirkTreatmentRule {
  quirkId: string;
  priority: QuirkTreatmentPriority;
  factors: QuirkRiskFactor[];
  reasons: string[];
  notes: string[];
  sources: QuirkTreatmentSource[];
}

export interface QuirkTreatmentKnowledgeBase {
  schemaVersion: 1;
  policy: {
    title: string;
    disclaimer: string;
  };
  rules: QuirkTreatmentRule[];
}
