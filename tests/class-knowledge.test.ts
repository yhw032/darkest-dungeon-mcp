import assert from "node:assert/strict";
import test from "node:test";

import {
  ClassKnowledgeValidationError,
  parseClassKnowledge,
  parseClassKnowledgeJson,
} from "../src/knowledge/class-knowledge-schema.js";
import { loadClassKnowledge } from "../src/knowledge/load-class-knowledge.js";

function validKnowledge(): unknown {
  return {
    schemaVersion: 1,
    classes: [
      {
        id: "plague_doctor",
        names: { en: "Plague Doctor", ko: "역병 의사" },
        aliases: [],
        dlcs: [],
        summary: "A backline controller specializing in blight and stuns.",
        roles: ["control", "blight"],
        strengths: ["Can affect both enemy back ranks with one skill."],
        limitations: ["Direct damage is initially low."],
        positionGuidance: [
          {
            positions: [3, 4],
            recommendation: "preferred",
            reason: "Most ranged skills remain available.",
          },
        ],
        mechanics: [
          { id: "blight", description: "Applies damage over time." },
        ],
        skillGuidance: [
          {
            skillId: "plague_grenade",
            useCases: ["Pressure two backline enemies."],
            synergies: ["Benefits from blight resistance reduction."],
            cautions: ["Cannot target the front ranks."],
          },
        ],
        partySynergies: [
          {
            heroClassId: "abomination",
            reasons: ["Can contribute additional blight damage."],
          },
        ],
        sources: [
          {
            title: "Test source",
            url: "https://example.com/plague-doctor",
            verifiedAt: "2026-09-01",
          },
        ],
      },
    ],
  };
}

test("validates structured class and skill guidance", () => {
  const knowledge = parseClassKnowledge(validKnowledge());

  assert.equal(knowledge.classes[0]?.id, "plague_doctor");
  assert.deepEqual(knowledge.classes[0]?.positionGuidance[0]?.positions, [3, 4]);
  assert.equal(
    knowledge.classes[0]?.skillGuidance[0]?.skillId,
    "plague_grenade",
  );
});

test("rejects invalid party positions with a precise path", () => {
  const knowledge = validKnowledge() as {
    classes: Array<{
      positionGuidance: Array<{ positions: number[] }>;
    }>;
  };
  knowledge.classes[0]!.positionGuidance[0]!.positions = [0];

  assert.throws(
    () => parseClassKnowledge(knowledge),
    (error) =>
      error instanceof ClassKnowledgeValidationError &&
      error.path === "$.classes[0].positionGuidance[0].positions[0]",
  );
});

test("rejects duplicate class ids", () => {
  const knowledge = validKnowledge() as { classes: unknown[] };
  knowledge.classes.push(structuredClone(knowledge.classes[0]));

  assert.throws(
    () => parseClassKnowledge(knowledge),
    (error) =>
      error instanceof ClassKnowledgeValidationError &&
      error.path === "$.classes[1].id",
  );
});

test("rejects duplicate skill guidance", () => {
  const knowledge = validKnowledge() as {
    classes: Array<{ skillGuidance: unknown[] }>;
  };
  knowledge.classes[0]!.skillGuidance.push(
    structuredClone(knowledge.classes[0]!.skillGuidance[0]),
  );

  assert.throws(
    () => parseClassKnowledge(knowledge),
    (error) =>
      error instanceof ClassKnowledgeValidationError &&
      error.path === "$.classes[0].skillGuidance[1]",
  );
});

test("rejects malformed class knowledge JSON", () => {
  assert.throws(
    () => parseClassKnowledgeJson("{"),
    (error) =>
      error instanceof ClassKnowledgeValidationError && error.path === "$",
  );
});

test("loads the checked-in class knowledge base", async () => {
  const knowledge = await loadClassKnowledge();

  assert.equal(knowledge.schemaVersion, 1);
  assert.equal(knowledge.classes.length, 18);
  assert.deepEqual(
    knowledge.classes.map(({ id }) => id).sort(),
    [
      "abomination", "antiquarian", "arbalest", "bounty_hunter",
      "crusader", "flagellant", "grave_robber", "hellion", "highwayman",
      "houndmaster", "jester", "leper", "man_at_arms", "musketeer",
      "occultist", "plague_doctor", "shieldbreaker", "vestal"
    ],
  );
  assert.ok(
    knowledge.classes.every(
      ({ roles, strengths, positionGuidance, sources }) =>
        roles.length > 0 && strengths.length > 0 &&
        positionGuidance.length > 0 && sources.length > 0,
    ),
  );
  assert.deepEqual(
    knowledge.classes.filter(({ dlcs }) => dlcs.length > 0)
      .map(({ id }) => id).sort(),
    ["flagellant", "musketeer", "shieldbreaker"],
  );
});
