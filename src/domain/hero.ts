export interface Quirk {
  id: string;
  isLocked: boolean;
  isNew: boolean;
  evolutionDurationRemaining: number;
}

export interface EquippedTrinket {
  id: string;
  type: string;
  amount: number;
}

export interface SkillSelection {
  id: string;
  rawSelectionValue: number;
}

export interface Hero {
  id: string;
  name: string;
  heroClass: string;
  resolveXp: number;
  stress: number;
  rosterStatus: number;
  buildingName: string | null;
  currentHp: number | null;
  weaponRank: number;
  armourRank: number;
  afflictionId: string | null;
  afflictionSeverity: number;
  virtueId: string | null;
  visitedDeathsDoor: boolean;
  hasHadHeartAttack: boolean;
  deathHeartAttackCompleted: boolean;
  quirks: Quirk[];
  equippedTrinkets: EquippedTrinket[];
  combatSkills: string[];
  campingSkills: string[];
  combatSkillSelections: SkillSelection[];
  campingSkillSelections: SkillSelection[];
}

export interface Roster {
  version: number;
  nextGuid: number;
  heroes: Hero[];
}
