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
    schemaVersion: 1,
    policy: {
      title: "Test policy",
      disclaimer: "Editorial guidance for tests.",
    },
    rules: [
      {
        quirkId: "kleptomaniac",
        priority: "critical",
        factors: ["forced_curio_interaction", "loot_loss"],
        reasons: ["Can take loot."],
        notes: [],
        sources: [
          {
            title: "Game definition",
            reference: "shared/quirk/quirk_library.json#kleptomaniac",
          },
        ],
      },
    ],
  };
}

test("validates quirk treatment policy and rules", () => {
  const knowledge = parseQuirkTreatmentKnowledge(validKnowledge());

  assert.equal(knowledge.schemaVersion, 1);
  assert.equal(knowledge.rules[0]?.priority, "critical");
  assert.deepEqual(knowledge.rules[0]?.factors, [
    "forced_curio_interaction",
    "loot_loss",
  ]);
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

  assert.equal(knowledge.rules.length, 4);
  assert.equal(
    knowledge.rules.find((rule) => rule.quirkId === "kleptomaniac")?.priority,
    "critical",
  );
  assert.ok(knowledge.policy.disclaimer.includes("editorial guidance"));
});
