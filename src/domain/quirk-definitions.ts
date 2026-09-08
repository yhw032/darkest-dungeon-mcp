import type { GameLanguage } from "../localization/languages.js";

export interface QuirkBuffEffect {
  buffId: string;
  statType: string;
  statSubType: string;
  amount: number;
  ruleType: string;
  isFalseRule: boolean;
}

export interface QuirkLocalizedText {
  name: string | null;
  description: string | null;
}

export interface QuirkDefinition {
  id: string;
  isPositive: boolean;
  isDisease: boolean;
  classification: string;
  incompatibleQuirks: string[];
  curioTag: string | null;
  curioTagChance: number;
  keepsLoot: boolean;
  canModifyInActivity: boolean;
  canBeReplacedByNewQuirk: boolean;
  effects: QuirkBuffEffect[];
  unresolvedBuffIds: string[];
  localization: Partial<Record<GameLanguage, QuirkLocalizedText>>;
}
