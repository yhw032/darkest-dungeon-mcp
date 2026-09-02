export type ClassPositionRecommendation =
  | "preferred"
  | "viable"
  | "situational"
  | "avoid";

export interface ClassKnowledgeSource {
  title: string;
  url: string;
  verifiedAt: string;
}

export interface ClassPositionGuidance {
  positions: number[];
  recommendation: ClassPositionRecommendation;
  reason: string;
}

export interface ClassMechanicKnowledge {
  id: string;
  description: string;
}

export interface ClassSkillGuidance {
  skillId: string;
  useCases: string[];
  synergies: string[];
  cautions: string[];
}

export interface ClassSynergyKnowledge {
  heroClassId: string;
  reasons: string[];
}

export interface ClassKnowledge {
  id: string;
  aliases: string[];
  dlcs: string[];
  summary: string;
  roles: string[];
  strengths: string[];
  limitations: string[];
  positionGuidance: ClassPositionGuidance[];
  mechanics: ClassMechanicKnowledge[];
  skillGuidance: ClassSkillGuidance[];
  partySynergies: ClassSynergyKnowledge[];
  sources: ClassKnowledgeSource[];
}

export interface ClassKnowledgeBase {
  schemaVersion: 2;
  classes: ClassKnowledge[];
}
