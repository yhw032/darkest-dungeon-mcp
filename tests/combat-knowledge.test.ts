import assert from "node:assert/strict";
import test from "node:test";

import {
  CombatKnowledgeValidationError,
  parseCombatKnowledge,
  parseCombatKnowledgeJson,
} from "../src/knowledge/combat-knowledge-schema.js";
import { loadCombatKnowledge } from "../src/knowledge/load-combat-knowledge.js";

function validKnowledge(): unknown {
  const source = {
    title: "Test source",
    url: "https://example.com/combat",
    verifiedAt: "2026-09-01",
  };
  return {
    schemaVersion: 1,
    regions: [
      {
        id: "ruins",
        dlcs: [],
        overview: "An introductory region dominated by Unholy enemies.",
        commonThreats: [
          {
            id: "backline_stress",
            type: "stress",
            description: "Backline enemies apply stress.",
            counters: ["Backline reach", "Stun"],
          },
        ],
        resistanceTendencies: [
          {
            effect: "bleed",
            tendency: "high",
            note: "Many Unholy enemies resist bleed.",
          },
        ],
        recommendedCapabilities: ["Backline reach"],
        cautions: [],
        sources: [source],
      },
    ],
    enemies: [
      {
        id: "bone_courtier",
        enemyType: "common",
        names: { en: "Bone Courtier" },
        aliases: [],
        regions: ["ruins"],
        dlcs: [],
        priority: "high",
        priorityReasons: ["Applies repeated stress from the backline."],
        traits: ["Unholy"],
        dangerousActions: [
          {
            name: "Tempting Goblet",
            threats: ["stress", "debuff"],
            description: "Applies stress and a stress-received debuff.",
            counters: ["Stun", "Backline damage"],
          },
        ],
        effectiveResponses: ["Remove or stun it early."],
        cautions: ["It becomes less effective when pulled forward."],
        sources: [source],
      },
    ],
  };
}

test("validates qualitative region and enemy combat knowledge", () => {
  const result = parseCombatKnowledge(validKnowledge());

  assert.equal(result.regions[0]?.id, "ruins");
  assert.equal(result.enemies[0]?.priority, "high");
  assert.deepEqual(
    result.enemies[0]?.dangerousActions[0]?.threats,
    ["stress", "debuff"],
  );
});

test("rejects unsupported regions with a precise path", () => {
  const knowledge = validKnowledge() as {
    enemies: Array<{ regions: string[] }>;
  };
  knowledge.enemies[0]!.regions = ["hamlet"];

  assert.throws(
    () => parseCombatKnowledge(knowledge),
    (error) =>
      error instanceof CombatKnowledgeValidationError &&
      error.path === "$.enemies[0].regions[0]",
  );
});

test("rejects duplicate region threat ids", () => {
  const knowledge = validKnowledge() as {
    regions: Array<{ commonThreats: unknown[] }>;
  };
  knowledge.regions[0]!.commonThreats.push(
    structuredClone(knowledge.regions[0]!.commonThreats[0]),
  );

  assert.throws(
    () => parseCombatKnowledge(knowledge),
    (error) =>
      error instanceof CombatKnowledgeValidationError &&
      error.path === "$.regions[0].commonThreats[1]",
  );
});

test("rejects duplicate enemy ids", () => {
  const knowledge = validKnowledge() as { enemies: unknown[] };
  knowledge.enemies.push(structuredClone(knowledge.enemies[0]));

  assert.throws(
    () => parseCombatKnowledge(knowledge),
    (error) =>
      error instanceof CombatKnowledgeValidationError &&
      error.path === "$.enemies[1]",
  );
});

test("rejects enemy references to a region absent from the knowledge base", () => {
  const knowledge = validKnowledge() as {
    regions: unknown[];
  };
  knowledge.regions = [];

  assert.throws(
    () => parseCombatKnowledge(knowledge),
    (error) =>
      error instanceof CombatKnowledgeValidationError &&
      error.path === "$.enemies[0].regions[0]",
  );
});

test("rejects malformed combat knowledge JSON", () => {
  assert.throws(
    () => parseCombatKnowledgeJson("{"),
    (error) =>
      error instanceof CombatKnowledgeValidationError && error.path === "$",
  );
});

