import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import { Client, InMemoryTransport } from "@modelcontextprotocol/client";

import { createDarkestDungeonServer } from "../src/mcp/create-server.js";
import { SampleGameStateDataSource } from "../src/mcp/data-source.js";

test("get_hero works with installed Color of Madness trinket definitions", async (t) => {
  const gameDirectory =
    process.env.DD_GAME_DIR ??
    "D:\\SteamLibrary\\steamapps\\common\\DarkestDungeon";
  if (!existsSync(gameDirectory)) return;

  const dataSource = new SampleGameStateDataSource();
  const state = await dataSource.load();
  const hero = state.roster.heroes[0];
  assert.ok(hero);

  const server = createDarkestDungeonServer(dataSource, { gameDirectory });
  const client = new Client({ name: "game-data-test", version: "1.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  t.after(async () => {
    await client.close();
    await server.close();
  });

  const result = await client.callTool({
    name: "get_hero",
    arguments: { heroId: hero.id, language: "ko" },
  });

  assert.equal(
    result.isError,
    undefined,
    result.content
      .flatMap((content) => (content.type === "text" ? [content.text] : []))
      .join("\n"),
  );
  const structuredContent = result.structuredContent as
    | { hero?: { id?: unknown } }
    | undefined;
  assert.equal(structuredContent?.hero?.id, hero.id);
});
