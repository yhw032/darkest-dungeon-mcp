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
});

test("MCP server advertises and executes read-only game tools", async (t) => {
  const dataSource = new SampleGameStateDataSource();
  const state = await dataSource.load();
  const expectedHero = state.roster.heroes[0];
  const expectedQuest = state.quests.quests[0];
  const expectedStoredTrinket = state.estate.trinkets[0];
  assert.ok(expectedHero);
  assert.ok(expectedQuest);
  assert.ok(expectedStoredTrinket);

  const server = createDarkestDungeonServer(dataSource);
  const client = new Client({ name: "mcp-test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);
  t.after(async () => {
    await client.close();
    await server.close();
  });

  const { tools } = await client.listTools();
  assert.deepEqual(
    tools.map((tool) => tool.name).sort(),
    [
      "get_game_state",
      "get_hero",
      "get_quest",
      "get_trinket",
      "list_heroes",
      "list_quests",
      "list_trinkets",
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
});
