export type TrinketTier = "S" | "A" | "B" | "situational" | "trap";

export interface TrinketGuidanceEntry {
  trinketId: string;
  tier: TrinketTier;
  recommendedRoles: string[];
  recommendedClasses: string[];
  synergies: string[];
  cautions: string[];
  playstyleAdvice: string;
}

export interface TrinketGuidancePolicy {
  title: string;
  disclaimer: string;
}

export interface TrinketGuidanceKnowledgeBase {
  schemaVersion: 1;
  policy: TrinketGuidancePolicy;
  trinkets: TrinketGuidanceEntry[];
}
