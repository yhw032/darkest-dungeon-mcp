import assert from "node:assert/strict";
import test from "node:test";

import {
  KnowledgeValidationError,
  parseCurioKnowledge,
  parseCurioKnowledgeJson,
} from "../src/knowledge/curio-schema.js";
import { loadCurioKnowledge } from "../src/knowledge/load-curio-knowledge.js";

function validKnowledge(): unknown {
  return {
    schemaVersion: 1,
    curios: [
      {
        id: "test_curio",
        names: { en: "Test Curio", ko: "시험용 골동품" },
        aliases: ["Test"],
        regions: ["ruins"],
        dlcs: [],
        interactions: [
          {
            item: "holy_water",
            recommendation: "recommended",
            certainty: "guaranteed",
            outcomes: [
              {
                type: "stress",
                polarity: "positive",
                description: "Reduces stress.",
                chancePercent: 100,
              },
            ],
          },
        ],
        notes: [],
        sources: [
          {
            title: "Test source",
            url: "https://example.com/curio",
            verifiedAt: "2026-08-31",
          },
        ],
      },
    ],
  };
}

test("validates and preserves localized curio knowledge", () => {
  const result = parseCurioKnowledge(validKnowledge());

  assert.equal(result.schemaVersion, 1);
  assert.equal(result.curios[0]?.names.ko, "시험용 골동품");
  assert.equal(
    result.curios[0]?.interactions[0]?.outcomes[0]?.chancePercent,
    100,
  );
});

test("rejects malformed JSON", () => {
  assert.throws(
    () => parseCurioKnowledgeJson("{"),
    (error) =>
      error instanceof KnowledgeValidationError && error.path === "$",
  );
});

test("reports the path of an invalid knowledge field", () => {
  const knowledge = validKnowledge() as {
    curios: Array<{ interactions: Array<{ recommendation: unknown }> }>;
  };
  knowledge.curios[0]!.interactions[0]!.recommendation = "always";

  assert.throws(
    () => parseCurioKnowledge(knowledge),
    (error) =>
      error instanceof KnowledgeValidationError &&
      error.path === "$.curios[0].interactions[0].recommendation",
  );
});

test("rejects duplicate curio ids", () => {
  const knowledge = validKnowledge() as { curios: unknown[] };
  knowledge.curios.push(structuredClone(knowledge.curios[0]));

  assert.throws(
    () => parseCurioKnowledge(knowledge),
    (error) =>
      error instanceof KnowledgeValidationError &&
      error.path === "$.curios[1].id",
  );
});

test("loads the checked-in verified curio knowledge", async () => {
  const knowledge = await loadCurioKnowledge();

  assert.equal(knowledge.curios.length, 22);
  assert.equal(
    knowledge.curios.filter((curio) => curio.regions.includes("ruins")).length,
    13,
  );
  assert.equal(
    knowledge.curios.filter((curio) => curio.regions.includes("warrens"))
      .length,
    11,
  );
  assert.equal(
    knowledge.curios.find((curio) => curio.id === "eldritch_altar")
      ?.interactions[0]?.item,
    "holy_water",
  );
  assert.deepEqual(
    knowledge.curios
      .find((curio) => curio.id === "locked_display_cabinet")
      ?.interactions.map(({ item }) => item),
    ["skeleton_key", "shovel", null],
  );
  assert.equal(
    knowledge.curios
      .find((curio) => curio.id === "suit_of_armor")
      ?.interactions[0]?.outcomes.length,
    3,
  );
  assert.deepEqual(
    knowledge.curios.find((curio) => curio.id === "rack_of_blades")?.aliases,
    ["Knife Rack"],
  );
  assert.equal(
    knowledge.curios.find((curio) => curio.id === "occult_scrawlings")
      ?.interactions[0]?.recommendation,
    "avoid",
  );
  assert.ok(knowledge.curios.every((curio) => curio.sources.length > 0));
});
