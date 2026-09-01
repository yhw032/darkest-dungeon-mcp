export interface HeroProgressionRules {
  resolveLevelThresholds: number[];
}

export type HeroAvailabilityReason =
  | "already_selected_for_raid"
  | "assigned_to_town_activity"
  | "roster_status_unavailable";

export interface HeroAvailability {
  isAvailableForPartySelection: boolean;
  reasons: HeroAvailabilityReason[];
}

export interface HeroProgression {
  resolveLevel: number | null;
  availability: HeroAvailability;
}
