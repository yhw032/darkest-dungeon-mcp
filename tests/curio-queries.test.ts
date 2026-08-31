import assert from "node:assert/strict";
import test from "node:test";

import type { CurioKnowledgeBase } from "../src/domain/curio-knowledge.js";
import { loadCurioKnowledge } from "../src/knowledge/load-curio-knowledge.js";
import { getCurioAdvice } from "../src/queries/get-curio-advice.js";
import { searchCurios } from "../src/queries/search-curios.js";

test("searches curios by id, alias, partial name, and region", async () => {
  const knowledge = await loadCurioKnowledge();

  assert.equal(searchCurios(knowledge, { query: "eldritch_altar" })[0]?.id, "eldritch_altar");
  assert.equal(searchCurios(knowledge, { query: "Shambler Altar" })[0]?.id, "shamblers_altar");
  assert.equal(searchCurios(knowledge, { query: "Knife Rack" })[0]?.id, "rack_of_blades");
  assert.equal(searchCurios(knowledge, { query: "Cosmic Spiderweb" })[0]?.id, "eerie_spiderweb");
  assert.deepEqual(
    searchCurios(knowledge, { query: "fountain", region: "ruins" }).map(
      (curio) => curio.id,
    ),
    ["holy_fountain"],
  );
  assert.deepEqual(
    searchCurios(knowledge, { region: "warrens", limit: 1 }).map(
      (curio) => curio.id,
    ),
    ["bone_altar"],
  );
});

test("matches normalized Korean names", () => {
  const knowledge: CurioKnowledgeBase = {
    schemaVersion: 1,
    curios: [
      {
        id: "test_curio",
        names: { en: "Test Curio", ko: "시험용 골동품" },
        aliases: [],
        regions: ["ruins"],
        dlcs: [],
        interactions: [
          {
            item: null,
            recommendation: "avoid",
            certainty: "guaranteed",
            outcomes: [
              {
                type: "nothing",
                polarity: "neutral",
                description: "Nothing happens.",
              },
            ],
          },
        ],
        notes: [],
        sources: [
          {
            title: "Test",
            url: "https://example.com",
            verifiedAt: "2026-08-31",
          },
        ],
      },
    ],
  };

  assert.equal(searchCurios(knowledge, { query: "  시험용  " })[0]?.id, "test_curio");
});

test("recommends an interaction enabled by supplied items", async () => {
  const result = getCurioAdvice(await loadCurioKnowledge(), {
    name: "Eldritch Altar",
    availableItems: ["Holy Water"],
  });

  assert.equal(result.status, "found");
  if (result.status !== "found") return;
  assert.equal(result.recommendedInteraction?.item, "holy_water");
  assert.deepEqual(
    result.usableInteractions.map((interaction) => interaction.item),
    ["holy_water", null],
  );
  assert.match(result.warnings[0] ?? "", /no-item/);
});

test("warns when supplied items cannot enable a recommended interaction", async () => {
  const result = getCurioAdvice(await loadCurioKnowledge(), {
    curioId: "eldritch_altar",
    availableItems: ["shovel"],
  });

  assert.equal(result.status, "found");
  if (result.status !== "found") return;
  assert.equal(result.recommendedInteraction, null);
  assert.deepEqual(
    result.usableInteractions.map((interaction) => interaction.item),
    [null],
  );
  assert.match(result.warnings[0] ?? "", /supplied items/);
  assert.match(result.warnings[1] ?? "", /no-item/);
});

test("returns situational and no-item warnings without inventing a recommendation", async () => {
  const result = getCurioAdvice(await loadCurioKnowledge(), {
    name: "Shambler Altar",
    availableItems: ["torch"],
  });

  assert.equal(result.status, "found");
  if (result.status !== "found") return;
  assert.equal(result.recommendedInteraction, null);
  assert.deepEqual(
    result.usableInteractions.map((interaction) => interaction.item),
    ["torch", null],
  );
  assert.match(result.warnings[0] ?? "", /no-item/);
});

test("warns when a supplied provision is harmful for a curio", async () => {
  const result = getCurioAdvice(await loadCurioKnowledge(), {
    name: "Occult Scrawlings",
    availableItems: ["Holy Water"],
  });

  assert.equal(result.status, "found");
  if (result.status !== "found") return;
  assert.equal(result.recommendedInteraction, null);
  assert.deepEqual(
    result.usableInteractions.map((interaction) => interaction.item),
    ["holy_water", null],
  );
  assert.match(result.warnings[0] ?? "", /holy_water/);
  assert.match(result.warnings[1] ?? "", /no-item/);
});

test("selects an available alternative when multiple provisions are recommended", async () => {
  const result = getCurioAdvice(await loadCurioKnowledge(), {
    name: "Lost Luggage",
    availableItems: ["Antivenom"],
  });

  assert.equal(result.status, "found");
  if (result.status !== "found") return;
  assert.equal(result.curio.id, "left_luggage");
  assert.equal(result.recommendedInteraction?.item, "antivenom");
  assert.deepEqual(
    result.usableInteractions.map((interaction) => interaction.item),
    ["antivenom", null],
  );
});

test("does not choose among ambiguous curio names", async () => {
  const knowledge = await loadCurioKnowledge();
  const ambiguous: CurioKnowledgeBase = {
    ...knowledge,
    curios: knowledge.curios.map((curio, index) => ({
      ...curio,
      aliases: index < 2 ? [...curio.aliases, "shared"] : curio.aliases,
    })),
  };

  const result = getCurioAdvice(ambiguous, { name: "shared" });
  assert.equal(result.status, "ambiguous");
  if (result.status !== "ambiguous") return;
  assert.equal(result.candidates.length, 2);
});

test("requires exactly one curio locator", async () => {
  const knowledge = await loadCurioKnowledge();

  assert.equal(getCurioAdvice(knowledge, {}).status, "invalid_request");
  assert.equal(
    getCurioAdvice(knowledge, {
      curioId: "holy_fountain",
      name: "Holy Fountain",
    }).status,
    "invalid_request",
  );
  assert.equal(
    getCurioAdvice(knowledge, { name: "missing" }).status,
    "not_found",
  );
});
