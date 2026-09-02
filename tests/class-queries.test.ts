import assert from "node:assert/strict";
import test from "node:test";

import { loadClassKnowledge } from "../src/knowledge/load-class-knowledge.js";
import { queryClasses } from "../src/queries/query-classes.js";

const localization = new Map([
  [
    "english",
    new Map([
      ["hero_class_name_plague_doctor", "Plague Doctor"],
      ["combat_skill_name_plague_doctor_plague_grenade", "Plague Grenade"],
    ]),
  ],
  [
    "koreana",
    new Map([
      ["hero_class_name_plague_doctor", "역병 의사"],
      ["combat_skill_name_plague_doctor_plague_grenade", "역병 수류탄"],
    ]),
  ],
]);

test("queries one class by exact id", async () => {
  const knowledge = await loadClassKnowledge();
  const results = queryClasses(
    knowledge,
    { id: "plague_doctor", language: "ko" },
    localization,
  );

  assert.equal(results.length, 1);
  assert.equal(results[0]?.name, "역병 의사");
  assert.equal(
    results[0]?.skillGuidance.find(
      ({ skillId }) => skillId === "plague_grenade",
    )?.name,
    "역병 수류탄",
  );
  assert.ok(results[0]?.roles.includes("blight"));
});

test("searches classes by English name, Korean name, and alias", async () => {
  const knowledge = await loadClassKnowledge();

  assert.equal(
    queryClasses(knowledge, { query: "plague doc" }, localization)[0]?.id,
    "plague_doctor",
  );
  assert.equal(
    queryClasses(knowledge, { query: "  역병 의사 " }, localization)[0]?.id,
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
    queryClasses(
      knowledge,
      { query: "doctor", role: "stun", isDlc: false, limit: 1 },
      localization,
    ).map(({ id }) => id),
    ["plague_doctor"],
  );
  assert.deepEqual(queryClasses(knowledge, { id: "missing_class" }), []);
  assert.deepEqual(queryClasses(knowledge, { limit: 0 }), []);
});
