import assert from "node:assert/strict";
import test from "node:test";

import type { Hero, Roster } from "../src/domain/hero.js";
import type { Town } from "../src/domain/town.js";
import { getHero } from "../src/queries/get-hero.js";
import { getHeroTownContext } from "../src/queries/get-hero-town-context.js";
import { listHeroes } from "../src/queries/list-heroes.js";
import { summarizeRoster } from "../src/queries/summarize-roster.js";

function makeHero(overrides: Partial<Hero>): Hero {
  return {
    id: "1",
    name: "레날드",
    heroClass: "crusader",
    resolveXp: 6,
    stress: 10,
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
    ...overrides,
  };
}

const roster: Roster = {
  version: 513,
  nextGuid: 4,
  heroes: [
    makeHero({ id: "1" }),
    makeHero({
      id: "2",
      name: "준이아",
      heroClass: "vestal",
      stress: 120,
      rosterStatus: 1,
    }),
    makeHero({ id: "3", name: "디스마스", stress: 150 }),
  ],
};

test("lists lightweight hero summaries", () => {
  const heroes = listHeroes(roster);

  assert.equal(heroes.length, 3);
  assert.equal(heroes[0]?.name, "레날드");
  assert.equal("quirks" in (heroes[0] ?? {}), false);
});

test("filters heroes by class, status, and maximum stress", () => {
  assert.deepEqual(
    listHeroes(roster, { heroClass: "crusader", maxStress: 100 }).map(
      (hero) => hero.id,
    ),
    ["1"],
  );
  assert.deepEqual(
    listHeroes(roster, { rosterStatus: 1 }).map((hero) => hero.id),
    ["2"],
  );
  assert.deepEqual(
    listHeroes(roster, { availableOnly: true }).map((hero) => hero.id),
    ["1", "3"],
  );
});

test("gets a hero by its string id", () => {
  assert.equal(getHero(roster, "2")?.name, "준이아");
  assert.equal(getHero(roster, "999"), undefined);
});

test("links a hero to matching town activity slots", () => {
  const town: Town = {
    version: 1,
    districts: [],
    buildings: [
      {
        id: "abbey",
        stores: [],
        activities: [
          {
            id: "meditation",
            slots: [
              {
                id: "0",
                heroId: 2,
                visitsRemaining: 1,
                residentOccupied: 0,
                isSideEffectResult: false,
              },
            ],
          },
        ],
      },
    ],
  };

  assert.deepEqual(getHeroTownContext(roster, town, "2"), {
    buildingName: null,
    activityAssignments: [
      {
        buildingId: "abbey",
        activityId: "meditation",
        slotId: "0",
        visitsRemaining: 1,
        residentOccupied: 0,
        isSideEffectResult: false,
      },
    ],
  });
});

test("summarizes counts and sorts high-stress heroes", () => {
  const summary = summarizeRoster(roster, 100);

  assert.equal(summary.totalHeroes, 3);
  assert.deepEqual(summary.byClass, { crusader: 2, vestal: 1 });
  assert.deepEqual(summary.byStatus, { "0": 2, "1": 1 });
  assert.deepEqual(
    summary.highStressHeroes.map((hero) => hero.id),
    ["3", "2"],
  );
});
