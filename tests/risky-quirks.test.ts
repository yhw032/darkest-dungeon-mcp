import assert from "node:assert/strict";
import test from "node:test";

import type { Hero, Roster } from "../src/domain/hero.js";
import type { QuirkDefinition } from "../src/domain/quirk-definitions.js";
import type { QuirkTreatmentKnowledgeBase } from "../src/domain/quirk-treatment-knowledge.js";
import { analyzeRiskyQuirks } from "../src/queries/analyze-risky-quirks.js";

function hero(
  id: string,
  name: string,
  quirks: Array<{ id: string; isLocked: boolean }>,
): Hero {
  return {
    id,
    name,
    heroClass: "crusader",
    resolveXp: 12,
    stress: 20,
    rosterStatus: 0,
    buildingName: null,
    currentHp: 25,
    weaponRank: 1,
    armourRank: 1,
    afflictionId: null,
    afflictionSeverity: 0,
    virtueId: null,
    visitedDeathsDoor: false,
    hasHadHeartAttack: false,
    deathHeartAttackCompleted: false,
    quirks: quirks.map((quirk) => ({
      ...quirk,
      isNew: false,
      evolutionDurationRemaining: 0,
    })),
    equippedTrinkets: [],
    combatSkills: [],
    campingSkills: [],
    combatSkillSelections: [],
    campingSkillSelections: [],
  };
}

function definition(
  id: string,
  name: string,
  curioTag: string | null,
): QuirkDefinition {
  return {
    id,
    isPositive: false,
    isDisease: false,
    classification: "mental",
    incompatibleQuirks: [],
    curioTag,
    curioTagChance: curioTag === null ? 0 : 0.35,
    keepsLoot: id === "kleptomaniac",
    canModifyInActivity: true,
    canBeReplacedByNewQuirk: true,
    effects: [],
    unresolvedBuffIds: [],
    localization: {
      english: { name, description: `${name} description` },
      korean: { name: `${name} KO`, description: `${name} KO description` },
    },
  };
}

const roster: Roster = {
  version: 1,
  nextGuid: 4,
  heroes: [
    hero("1", "Alpha", [
      { id: "curious", isLocked: false },
      { id: "kleptomaniac", isLocked: true },
    ]),
    hero("2", "Beta", [{ id: "curious", isLocked: true }]),
    hero("3", "Gamma", [{ id: "harmless", isLocked: true }]),
    {
      ...hero("4", "Deceased", [{ id: "kleptomaniac", isLocked: true }]),
      rosterStatus: 3,
    },
  ],
};

const definitions = [
  definition("kleptomaniac", "Kleptomaniac", "Treasure"),
  definition("curious", "Curious", "All"),
];

const knowledge: QuirkTreatmentKnowledgeBase = {
  schemaVersion: 1,
  policy: { title: "Test", disclaimer: "Test policy" },
  rules: [
    {
      quirkId: "kleptomaniac",
      priority: "critical",
      factors: ["forced_curio_interaction", "loot_loss"],
      reasons: ["Takes loot."],
      notes: [],
      sources: [{ title: "Game", reference: "fixture" }],
    },
    {
      quirkId: "curious",
      priority: "high",
      factors: ["forced_curio_interaction"],
      reasons: ["Touches curios."],
      notes: [],
      sources: [{ title: "Game", reference: "fixture" }],
    },
  ],
};

test("ranks heroes and quirks by treatment priority", () => {
  const result = analyzeRiskyQuirks(roster, definitions, knowledge);

  assert.equal(result.length, 2);
  assert.equal(result[0]?.heroName, "Alpha");
  assert.equal(result[0]?.overallPriority, "critical");
  assert.deepEqual(
    result[0]?.riskyQuirks.map((quirk) => quirk.id),
    ["kleptomaniac", "curious"],
  );
  assert.deepEqual(result[0]?.riskyQuirks[0]?.curioInteraction, {
    tag: "Treasure",
    chance: 0.35,
    keepsLoot: true,
  });
  assert.equal(result[0]?.riskyQuirks[0]?.name.korean, "Kleptomaniac KO");
  assert.equal(result[1]?.heroName, "Beta");
});

test("filters by minimum priority, locked state, hero, and limit", () => {
  assert.deepEqual(
    analyzeRiskyQuirks(roster, definitions, knowledge, {
      minimumPriority: "critical",
    }).map((candidate) => candidate.heroId),
    ["1"],
  );
  const locked = analyzeRiskyQuirks(roster, definitions, knowledge, {
    lockedOnly: true,
    heroId: "2",
    limit: 1,
  });
  assert.equal(locked.length, 1);
  assert.deepEqual(
    locked[0]?.riskyQuirks.map((quirk) => quirk.id),
    ["curious"],
  );
  assert.deepEqual(
    analyzeRiskyQuirks(roster, definitions, knowledge, { limit: -1 }),
    [],
  );
});

test("preserves a matched rule when its game definition is unavailable", () => {
  const result = analyzeRiskyQuirks(roster, [], knowledge, {
    heroId: "1",
    minimumPriority: "critical",
  });

  assert.equal(result[0]?.riskyQuirks[0]?.definitionFound, false);
  assert.deepEqual(result[0]?.riskyQuirks[0]?.name, {
    english: null,
    korean: null,
  });
  assert.deepEqual(result[0]?.riskyQuirks[0]?.effects, []);
});

test("does not report heroes without a matching treatment rule", () => {
  assert.deepEqual(
    analyzeRiskyQuirks(roster, definitions, knowledge, { heroId: "3" }),
    [],
  );
});

test("does not recommend treatment for deceased heroes", () => {
  assert.deepEqual(
    analyzeRiskyQuirks(roster, definitions, knowledge, { heroId: "4" }),
    [],
  );
});
