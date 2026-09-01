import type { HeroRosterState } from "../roster/hero-roster-state.js";

export interface ComparableHero {
  id: string;
  rosterState: HeroRosterState;
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
  const activeHeroes = heroes.filter(
    ({ rosterState }) => rosterState === "active",
  );
  const hasQuestContext = activeHeroes.some(
    ({ questEligibility }) => questEligibility !== null,
  );
  return {
    availableHeroIds: activeHeroes
      .filter(({ availability }) => availability.isAvailableForPartySelection)
      .map(({ id }) => id),
    questEligibleHeroIds: hasQuestContext
      ? activeHeroes
          .filter(
            ({ questEligibility }) => questEligibility?.isEligible === true,
          )
          .map(({ id }) => id)
      : null,
    lowestStressHeroIds: idsAtExtreme(
      activeHeroes,
      ({ stress }) => stress,
      "minimum",
    ),
    highestResolveLevelHeroIds: idsAtExtreme(
      activeHeroes,
      ({ resolveLevel }) => resolveLevel,
      "maximum",
    ),
    highestWeaponRankHeroIds: idsAtExtreme(
      activeHeroes,
      ({ equipment }) => equipment.weaponRank,
      "maximum",
    ),
    highestArmourRankHeroIds: idsAtExtreme(
      activeHeroes,
      ({ equipment }) => equipment.armourRank,
      "maximum",
    ),
  };
}