test("loads the checked-in combat knowledge base", async () => {
  const knowledge = await loadCombatKnowledge();

  assert.equal(knowledge.schemaVersion, 1);
  assert.deepEqual(knowledge.regions.map(({ id }) => id), [
    "ruins",
    "warrens",
    "weald",
    "cove",
  ]);
  assert.deepEqual(
    knowledge.enemies.map(({ id }) => id),
    [
      "bone_soldier",
      "bone_courtier",
      "bone_arbalist",
      "bone_defender",
      "bone_spearman",
      "bone_captain",
      "bone_bearer",
      "swine_chopper",
      "swine_slasher",
      "swine_wretch",
      "swine_drummer",
      "swinetaur",
      "swine_skiver",
      "ectoplasm",
      "large_ectoplasm",
      "rabid_gnasher",
      "fungal_scratcher",
      "fungal_artillery",
      "crone",
      "unclean_giant",
      "hateful_virago",
      "pelagic_grouper",
      "pelagic_shaman",
      "pelagic_guardian",
      "sea_maggot",
      "deep_stinger",
      "drowned_thrall",
      "uca_major",
      "squiffy_ghast",
      "cultist_brawler",
      "cultist_acolyte",
      "brigand_cutthroat",
      "brigand_fusilier",
      "brigand_bloodletter",
      "brigand_raider",
      "brigand_hunter",
      "madman",
      "maggot",
      "webber",
      "spitter",
      "bone_rabble",
      "ghoul",
      "gargoyle",
    ],
  );
  assert.equal(
    knowledge.enemies.find(({ id }) => id === "bone_bearer")?.priority,
    "critical",
  );
  assert.equal(
    knowledge.enemies.find(({ id }) => id === "swine_skiver")?.priority,
    "critical",
  );
  assert.equal(
    knowledge.enemies.find(({ id }) => id === "hateful_virago")?.priority,
    "critical",
  );
  assert.equal(
    knowledge.enemies.find(({ id }) => id === "drowned_thrall")?.priority,
    "critical",
  );
  assert.ok(
    knowledge.enemies
      .filter(({ regions }) => regions.includes("ruins"))
      .every(
      ({ regions, dangerousActions, effectiveResponses, sources }) =>
        regions.includes("ruins") &&
        dangerousActions.length > 0 &&
        effectiveResponses.length > 0 &&
        sources.length > 0,
    ),
  );
  const warrensEnemies = knowledge.enemies.filter(({ regions }) =>
    regions.length === 1 && regions.includes("warrens"),
  );
  assert.equal(warrensEnemies.length, 6);
  assert.ok(
    warrensEnemies.every(
      ({ dangerousActions, effectiveResponses, sources }) =>
        dangerousActions.length > 0 &&
        effectiveResponses.length > 0 &&
        sources.length > 0,
    ),
  );
  const wealdEnemies = knowledge.enemies.filter(({ regions }) =>
    regions.length === 1 && regions.includes("weald"),
  );
  assert.equal(wealdEnemies.length, 8);
  assert.ok(
    wealdEnemies.every(
      ({ dangerousActions, effectiveResponses, sources }) =>
        dangerousActions.length > 0 &&
        effectiveResponses.length > 0 &&
        sources.length > 0,
    ),
  );
  const coveEnemies = knowledge.enemies.filter(({ regions }) =>
    regions.length === 1 && regions.includes("cove"),
  );
  assert.equal(coveEnemies.length, 8);
  assert.ok(
    coveEnemies.every(
      ({ dangerousActions, effectiveResponses, sources }) =>
        dangerousActions.length > 0 &&
        effectiveResponses.length > 0 &&
        sources.length > 0,
    ),
  );
  const sharedEnemyIds = [
    "cultist_brawler",
    "cultist_acolyte",
    "brigand_cutthroat",
    "brigand_fusilier",
    "brigand_bloodletter",
    "brigand_raider",
    "brigand_hunter",
    "madman",
    "maggot",
    "webber",
    "spitter",
    "bone_rabble",
    "ghoul",
    "gargoyle",
  ];
  const sharedEnemies = knowledge.enemies.filter(({ id }) =>
    sharedEnemyIds.includes(id),
  );
  assert.equal(sharedEnemies.length, 14);
  assert.ok(
    sharedEnemies.every(
      ({ regions, dangerousActions, effectiveResponses, sources }) =>
        regions.length >= 3 &&
        dangerousActions.length > 0 &&
        effectiveResponses.length > 0 &&
        sources.length > 0,
    ),
  );
  assert.deepEqual(
    knowledge.enemies.find(({ id }) => id === "webber")?.regions,
    ["ruins", "warrens", "weald"],
  );
});
