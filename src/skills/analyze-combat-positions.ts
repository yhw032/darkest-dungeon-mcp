import type {
  HeroCombatPositionAnalysis,
  HeroCombatSkillDetail,
} from "../domain/hero-skills.js";

const partyPositions = [1, 2, 3, 4] as const;

export function analyzeHeroCombatPositions(
  skillDetails: HeroCombatSkillDetail[],
): HeroCombatPositionAnalysis {
  const selected = skillDetails.filter((skill) => skill.isSelected);
  const definedSkillCount = selected.filter(
    (skill) => skill.usableFromPartyPositions !== null,
  ).length;
  const status =
    selected.length === 0 || definedSkillCount === 0
      ? "unavailable"
      : definedSkillCount === selected.length
        ? "complete"
        : "partial";

  const positionCoverage = partyPositions.map((partyPosition) => {
    const usableSkillIds: string[] = [];
    const unusableSkillIds: string[] = [];
    const unknownSkillIds: string[] = [];
    for (const skill of selected) {
      if (skill.usableFromPartyPositions === null) {
        unknownSkillIds.push(skill.id);
      } else if (skill.usableFromPartyPositions.includes(partyPosition)) {
        usableSkillIds.push(skill.id);
      } else {
        unusableSkillIds.push(skill.id);
      }
    }
    return {
      partyPosition,
      usableSkillIds,
      unusableSkillIds,
      unknownSkillIds,
    };
  });

  const highestCoverage = Math.max(
    0,
    ...positionCoverage.map(({ usableSkillIds }) => usableSkillIds.length),
  );
  return {
    status,
    selectedSkillCount: selected.length,
    definedSkillCount,
    positionNumbering: { front: 1, back: 4 },
    positionCoverage,
    fullyUsablePartyPositions:
      status !== "complete"
        ? []
        : positionCoverage
            .filter(
              ({ usableSkillIds }) =>
                usableSkillIds.length === selected.length,
            )
            .map(({ partyPosition }) => partyPosition),
    bestCoveragePartyPositions:
      highestCoverage === 0
        ? []
        : positionCoverage
            .filter(
              ({ usableSkillIds }) =>
                usableSkillIds.length === highestCoverage,
            )
            .map(({ partyPosition }) => partyPosition),
  };
}
