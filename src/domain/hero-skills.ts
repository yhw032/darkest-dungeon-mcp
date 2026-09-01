export interface HeroCombatSkillTree {
  id: string;
  hash: number;
  heroClass: string;
  skillId: string;
  requirementCodes: string[];
}

export interface HeroCombatSkillDetail {
  id: string;
  level: number | null;
  isSelected: boolean;
  rawSelectionValue: number | null;
  usableFromRanks: number[] | null;
  target: HeroCombatSkillTarget | null;
  movement: HeroCombatSkillMovement | null;
}

export type HeroCombatSkillTargetSide = "enemy" | "ally" | "self";
export type HeroCombatSkillTargetMode = "single" | "group" | "random";

export interface HeroCombatSkillTarget {
  side: HeroCombatSkillTargetSide;
  mode: HeroCombatSkillTargetMode;
  ranks: number[];
}

export interface HeroCombatSkillMovement {
  backward: number;
  forward: number;
}

export interface HeroCombatSkillPositionDefinition {
  heroClass: string;
  skillId: string;
  usableFromRanks: number[];
  target: HeroCombatSkillTarget;
  movement: HeroCombatSkillMovement;
}

export interface HeroRankCoverage {
  rank: number;
  usableSkillIds: string[];
  unusableSkillIds: string[];
  unknownSkillIds: string[];
}

export interface HeroCombatPositionAnalysis {
  status: "complete" | "partial" | "unavailable";
  selectedSkillCount: number;
  definedSkillCount: number;
  rankCoverage: HeroRankCoverage[];
  fullyUsablePartyRanks: number[];
  bestCoveragePartyRanks: number[];
}
