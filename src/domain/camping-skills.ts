export type CampingSkillCategory =
  | "ambush_prevention"
  | "buff"
  | "stress_heal"
  | "heal"
  | "utility";

export interface CampingSkillDefinition {
  id: string;
  cost: number;
  classes: string[];
  preventsNightAmbush: boolean;
  curesDisease: boolean;
  primaryCategory: CampingSkillCategory;
}

export interface CampingSkillKnowledgeBase {
  schemaVersion: number;
  skills: CampingSkillDefinition[];
}

export interface HeroCampingSkillDetail {
  id: string;
  name: string | null;
  cost: number;
  preventsNightAmbush: boolean;
  curesDisease: boolean;
  primaryCategory: CampingSkillCategory;
}

export interface AmbushPreventionProvider {
  heroId: string;
  heroName: string;
  skillId: string;
  skillName: string | null;
  cost: number;
}

export interface KeyCampingBuffProvider {
  heroId: string;
  heroName: string;
  skillId: string;
  skillName: string | null;
  cost: number;
  category: CampingSkillCategory;
}

export interface ExpeditionCampingStrategy {
  hasCamping: boolean;
  firewoodCount: number;
  ambushPrevention: {
    isAvailable: boolean;
    providers: AmbushPreventionProvider[];
    warning: string | null;
  };
  keyCampingSkills: KeyCampingBuffProvider[];
  respitePointPlan: string[];
}
