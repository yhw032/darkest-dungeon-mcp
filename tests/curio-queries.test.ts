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
  assert.equal(searchCurios(knowledge, { query: "Giant Fish Carcass" })[0]?.id, "fish_carcass");
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
    ["ancient_artifact"],
  );
  assert.deepEqual(
    searchCurios(knowledge, { query: "eldritch_altar" })[0]?.availability,
    { type: "standard" },
  );
});

test("matches normalized Korean names with localization", () => {
  const knowledge: CurioKnowledgeBase = {
    schemaVersion: 2,
    curios: [
      {
        id: "test_curio",
        localizationId: "test_curio",
        aliases: [],
        regions: ["ruins"],
        dlcs: [],
        availability: { type: "standard" },
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

  const mockLocalization = new Map([
    ["koreana", new Map([["str_curio_title_test_curio", "시험용 골동품"]])],
  ]);

  const results = searchCurios(
    knowledge,
    { query: "  시험용  ", language: "ko" },
    mockLocalization,
  );
  assert.equal(results[0]?.id, "test_curio");
  assert.equal(results[0]?.name, "시험용 골동품");
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

test("accepts official provision names from any supported localization", async () => {
  const localization = new Map([
    [
      "koreana",
      new Map([["str_inventory_title_supplyholy_water", "성수"]]),
    ],
    [
      "french",
      new Map([["str_inventory_title_supplyholy_water", "Eau bénite"]]),
    ],
  ]);
  const result = getCurioAdvice(
    await loadCurioKnowledge(),
    {
      curioId: "eldritch_altar",
      availableItems: ["성수"],
      language: "ko",
    },
    localization,
  );

  assert.equal(result.status, "found");
  if (result.status !== "found") return;
  assert.equal(result.recommendedInteraction?.item, "holy_water");

  const frenchResult = getCurioAdvice(
    await loadCurioKnowledge(),
    {
      curioId: "eldritch_altar",
      availableItems: ["Eau bénite"],
      language: "fr",
    },
    localization,
  );

  assert.equal(frenchResult.status, "found");
  if (frenchResult.status !== "found") return;
  assert.equal(frenchResult.recommendedInteraction?.item, "holy_water");
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

test("recommends a non-loot curio interaction when its item is available", async () => {
  const result = getCurioAdvice(await loadCurioKnowledge(), {
    name: "Giant Oyster",
    availableItems: ["Dog Treats"],
  });

  assert.equal(result.status, "found");
  if (result.status !== "found") return;
  assert.equal(result.recommendedInteraction?.item, "dog_treats");
  assert.equal(
    result.recommendedInteraction.outcomes[0]?.description,
    "Grants +25 dodge until camp.",
  );
});

test("does not guess between visually identical heirloom chest variants", async () => {
  const result = getCurioAdvice(await loadCurioKnowledge(), {
    name: "Heirloom Chest",
    availableItems: ["Skeleton Key"],
  });

  assert.equal(result.status, "ambiguous");
  if (result.status !== "ambiguous") return;
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.id),
    ["heirloom_chest_1", "heirloom_chest_2"],
  );
});

test("does not guess between the two throbbing cocoon variants", async () => {
  const result = getCurioAdvice(await loadCurioKnowledge(), {
    name: "Throbbing Cocoons",
    availableItems: ["Torch"],
  });

  assert.equal(result.status, "ambiguous");
  if (result.status !== "ambiguous") return;
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.id),
    ["throbbing_cocoons_courtyard", "throbbing_cocoons_infestation"],
  );
});

test("avoids using a key when it replaces a guaranteed set trinket", async () => {
  const result = getCurioAdvice(await loadCurioKnowledge(), {
    name: "Trinket Chest",
    availableItems: ["Skeleton Key"],
  });

  assert.equal(result.status, "found");
  if (result.status !== "found") return;
  assert.equal(result.recommendedInteraction?.item, null);
  assert.deepEqual(
    result.usableInteractions.map((interaction) => interaction.item),
    ["skeleton_key", null],
  );
  assert.match(result.warnings[0] ?? "", /key replaces/);
});

test("recommends a shovel to obtain firewood from a wine crate", async () => {
  const result = getCurioAdvice(await loadCurioKnowledge(), {
    name: "Wine Crate",
    availableItems: ["Shovel"],
  });

  assert.equal(result.status, "found");
  if (result.status !== "found") return;
  assert.equal(result.recommendedInteraction?.item, "shovel");
  assert.match(result.recommendedInteraction.note ?? "", /Firewood/);
});

test("recommends a skeleton key for a Farmstead stockpile", async () => {
  const result = getCurioAdvice(await loadCurioKnowledge(), {
    name: "Stockpile",
    availableItems: ["Skeleton Key"],
  });

  assert.equal(result.status, "found");
  if (result.status !== "found") return;
  assert.equal(result.recommendedInteraction?.item, "skeleton_key");
  assert.deepEqual(
    result.usableInteractions.map((interaction) => interaction.item),
    ["skeleton_key", null],
  );
  assert.match(
    result.recommendedInteraction.outcomes[0]?.description ?? "",
    /trinket/,
  );
});

test("finds all verified Farmstead curios by region", async () => {
  const results = searchCurios(await loadCurioKnowledge(), {
    region: "farmstead",
  });

  assert.equal(results.length, 8);
  assert.ok(results.every((curio) => curio.dlcs.includes("color_of_madness")));
});

test("recommends a key for the Old Road trapped chest", async () => {
  const result = getCurioAdvice(await loadCurioKnowledge(), {
    name: "Trapped Strongbox",
    availableItems: ["Skeleton Key"],
  });

  assert.equal(result.status, "found");
  if (result.status !== "found") return;
  assert.equal(result.curio.id, "bandits_trapped_chest");
  assert.equal(result.recommendedInteraction?.item, "skeleton_key");
  assert.deepEqual(result.curio.availability, {
    type: "quest",
    questIds: ["old_road"],
  });
});

test("requires a Hand of Glory to activate an Iron Crown", async () => {
  const result = getCurioAdvice(await loadCurioKnowledge(), {
    name: "Iron Crown",
    availableItems: ["Hand of Glory"],
  });

  assert.equal(result.status, "found");
  if (result.status !== "found") return;
  assert.equal(result.recommendedInteraction?.item, "hand_of_glory");
  assert.match(
    result.recommendedInteraction.outcomes[0]?.description ?? "",
    /one of three/,
  );
});

test("exposes quest availability in special-curio search results", async () => {
  const results = searchCurios(await loadCurioKnowledge(), {
    region: "darkest_dungeon",
  });

  assert.equal(results.length, 3);
  assert.ok(results.every((curio) => curio.availability.type === "quest"));
});

test("recommends a skeleton key for the secret-room ancient artifact", async () => {
  const result = getCurioAdvice(await loadCurioKnowledge(), {
    name: "Secret Room Chest",
    availableItems: ["Skeleton Key"],
  });

  assert.equal(result.status, "found");
  if (result.status !== "found") return;
  assert.equal(result.curio.id, "ancient_artifact");
  assert.equal(result.recommendedInteraction?.item, "skeleton_key");
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

test("returns single localized name in searchCurios and getCurioAdvice", async () => {
  const knowledge = await loadCurioKnowledge();
  const localization = new Map([
    [
      "english",
      new Map([
        ["str_curio_title_eldritch_altar", "Eldritch Altar"],
      ]),
    ],
    [
      "koreana",
      new Map([
        ["str_curio_title_eldritch_altar", "괴이한 제단"],
      ]),
    ],
  ]);

  const searchResults = searchCurios(
    knowledge,
    { query: "괴이한 제단", language: "ko" },
    localization,
  );
  assert.equal(searchResults.length, 1);
  assert.equal(searchResults[0]?.id, "eldritch_altar");
  assert.equal(searchResults[0]?.name, "괴이한 제단");

  const adviceResult = getCurioAdvice(
    knowledge,
    { curioId: "eldritch_altar", language: "ko" },
    localization,
  );
  assert.equal(adviceResult.status, "found");
  if (adviceResult.status === "found") {
    assert.equal(adviceResult.curio.name, "괴이한 제단");
  }
});

test("validates curio en and ko localization coverage against installed game", async (t) => {
  const { existsSync } = await import("node:fs");
  const gameDir =
    process.env.DD_GAME_DIR ??
    "D:\\SteamLibrary\\steamapps\\common\\DarkestDungeon";

  if (!existsSync(gameDir)) {
    t.skip("Darkest Dungeon game directory is not available");
    return;
  }

  const { loadGameLocalization } = await import(
    "../src/localization/game-localization.js"
  );
  const localization = await loadGameLocalization(gameDir);
  const knowledge = await loadCurioKnowledge();

  const expectedNullTitles = new Set([
    "crate",
    "discarded_pack",
    "sack",
    "sconce",
    "ancestors_knapsack",
  ]);

  let matchedWithEnAndKo = 0;
  let explicitNullCount = 0;
  const missingCurios: string[] = [];

  for (const curio of knowledge.curios) {
    const enResults = searchCurios(
      knowledge,
      { query: curio.id, language: "en" },
      localization,
    );
    const koResults = searchCurios(
      knowledge,
      { query: curio.id, language: "ko" },
      localization,
    );

    const enName = enResults.find((c) => c.id === curio.id)?.name ?? null;
    const koName = koResults.find((c) => c.id === curio.id)?.name ?? null;

    if (expectedNullTitles.has(curio.id)) {
      assert.equal(
        enName,
        null,
        `Expected null en name for instant curio ${curio.id}`,
      );
      assert.equal(
        koName,
        null,
        `Expected null ko name for instant curio ${curio.id}`,
      );
      explicitNullCount++;
    } else {
      if (typeof enName !== "string" || typeof koName !== "string") {
        missingCurios.push(
          `${curio.id} (en: ${String(enName)}, ko: ${String(koName)})`,
        );
      } else {
        matchedWithEnAndKo++;
      }
    }
  }

  assert.deepEqual(
    missingCurios,
    [],
    `Curios missing en or ko names: ${missingCurios.join(", ")}`,
  );
  assert.equal(explicitNullCount, 5);
  assert.equal(matchedWithEnAndKo, 72);
  assert.equal(knowledge.curios.length, 77);
});
