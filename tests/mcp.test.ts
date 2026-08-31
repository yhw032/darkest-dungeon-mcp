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
  assert.ok(expectedHero);

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
    ["get_game_state", "get_hero", "list_heroes"],
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
});
