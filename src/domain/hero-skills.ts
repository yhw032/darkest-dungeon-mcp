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
}
