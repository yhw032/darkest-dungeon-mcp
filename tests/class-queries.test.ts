import assert from "node:assert/strict";
import test from "node:test";

import { loadClassKnowledge } from "../src/knowledge/load-class-knowledge.js";
import { queryClasses } from "../src/queries/query-classes.js";

test("queries one class by exact id", async () => {
  const knowledge = await loadClassKnowledge();

  const results = queryClasses(knowledge, { id: "plague_doctor" });

  assert.equal(results.length, 1);
  assert.equal(results[0]?.names.en, "Plague Doctor");
  assert.ok(results[0]?.roles.includes("blight"));
});

test("searches classes by English name, Korean name, and alias", async () => {
  const knowledge = await loadClassKnowledge();

  assert.equal(
    queryClasses(knowledge, { query: "plague doc" })[0]?.id,
    "plague_doctor",
  );
  assert.equal(
    queryClasses(knowledge, { query: "  역병 의사 " })[0]?.id,
    "plague_doctor",
  );
  assert.equal(
    queryClasses(knowledge, { query: "man at arms" })[0]?.id,
    "man_at_arms",
  );
});

test("filters classes by normalized role", async () => {
  const knowledge = await loadClassKnowledge();

  assert.deepEqual(
    queryClasses(knowledge, { role: "armor-piercing" }).map(({ id }) => id),
    ["grave_robber", "shieldbreaker"],
  );
});

test("filters base-game and DLC classes", async () => {
  const knowledge = await loadClassKnowledge();

  assert.equal(queryClasses(knowledge, { isDlc: false }).length, 15);
  assert.deepEqual(
    queryClasses(knowledge, { isDlc: true }).map(({ id }) => id),
    ["flagellant", "musketeer", "shieldbreaker"],
  );
  assert.deepEqual(
    queryClasses(knowledge, { dlc: "Crimson Court" }).map(({ id }) => id),
    ["flagellant"],
  );
});

test("combines filters without guessing and respects limits", async () => {
  const knowledge = await loadClassKnowledge();

  assert.deepEqual(
    queryClasses(knowledge, {
      query: "doctor",
      role: "stun",
      isDlc: false,
      limit: 1,
    }).map(({ id }) => id),
    ["plague_doctor"],
  );
  assert.deepEqual(
    queryClasses(knowledge, { id: "missing_class" }),
    [],
  );
  assert.deepEqual(queryClasses(knowledge, { limit: 0 }), []);
});
