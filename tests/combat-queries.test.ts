import assert from "node:assert/strict";
import test from "node:test";

import { loadCombatKnowledge } from "../src/knowledge/load-combat-knowledge.js";
import { queryCombatKnowledge } from "../src/queries/query-combat.js";

test("queries an enemy by id, name, and alias", async () => {
  const knowledge = await loadCombatKnowledge();
  const localization = new Map([
    [
      "english",
      new Map([["str_monstername_bloated_corpse_A", "Drowned Thrall"]]),
    ],
  ]);

  assert.equal(
    queryCombatKnowledge(knowledge, { query: "drowned_thrall" }).enemies[0]
      ?.id,
    "drowned_thrall",
  );
  assert.equal(
    queryCombatKnowledge(
      knowledge,
      { query: "Drowned Thrall" },
      localization,
    ).enemies[0]?.id,
    "drowned_thrall",
  );
  assert.equal(
    queryCombatKnowledge(knowledge, { query: "Bloated Thrall" }).enemies[0]
      ?.id,
    "drowned_thrall",
  );
});

test("localizes enemy and dangerous action names from game strings", async () => {
  const knowledge = await loadCombatKnowledge();
  const localization = new Map([
    [
      "koreana",
      new Map([
        ["str_monstername_bloated_corpse_A", "익사한 노예"],
        ["str_monster_skill_bloated_swipe", "거품물고 돌격"],
        ["str_monster_skill_explode", "복수"],
      ]),
    ],
  ]);

  const enemy = queryCombatKnowledge(
    knowledge,
    { query: "익사한 노예", scope: "enemies", language: "ko" },
    localization,
  ).enemies[0];

  assert.equal(enemy?.id, "drowned_thrall");
  assert.equal(enemy?.name, "익사한 노예");
  assert.deepEqual(
    enemy?.dangerousActions.map(({ id, name }) => ({ id, name })),
    [
      { id: "gargling_grab", name: "거품물고 돌격" },
      { id: "the_revenge", name: "복수" },
    ],
  );
});

test("returns one region without unrelated enemies when scoped", async () => {
  const knowledge = await loadCombatKnowledge();
  const result = queryCombatKnowledge(knowledge, {
    region: "cove",
    scope: "regions",
  });

  assert.deepEqual(result.regions.map(({ id }) => id), ["cove"]);
  assert.deepEqual(result.enemies, []);
  assert.equal(result.regions[0]?.name, null);
});

test("searches and displays region names from game localization", async () => {
  const knowledge = await loadCombatKnowledge();
  const localization = new Map([
    ["english", new Map([["dungeon_name_crypts", "Ruins"]])],
    ["koreana", new Map([["dungeon_name_crypts", "폐허"]])],
  ]);

  const result = queryCombatKnowledge(
    knowledge,
    { query: "폐허", scope: "regions", language: "ko" },
    localization,
  );

  assert.deepEqual(result.regions.map(({ id, name }) => ({ id, name })), [
    { id: "ruins", name: "폐허" },
  ]);
});

test("combines region, threat, and priority enemy filters", async () => {
  const knowledge = await loadCombatKnowledge();
  const result = queryCombatKnowledge(knowledge, {
    region: "cove",
    threat: "stress",
    priority: "critical",
    scope: "enemies",
  });

  assert.deepEqual(
    result.enemies.map(({ id }) => id),
    ["drowned_thrall", "madman", "squiffy_ghast"],
  );
  assert.deepEqual(result.regions, []);
});

test("limits region and enemy results independently", async () => {
  const knowledge = await loadCombatKnowledge();
  const result = queryCombatKnowledge(knowledge, { limit: 2 });

  assert.equal(result.regions.length, 2);
  assert.equal(result.enemies.length, 2);
});

test("returns empty collections for an unknown name", async () => {
  const knowledge = await loadCombatKnowledge();

  assert.deepEqual(queryCombatKnowledge(knowledge, { query: "missing" }), {
    regions: [],
    enemies: [],
  });
});
