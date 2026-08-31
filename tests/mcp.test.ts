import assert from "node:assert/strict";
import test from "node:test";

import { Client, InMemoryTransport } from "@modelcontextprotocol/client";

import { createDarkestDungeonServer } from "../src/mcp/create-server.js";
import {
  createConfiguredDataSource,
  LiveGameStateDataSource,
  SampleGameStateDataSource,
} from "../src/mcp/data-source.js";

test("configured data source defaults to samples and selects live saves by environment", () => {
  assert.ok(createConfiguredDataSource({}) instanceof SampleGameStateDataSource);
  assert.ok(
    createConfiguredDataSource({ DD_SAVE_DIR: "C:\\saves\\profile_0" }) instanceof
      LiveGameStateDataSource,
  );
});

test("sample data source loads the checked-in game state", async () => {
  const state = await new SampleGameStateDataSource().load();

  assert.ok(state.roster.heroes.length > 0);
  assert.ok(state.estate.resources.length > 0);
  assert.ok(state.town.buildings.length > 0);
  assert.ok(state.quests.quests.length > 0);
  assert.ok(state.upgrades.purchases.length > 0);
});

test("MCP server advertises and executes read-only game tools", async (t) => {
  const dataSource = new SampleGameStateDataSource();
  const state = await dataSource.load();
  const expectedHero = state.roster.heroes[0];
  const expectedQuest = state.quests.quests[0];
  const expectedStoredTrinket = state.estate.trinkets[0];
  const riskyHero = state.roster.heroes.find((hero) => hero.quirks.length > 0);
  const riskyQuirk = riskyHero?.quirks[0];
  assert.ok(expectedHero);
  assert.ok(expectedQuest);
  assert.ok(expectedStoredTrinket);
  assert.ok(riskyHero);
  assert.ok(riskyQuirk);

  const server = createDarkestDungeonServer(dataSource, {
    loadBuildingUpgradeTrees: async () => [
      {
        id: "guild.skill_levels",
        hash: -166715556,
        buildingId: "guild",
        requirements: [
          { code: "a", currencyCost: [{ type: "portrait", amount: 6 }] },
          { code: "b", currencyCost: [{ type: "portrait", amount: 15 }] },
          { code: "c", currencyCost: [{ type: "portrait", amount: 24 }] },
          { code: "d", currencyCost: [{ type: "portrait", amount: 33 }] },
        ],
      },
    ],
    loadQuirkDefinitions: async () => [
      {
        id: riskyQuirk.id,
        isPositive: false,
        isDisease: false,
        classification: "mental",
        incompatibleQuirks: [],
        curioTag: "All",
        curioTagChance: 0.2,
        keepsLoot: false,
        canModifyInActivity: true,
        canBeReplacedByNewQuirk: true,
        effects: [],
        unresolvedBuffIds: [],
        localization: {
          english: { name: "Risky test quirk", description: "Test risk" },
          korean: { name: "위험 테스트 기벽", description: "테스트 위험" },
        },
      },
    ],
    loadQuirkTreatmentKnowledge: async () => ({
      schemaVersion: 1,
      policy: {
        title: "Test treatment policy",
        disclaimer: "Editorial guidance for MCP integration tests.",
      },
      rules: [
        {
          quirkId: riskyQuirk.id,
          priority: "high",
          factors: ["forced_curio_interaction"],
          reasons: ["May force a curio interaction."],
          notes: [],
          sources: [{ title: "Fixture", reference: "test" }],
        },
      ],
    }),
  });
  const client = new Client({ name: "mcp-test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);
  t.after(async () => {
    await client.close();
    await server.close();
  });

  const instructions = client.getInstructions();
  assert.match(instructions ?? "", /Darkest Dungeon 1/);
  assert.match(instructions ?? "", /search_curios/);
  assert.match(instructions ?? "", /get_curio_advice/);
  assert.match(instructions ?? "", /never invent curio effects/);
  assert.match(instructions ?? "", /do not infer it from estate storage/);
  assert.match(instructions ?? "", /list_risky_quirks/);
  assert.match(instructions ?? "", /editorial guidance/);

  const { tools } = await client.listTools();
  assert.deepEqual(
    tools.map((tool) => tool.name).sort(),
    [
      "get_curio_advice",
      "get_game_state",
      "get_hero",
      "get_quest",
      "get_trinket",
      "list_building_upgrades",
      "list_heroes",
      "list_quests",
      "list_risky_quirks",
      "list_trinkets",
      "search_curios",
    ],
  );
  assert.ok(tools.every((tool) => tool.annotations?.readOnlyHint === true));

  const summaryResult = await client.callTool({
    name: "get_game_state",
    arguments: { stressThreshold: 50 },
  });
  assert.equal(summaryResult.isError, undefined);
  const summaryContent = summaryResult.structuredContent as
    | Record<string, unknown>
    | undefined;
  assert.ok(summaryContent?.gameState);

  const upgradeResult = await client.callTool({
    name: "list_building_upgrades",
    arguments: { buildingId: "guild" },
  });
  const upgradeContent = upgradeResult.structuredContent as
    | Record<string, unknown>
    | undefined;
  const upgrades = upgradeContent?.upgrades;
  assert.ok(Array.isArray(upgrades));
  assert.equal(upgrades.length, 1);
  assert.deepEqual(upgrades[0], {
    treeId: "guild.skill_levels",
    buildingId: "guild",
    purchasedCodes: ["a", "b", "c"],
    purchasedCount: 3,
    totalCount: 4,
    highestPurchasedCode: "c",
    nextRequirement: {
      code: "d",
      currencyCost: [{ type: "portrait", amount: 33 }],
    },
    isComplete: false,
  });

  const riskyResult = await client.callTool({
    name: "list_risky_quirks",
    arguments: { heroId: riskyHero.id },
  });
  const riskyContent = riskyResult.structuredContent as
    | Record<string, unknown>
    | undefined;
  assert.deepEqual(riskyContent?.policy, {
    title: "Test treatment policy",
    disclaimer: "Editorial guidance for MCP integration tests.",
  });
  const riskyHeroes = riskyContent?.heroes;
  assert.ok(Array.isArray(riskyHeroes));
  assert.equal(riskyHeroes.length, 1);
  assert.equal(
    (riskyHeroes[0] as { heroId?: unknown } | undefined)?.heroId,
    riskyHero.id,
  );

  const listResult = await client.callTool({
    name: "list_heroes",
    arguments: { heroClass: expectedHero.heroClass },
  });
  const listContent = listResult.structuredContent as
    | Record<string, unknown>
    | undefined;
  const heroes = listContent?.heroes;
  assert.ok(Array.isArray(heroes));
  assert.ok(
    heroes.every(
      (hero) =>
        typeof hero === "object" &&
        hero !== null &&
        "heroClass" in hero &&
        hero.heroClass === expectedHero.heroClass,
    ),
  );

  const heroResult = await client.callTool({
    name: "get_hero",
    arguments: { heroId: expectedHero.id },
  });
  const heroContent = heroResult.structuredContent as
    | Record<string, unknown>
    | undefined;
  assert.deepEqual(heroContent?.hero, expectedHero);

  const missingResult = await client.callTool({
    name: "get_hero",
    arguments: { heroId: "missing-hero" },
  });
  assert.equal(missingResult.isError, true);

  const questListResult = await client.callTool({
    name: "list_quests",
    arguments: { dungeon: expectedQuest.dungeon },
  });
  const questListContent = questListResult.structuredContent as
    | Record<string, unknown>
    | undefined;
  const quests = questListContent?.quests;
  assert.ok(Array.isArray(quests));
  assert.ok(
    quests.every(
      (quest) =>
        typeof quest === "object" &&
        quest !== null &&
        "dungeon" in quest &&
        quest.dungeon === expectedQuest.dungeon,
    ),
  );

  const questResult = await client.callTool({
    name: "get_quest",
    arguments: { questId: expectedQuest.id },
  });
  const questContent = questResult.structuredContent as
    | Record<string, unknown>
    | undefined;
  assert.deepEqual(questContent?.quest, expectedQuest);
  assert.equal(
    (
      await client.callTool({
        name: "get_quest",
        arguments: { questId: "missing-quest" },
      })
    ).isError,
    true,
  );

  const trinketListResult = await client.callTool({
    name: "list_trinkets",
    arguments: { location: "storage" },
  });
  const trinketListContent = trinketListResult.structuredContent as
    | Record<string, unknown>
    | undefined;
  const trinkets = trinketListContent?.trinkets;
  assert.ok(Array.isArray(trinkets));
  assert.ok(
    trinkets.every(
      (trinket) =>
        typeof trinket === "object" &&
        trinket !== null &&
        "storageAmount" in trinket &&
        typeof trinket.storageAmount === "number" &&
        trinket.storageAmount > 0,
    ),
  );

  const trinketResult = await client.callTool({
    name: "get_trinket",
    arguments: { trinketId: expectedStoredTrinket.id },
  });
  const trinketContent = trinketResult.structuredContent as
    | Record<string, unknown>
    | undefined;
  assert.equal(
    (trinketContent?.trinket as { id?: unknown } | undefined)?.id,
    expectedStoredTrinket.id,
  );
  assert.equal(
    (
      await client.callTool({
        name: "get_trinket",
        arguments: { trinketId: "missing-trinket" },
      })
    ).isError,
    true,
  );

  const curioSearchResult = await client.callTool({
    name: "search_curios",
    arguments: { query: "Shambler Altar", region: "ruins" },
  });
  const curioSearchContent = curioSearchResult.structuredContent as
    | Record<string, unknown>
    | undefined;
  const curios = curioSearchContent?.curios;
  assert.ok(Array.isArray(curios));
  assert.equal(
    (curios[0] as { id?: unknown } | undefined)?.id,
    "shamblers_altar",
  );

  const curioAdviceResult = await client.callTool({
    name: "get_curio_advice",
    arguments: {
      name: "Eldritch Altar",
      availableItems: ["Holy Water"],
    },
  });
  const curioAdviceContent = curioAdviceResult.structuredContent as
    | Record<string, unknown>
    | undefined;
  const advice = curioAdviceContent?.advice as
    | { status?: unknown; recommendedInteraction?: { item?: unknown } }
    | undefined;
  assert.equal(advice?.status, "found");
  assert.equal(advice?.recommendedInteraction?.item, "holy_water");

  const missingCurioResult = await client.callTool({
    name: "get_curio_advice",
    arguments: { name: "missing curio" },
  });
  assert.equal(missingCurioResult.isError, true);
});
