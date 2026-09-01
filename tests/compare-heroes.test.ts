import assert from "node:assert/strict";
import test from "node:test";

import {
  getHeroComparisonHighlights,
  type ComparableHero,
} from "../src/queries/compare-heroes.js";

function hero(
  id: string,
  overrides: Partial<ComparableHero> = {},
): ComparableHero {
  return {
    id,
    stress: 10,
    resolveLevel: 2,
    availability: { isAvailableForPartySelection: true },
    questEligibility: { isEligible: true },
    equipment: { weaponRank: 1, armourRank: 1 },
    ...overrides,
  };
}

test("compares objective hero extrema and preserves ties", () => {
  const highlights = getHeroComparisonHighlights([
    hero("a", { stress: 5, resolveLevel: 3 }),
    hero("b", {
      stress: 5,
      resolveLevel: 4,
      equipment: { weaponRank: 2, armourRank: 1 },
    }),
    hero("c", {
      stress: 20,
      availability: { isAvailableForPartySelection: false },
      questEligibility: { isEligible: false },
      equipment: { weaponRank: 2, armourRank: 3 },
    }),
  ]);

  assert.deepEqual(highlights, {
    availableHeroIds: ["a", "b"],
    questEligibleHeroIds: ["a", "b"],
    lowestStressHeroIds: ["a", "b"],
    highestResolveLevelHeroIds: ["b"],
    highestWeaponRankHeroIds: ["b", "c"],
    highestArmourRankHeroIds: ["c"],
  });
});

test("does not imply quest eligibility without quest context", () => {
  const highlights = getHeroComparisonHighlights([
    hero("a", { questEligibility: null, resolveLevel: null }),
    hero("b", { questEligibility: null, resolveLevel: null }),
  ]);
  assert.equal(highlights.questEligibleHeroIds, null);
  assert.deepEqual(highlights.highestResolveLevelHeroIds, []);
});
