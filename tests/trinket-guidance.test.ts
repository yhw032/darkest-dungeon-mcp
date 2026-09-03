import assert from "node:assert/strict";
import test from "node:test";

import { KnowledgeValidationError } from "../src/knowledge/curio-schema.js";
import { loadTrinketDefinitions } from "../src/trinkets/load-trinket-definitions.js";
import { loadTrinketGuidance } from "../src/knowledge/load-trinket-guidance.js";
import {
  parseTrinketGuidanceKnowledge,
  parseTrinketGuidanceKnowledgeJson,
} from "../src/knowledge/trinket-guidance-schema.js";

test("parses valid trinket guidance knowledge", () => {
  const parsed = parseTrinketGuidanceKnowledge({
    schemaVersion: 1,
    policy: {
      title: "Test Trinket Policy",
      disclaimer: "Test disclaimer",
    },
    trinkets: [
      {
        trinketId: "focus_ring",
        tier: "S",
        recommendedRoles: ["damage", "accuracy"],
        recommendedClasses: ["leper", "crusader"],
        synergies: ["Low-accuracy attackers"],
        cautions: ["Reduces dodge"],
        playstyleAdvice: "Core offensive trinket",
      },
    ],
  });

  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.policy.title, "Test Trinket Policy");
  assert.equal(parsed.trinkets.length, 1);
  assert.equal(parsed.trinkets[0]?.trinketId, "focus_ring");
  assert.equal(parsed.trinkets[0]?.tier, "S");
});

test("reports path for invalid trinket guidance field", () => {
  assert.throws(
    () =>
      parseTrinketGuidanceKnowledge({
        schemaVersion: 1,
        policy: {
          title: "Test Policy",
          disclaimer: "Test disclaimer",
        },
        trinkets: [
          {
            trinketId: "invalid_trinket",
            tier: "INVALID_TIER",
            recommendedRoles: [],
            recommendedClasses: [],
            synergies: [],
            cautions: [],
            playstyleAdvice: "",
          },
        ],
      }),
    (error: unknown) => {
      assert.ok(error instanceof KnowledgeValidationError);
      assert.match(error.message, /\$\.trinkets\[0\]\.tier/);
      return true;
    },
  );
});

test("rejects duplicate trinket ids in guidance knowledge", () => {
  assert.throws(
    () =>
      parseTrinketGuidanceKnowledge({
        schemaVersion: 1,
        policy: {
          title: "Test Policy",
          disclaimer: "Test disclaimer",
        },
        trinkets: [
          {
            trinketId: "focus_ring",
            tier: "S",
            recommendedRoles: ["damage"],
            recommendedClasses: [],
            synergies: [],
            cautions: [],
            playstyleAdvice: "Test advice",
          },
          {
            trinketId: "focus_ring",
            tier: "A",
            recommendedRoles: ["damage"],
            recommendedClasses: [],
            synergies: [],
            cautions: [],
            playstyleAdvice: "Test advice 2",
          },
        ],
      }),
    (error: unknown) => {
      assert.ok(error instanceof KnowledgeValidationError);
      assert.match(error.message, /duplicate trinket id: focus_ring/);
      return true;
    },
  );
});

test("loads and validates checked-in trinkets.json", async () => {
  const guidance = await loadTrinketGuidance();
  assert.equal(guidance.schemaVersion, 1);
  assert.ok(guidance.policy.title.length > 0);
  assert.ok(guidance.trinkets.length >= 40);

  const focusRing = guidance.trinkets.find((t) => t.trinketId === "focus_ring");
  assert.ok(focusRing);
  assert.equal(focusRing.tier, "S");
  assert.ok(focusRing.synergies.length > 0);

  const blasphemousVial = guidance.trinkets.find(
    (t) => t.trinketId === "blasphemous_vial",
  );
  assert.ok(blasphemousVial);
  assert.equal(blasphemousVial.tier, "S");
  assert.deepEqual(blasphemousVial.recommendedClasses, ["plague_doctor"]);
});

test("verifies that all checked-in trinket guidance IDs exist in the game install", async () => {
  const gameDirectory =
    process.env.DD_GAME_DIR ??
    "D:\\SteamLibrary\\steamapps\\common\\DarkestDungeon";

  let gameTrinkets;
  try {
    gameTrinkets = await loadTrinketDefinitions(gameDirectory);
  } catch {
    return;
  }

  const gameTrinketIdSet = new Set(gameTrinkets.map((t) => t.id));
  const guidance = await loadTrinketGuidance();

  for (const entry of guidance.trinkets) {
    assert.ok(
      gameTrinketIdSet.has(entry.trinketId),
      `Trinket id "${entry.trinketId}" from trinkets.json was not found in the game installation!`,
    );
  }
});
