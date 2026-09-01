export interface ComparableHero {
  id: string;
  stress: number;
  resolveLevel: number | null;
  availability: { isAvailableForPartySelection: boolean };
  questEligibility: { isEligible: boolean | null } | null;
  equipment: { weaponRank: number; armourRank: number };
}

function idsAtExtreme(
  heroes: ComparableHero[],
  value: (hero: ComparableHero) => number | null,
  direction: "minimum" | "maximum",
): string[] {
  const known = heroes.flatMap((hero) => {
    const candidate = value(hero);
    return candidate === null ? [] : [{ id: hero.id, value: candidate }];
  });
  if (known.length === 0) return [];
  const extreme = direction === "minimum"
    ? Math.min(...known.map(({ value: candidate }) => candidate))
    : Math.max(...known.map(({ value: candidate }) => candidate));
  return known
    .filter(({ value: candidate }) => candidate === extreme)
    .map(({ id }) => id);
}

export function getHeroComparisonHighlights(heroes: ComparableHero[]) {
  const hasQuestContext = heroes.some(
    ({ questEligibility }) => questEligibility !== null,
  );
  return {
    availableHeroIds: heroes
      .filter(({ availability }) => availability.isAvailableForPartySelection)
      .map(({ id }) => id),
    questEligibleHeroIds: hasQuestContext
      ? heroes
          .filter(
            ({ questEligibility }) => questEligibility?.isEligible === true,
          )
          .map(({ id }) => id)
      : null,
    lowestStressHeroIds: idsAtExtreme(
      heroes,
      ({ stress }) => stress,
      "minimum",
    ),
    highestResolveLevelHeroIds: idsAtExtreme(
      heroes,
      ({ resolveLevel }) => resolveLevel,
      "maximum",
    ),
    highestWeaponRankHeroIds: idsAtExtreme(
      heroes,
      ({ equipment }) => equipment.weaponRank,
      "maximum",
    ),
    highestArmourRankHeroIds: idsAtExtreme(
      heroes,
      ({ equipment }) => equipment.armourRank,
      "maximum",
    ),
  };
}
