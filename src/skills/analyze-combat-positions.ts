import type {
  HeroCombatPositionAnalysis,
  HeroCombatSkillDetail,
} from "../domain/hero-skills.js";

const partyRanks = [1, 2, 3, 4] as const;

export function analyzeHeroCombatPositions(
  skillDetails: HeroCombatSkillDetail[],
): HeroCombatPositionAnalysis {
  const selected = skillDetails.filter((skill) => skill.isSelected);
  const definedSkillCount = selected.filter(
    (skill) => skill.usableFromRanks !== null,
  ).length;
  const status =
    selected.length === 0 || definedSkillCount === 0
      ? "unavailable"
      : definedSkillCount === selected.length
        ? "complete"
        : "partial";

  const rankCoverage = partyRanks.map((rank) => {
    const usableSkillIds: string[] = [];
    const unusableSkillIds: string[] = [];
    const unknownSkillIds: string[] = [];
    for (const skill of selected) {
      if (skill.usableFromRanks === null) unknownSkillIds.push(skill.id);
      else if (skill.usableFromRanks.includes(rank)) usableSkillIds.push(skill.id);
      else unusableSkillIds.push(skill.id);
    }
    return { rank, usableSkillIds, unusableSkillIds, unknownSkillIds };
  });

  const highestCoverage = Math.max(
    0,
    ...rankCoverage.map(({ usableSkillIds }) => usableSkillIds.length),
  );
  return {
    status,
    selectedSkillCount: selected.length,
    definedSkillCount,
    rankCoverage,
    fullyUsablePartyRanks:
      status !== "complete"
        ? []
        : rankCoverage
            .filter(
              ({ usableSkillIds }) =>
                usableSkillIds.length === selected.length,
            )
            .map(({ rank }) => rank),
    bestCoveragePartyRanks:
      highestCoverage === 0
        ? []
        : rankCoverage
            .filter(
              ({ usableSkillIds }) =>
                usableSkillIds.length === highestCoverage,
            )
            .map(({ rank }) => rank),
  };
}
