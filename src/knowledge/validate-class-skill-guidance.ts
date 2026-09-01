import type { ClassKnowledgeBase } from "../domain/class-knowledge.js";
import type { HeroCombatSkillPositionDefinition } from "../domain/hero-skills.js";

export interface ClassSkillGuidanceMismatch {
  heroClass: string;
  missingGuidanceSkillIds: string[];
  unknownGuidanceSkillIds: string[];
}

export function findClassSkillGuidanceMismatches(
  knowledge: ClassKnowledgeBase,
  definitions: HeroCombatSkillPositionDefinition[],
): ClassSkillGuidanceMismatch[] {
  const gameSkillsByClass = new Map<
    string,
    HeroCombatSkillPositionDefinition[]
  >();
  for (const definition of definitions) {
    const classSkills = gameSkillsByClass.get(definition.heroClass) ?? [];
    classSkills.push(definition);
    gameSkillsByClass.set(definition.heroClass, classSkills);
  }

  return knowledge.classes.flatMap((classKnowledge) => {
    const gameSkillIds = new Set(
      (gameSkillsByClass.get(classKnowledge.id) ?? []).map(
        ({ skillId }) => skillId,
      ),
    );
    const guidanceSkillIds = new Set(
      classKnowledge.skillGuidance.map(({ skillId }) => skillId),
    );
    const missingGuidanceSkillIds = [...gameSkillIds]
      .filter((skillId) => !guidanceSkillIds.has(skillId))
      .sort();
    const unknownGuidanceSkillIds = [...guidanceSkillIds]
      .filter((skillId) => !gameSkillIds.has(skillId))
      .sort();

    return missingGuidanceSkillIds.length === 0 &&
      unknownGuidanceSkillIds.length === 0
      ? []
      : [
          {
            heroClass: classKnowledge.id,
            missingGuidanceSkillIds,
            unknownGuidanceSkillIds,
          },
        ];
  });
}

export function validateClassSkillGuidance(
  knowledge: ClassKnowledgeBase,
  definitions: HeroCombatSkillPositionDefinition[],
): void {
  const mismatches = findClassSkillGuidanceMismatches(
    knowledge,
    definitions,
  );
  if (mismatches.length === 0) return;

  throw new Error(
    `Class skill guidance does not match game definitions: ${JSON.stringify(mismatches)}`,
  );
}
