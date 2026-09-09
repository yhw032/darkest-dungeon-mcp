import assert from "node:assert/strict";
import test from "node:test";

import { KnowledgeValidationError } from "../src/knowledge/curio-schema.js";
import { loadQuirkTreatmentKnowledge } from "../src/knowledge/load-quirk-treatment-knowledge.js";
import {
  parseQuirkTreatmentKnowledge,
  parseQuirkTreatmentKnowledgeJson,
} from "../src/knowledge/quirk-treatment-schema.js";

function validKnowledge(): unknown {
  return {
    schemaVersion: 2,
    policy: {
      title: "Test policy",
      disclaimer: "Editorial guidance for tests.",
    },
    rules: [
      {
        action: "remove_negative",
        quirkId: "kleptomaniac",
        priority: "critical",
        factors: ["forced_curio_interaction", "loot_loss"],
        reasons: ["Can take loot."],
        notes: [],
        sources: [
          {
            kind: "game",
            title: "Game definition",
            reference: "shared/quirk/quirk_library.json#kleptomaniac",
            verifiedAt: "2026-09-09",
          },
        ],
      },
    ],
  };
}

test("validates quirk treatment policy and rules", () => {
  const knowledge = parseQuirkTreatmentKnowledge(validKnowledge());

  assert.equal(knowledge.schemaVersion, 2);
  assert.equal(knowledge.rules[0]?.action, "remove_negative");
  assert.equal(knowledge.rules[0]?.priority, "critical");
  assert.deepEqual(knowledge.rules[0]?.factors, [
    "forced_curio_interaction",
    "loot_loss",
  ]);
});

test("validates positive quirk lock rules separately", () => {
  const value = validKnowledge() as { rules: unknown[] };
  value.rules.push({
    action: "lock_positive",
    quirkId: "quick_reflexes",
    priority: "high",
    factors: ["speed"],
    applicability: "universal",
    heroClasses: [],
    reasons: ["Provides an unconditional speed bonus."],
    notes: [],
    cautions: ["Lock capacity is limited."],
    sources: [
      {
        kind: "game",
        title: "Game definition",
        reference: "shared/quirk/quirk_library.json#quick_reflexes",
        verifiedAt: "2026-09-09",
      },
    ],
  });

  const knowledge = parseQuirkTreatmentKnowledge(value);
  const rule = knowledge.rules[1];
  assert.equal(rule?.action, "lock_positive");
  if (rule?.action !== "lock_positive") return;
  assert.equal(rule.applicability, "universal");
  assert.deepEqual(rule.factors, ["speed"]);
});

test("rejects malformed treatment knowledge JSON", () => {
  assert.throws(
    () => parseQuirkTreatmentKnowledgeJson("{"),
    (error) =>
      error instanceof KnowledgeValidationError && error.path === "$",
  );
});

test("reports an invalid priority with its path", () => {
  const value = validKnowledge() as {
    rules: Array<{ priority: unknown }>;
  };
  value.rules[0]!.priority = "urgent";

  assert.throws(
    () => parseQuirkTreatmentKnowledge(value),
    (error) =>
      error instanceof KnowledgeValidationError &&
      error.path === "$.rules[0].priority",
  );
});

test("rejects duplicate treatment rules", () => {
  const value = validKnowledge() as { rules: unknown[] };
  value.rules.push(structuredClone(value.rules[0]));

  assert.throws(
    () => parseQuirkTreatmentKnowledge(value),
    (error) =>
      error instanceof KnowledgeValidationError &&
      error.path === "$.rules[1].quirkId",
  );
});

test("rejects duplicate risk factors", () => {
  const value = validKnowledge() as {
    rules: Array<{ factors: string[] }>;
  };
  value.rules[0]!.factors = ["loot_loss", "loot_loss"];

  assert.throws(
    () => parseQuirkTreatmentKnowledge(value),
    (error) =>
      error instanceof KnowledgeValidationError &&
      error.path === "$.rules[0].factors",
  );
});

test("loads the checked-in treatment knowledge", async () => {
  const knowledge = await loadQuirkTreatmentKnowledge();

  assert.equal(knowledge.rules.length, 56);
  assert.equal(
    knowledge.rules.find((rule) => rule.quirkId === "kleptomaniac")?.priority,
    "critical",
  );
  const slowReflexes = knowledge.rules.find(
    (rule) => rule.quirkId === "slow_reflexes",
  );
  assert.equal(slowReflexes?.priority, "high");
  assert.equal(slowReflexes?.action, "remove_negative");
  if (slowReflexes?.action !== "remove_negative") return;
  assert.ok(slowReflexes.factors.includes("combat_penalty"));
  assert.equal(
    knowledge.rules.find((rule) => rule.quirkId === "corvids_eye")?.priority,
    "critical",
  );
  assert.equal(
    knowledge.rules.find((rule) => rule.quirkId === "fast_healer")?.priority,
    "low",
  );
  assert.ok(knowledge.policy.disclaimer.includes("editorial guidance"));
});

test("verifies checked-in management rules against the game install", async () => {
  const gameDirectory =
    process.env.DD_GAME_DIR ??
    "D:\\SteamLibrary\\steamapps\\common\\DarkestDungeon";

  let gameQuirks;
  try {
    const { loadQuirkDefinitions } = await import(
      "../src/quirks/load-quirk-definitions.js"
    );
    gameQuirks = await loadQuirkDefinitions(gameDirectory);
  } catch {
    return;
  }

  const gameQuirkById = new Map(gameQuirks.map((quirk) => [quirk.id, quirk]));
  const knowledge = await loadQuirkTreatmentKnowledge();

  for (const rule of knowledge.rules) {
    const definition = gameQuirkById.get(rule.quirkId);
    assert.ok(
      definition,
      `Quirk id "${rule.quirkId}" from quirk-treatment.json was not found in the game installation!`,
    );
    assert.equal(
      definition.isPositive,
      rule.action === "lock_positive",
      `Quirk id "${rule.quirkId}" has the wrong polarity for ${rule.action}.`,
    );
    if (rule.action === "lock_positive") {
      assert.equal(
        definition.canBeReplacedByNewQuirk,
        true,
        `Non-replaceable quirk "${rule.quirkId}" must not be recommended for locking.`,
      );
    }
  }
});
