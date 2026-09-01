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
  usableFromPartyPositions: number[] | null;
  target: HeroCombatSkillTarget | null;
  movement: HeroCombatSkillMovement | null;
}

export type HeroCombatSkillTargetSide = "enemy" | "ally" | "self";
export type HeroCombatSkillTargetMode = "single" | "group" | "random";

export interface HeroCombatSkillTarget {
  side: HeroCombatSkillTargetSide;
  mode: HeroCombatSkillTargetMode;
  positions: number[];
}

export interface HeroCombatSkillMovement {
  backward: number;
  forward: number;
}

export interface HeroCombatSkillPositionDefinition {
  heroClass: string;
  skillId: string;
  usableFromPartyPositions: number[];
  target: HeroCombatSkillTarget;
  movement: HeroCombatSkillMovement;
}

export interface HeroPositionCoverage {
  partyPosition: number;
  usableSkillIds: string[];
  unusableSkillIds: string[];
  unknownSkillIds: string[];
}

export interface HeroCombatPositionAnalysis {
  status: "complete" | "partial" | "unavailable";
  selectedSkillCount: number;
  definedSkillCount: number;
  positionNumbering: { front: 1; back: 4 };
  positionCoverage: HeroPositionCoverage[];
  fullyUsablePartyPositions: number[];
  bestCoveragePartyPositions: number[];
}
