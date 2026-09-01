import assert from "node:assert/strict";
import test from "node:test";

import type { Hero } from "../src/domain/hero.js";
import {
  getHeroAvailability,
  getResolveLevel,
  parseHeroProgressionRules,
} from "../src/progression/hero-progression.js";

const hero = {
  id: "1",
  name: "레날드",
  heroClass: "crusader",
  resolveXp: 3,
  stress: 0,
  rosterStatus: 0,
  buildingName: null,
  currentHp: 20,
  weaponRank: 0,
  armourRank: 0,
  afflictionId: null,
  afflictionSeverity: 0,
  virtueId: null,
  visitedDeathsDoor: false,
  hasHadHeartAttack: false,
  deathHeartAttackCompleted: false,
  quirks: [],
  equippedTrinkets: [],
  combatSkills: [],
  campingSkills: [],
  combatSkillSelections: [],
  campingSkillSelections: [],
} satisfies Hero;

const rules = parseHeroProgressionRules(
  { resolve_level_thresholds: [0, 2, 8, 14, 24, 36, 48] },
  "fixture.json",
);

test("derives resolve level from verified game thresholds", () => {
  assert.equal(getResolveLevel(0, rules), 0);
  assert.equal(getResolveLevel(3, rules), 1);
  assert.equal(getResolveLevel(14, rules), 3);
  assert.equal(getResolveLevel(100, rules), 6);
  assert.equal(getResolveLevel(3), null);
});

test("rejects invalid resolve level thresholds", () => {
  assert.throws(
    () =>
      parseHeroProgressionRules(
        { resolve_level_thresholds: [0, 2, 2] },
        "fixture.json",
      ),
    /strictly increasing/,
  );
});

test("reports verified blockers for party selection", () => {
  assert.deepEqual(
    getHeroAvailability(hero, {
      buildingName: null,
      activityAssignments: [],
    }),
    { isAvailableForPartySelection: true, reasons: [] },
  );
  assert.deepEqual(
    getHeroAvailability(
      { ...hero, rosterStatus: 1, buildingName: "tavern" },
      { buildingName: "tavern", activityAssignments: [] },
    ),
    {
      isAvailableForPartySelection: false,
      reasons: ["already_selected_for_raid", "assigned_to_town_activity"],
    },
  );
});
