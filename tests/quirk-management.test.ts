import assert from "node:assert/strict";
import test from "node:test";

import type { Hero, Roster } from "../src/domain/hero.js";
import type { QuirkDefinition } from "../src/domain/quirk-definitions.js";
import type { QuirkTreatmentKnowledgeBase } from "../src/domain/quirk-treatment-knowledge.js";
import { recommendQuirkManagement } from "../src/queries/recommend-quirk-management.js";

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
  isPositive: boolean,
  canBeReplacedByNewQuirk = true,
): QuirkDefinition {
  return {
    id,
    isPositive,
    isDisease: false,
    classification: "physical",
    incompatibleQuirks: [],
    curioTag: null,
    curioTagChance: 0,
    keepsLoot: false,
    canModifyInActivity: true,
    canBeReplacedByNewQuirk,
    effects: [],
    unresolvedBuffIds: [],
    localization: {
      en: { name: `${id} name`, description: `${id} description` },
      ko: { name: `${id} ko`, description: `${id} ko description` },
    },
  };
}

const roster: Roster = {
  version: 1,
  nextGuid: 3,
  heroes: [
    hero("1", "Alpha", [
      { id: "kleptomaniac", isLocked: true },
      { id: "luminous", isLocked: false },
      { id: "steady", isLocked: true },
      { id: "armor_haggler", isLocked: true },
      { id: "unrated_positive", isLocked: false },
    ]),
    hero("2", "Beta", [
      { id: "luminous", isLocked: true },
      { id: "quick_reflexes", isLocked: true },
      { id: "natural_swing", isLocked: true },
      { id: "corvids_eye", isLocked: false },
    ]),
  ],
};

const definitions = [
  definition("kleptomaniac", false),
  definition("luminous", true),
  definition("steady", true),
  definition("armor_haggler", true),
  definition("unrated_positive", true),
  definition("quick_reflexes", true),
  definition("natural_swing", true),
  definition("corvids_eye", true),
];

const source = {
  kind: "game" as const,
  title: "Fixture",
  reference: "fixture",
  verifiedAt: "2026-09-10",
};

const knowledge: QuirkTreatmentKnowledgeBase = {
  schemaVersion: 2,
  policy: { title: "Test", disclaimer: "Editorial fixture." },
  rules: [
    {
      action: "remove_negative",
      quirkId: "kleptomaniac",
      priority: "critical",
      factors: ["loot_loss"],
      reasons: ["Loses loot."],
      notes: [],
      sources: [source],
    },
    ...[
      ["corvids_eye", "critical"],
      ["luminous", "high"],
      ["quick_reflexes", "high"],
      ["natural_swing", "high"],
      ["steady", "medium"],
      ["armor_haggler", "low"],
    ].map(([quirkId, priority]) => ({
      action: "lock_positive" as const,
      quirkId: quirkId!,
      priority: priority as "critical" | "high" | "medium" | "low",
      factors: ["speed" as const],
      applicability: "universal" as const,
      heroClasses: [],
      reasons: ["Useful."],
      notes: [],
      cautions: [],
      sources: [source],
    })),
  ],
};

test("separates negative removals from positive lock guidance", () => {
  const result = recommendQuirkManagement(roster, definitions, knowledge, {
    heroId: "1",
    includeUnrated: true,
    language: "ko",
  });

  assert.equal(result.length, 1);
  assert.deepEqual(
    result[0]?.negativeRemovals.map((quirk) => quirk.id),
    ["kleptomaniac"],
  );
  assert.deepEqual(
    result[0]?.positiveQuirks.map((quirk) => [
      quirk.id,
      quirk.recommendedAction,
    ]),
    [
      ["luminous", "lock_positive"],
      ["steady", "keep_locked"],
      ["armor_haggler", "do_not_prioritize"],
      ["unrated_positive", "unrated"],
    ],
  );
  assert.equal(result[0]?.positiveQuirks[0]?.name, "luminous ko");
  assert.deepEqual(result[0]?.positiveLockSlots, {
    used: 2,
    maximum: 3,
    remaining: 1,
    definitionCoverageComplete: true,
  });
});

test("warns when a high-value unlocked quirk has no free lock slot", () => {
  const result = recommendQuirkManagement(roster, definitions, knowledge, {
    heroId: "2",
  });

  assert.equal(result[0]?.positiveLockSlots.remaining, 0);
  const corvidsEye = result[0]?.positiveQuirks.find(
    (quirk) => quirk.id === "corvids_eye",
  );
  assert.equal(corvidsEye?.recommendedAction, "lock_positive");
  assert.ok(corvidsEye?.cautions.some((caution) => caution.includes("No verified")));
});

test("filters positive and negative priorities independently", () => {
  const result = recommendQuirkManagement(roster, definitions, knowledge, {
    heroId: "1",
    minimumNegativePriority: "critical",
    minimumPositivePriority: "high",
  });

  assert.deepEqual(
    result[0]?.negativeRemovals.map((quirk) => quirk.id),
    ["kleptomaniac"],
  );
  assert.deepEqual(
    result[0]?.positiveQuirks.map((quirk) => quirk.id),
    ["luminous"],
  );
});

test("marks lock-slot coverage incomplete when a locked definition is missing", () => {
  const incompleteRoster: Roster = {
    ...roster,
    heroes: [
      hero("3", "Unknown", [
        { id: "unknown_locked", isLocked: true },
        { id: "luminous", isLocked: false },
      ]),
    ],
  };

  const result = recommendQuirkManagement(
    incompleteRoster,
    definitions,
    knowledge,
  );
  assert.equal(
    result[0]?.positiveLockSlots.definitionCoverageComplete,
    false,
  );
});

test("excludes unrated positive quirks unless requested", () => {
  const result = recommendQuirkManagement(roster, definitions, knowledge, {
    heroId: "1",
  });
  assert.equal(
    result[0]?.positiveQuirks.some((quirk) => quirk.id === "unrated_positive"),
    false,
  );
});

test("does not recommend locking without an installed game definition", () => {
  const result = recommendQuirkManagement(
    roster,
    definitions.filter((candidate) => candidate.id !== "luminous"),
    knowledge,
    { heroId: "1" },
  );
  const luminous = result[0]?.positiveQuirks.find(
    (quirk) => quirk.id === "luminous",
  );

  assert.equal(luminous?.recommendedAction, "do_not_prioritize");
  assert.equal(luminous?.definitionFound, false);
  assert.equal(luminous?.sources[0]?.reference, "fixture");
  assert.ok(
    luminous?.cautions.some((caution) => caution.includes("unavailable")),
  );
});

test("does not recommend a class-scoped quirk to an unmatched hero", () => {
  const scopedKnowledge = structuredClone(knowledge);
  const luminous = scopedKnowledge.rules.find(
    (rule) => rule.quirkId === "luminous",
  );
  assert.equal(luminous?.action, "lock_positive");
  if (luminous?.action !== "lock_positive") return;
  luminous.applicability = "hero_class";
  luminous.heroClasses = ["vestal"];

  const result = recommendQuirkManagement(
    roster,
    definitions,
    scopedKnowledge,
    { heroId: "1" },
  );
  const recommendation = result[0]?.positiveQuirks.find(
    (quirk) => quirk.id === "luminous",
  );

  assert.equal(recommendation?.heroClassMatches, false);
  assert.equal(recommendation?.recommendedAction, "do_not_prioritize");
  assert.ok(
    recommendation?.cautions.some((caution) => caution.includes("crusader")),
  );
});
