import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { getGameStateSummary } from "../queries/get-game-state-summary.js";
import { getHeroTownContext } from "../queries/get-hero-town-context.js";
import { getHero } from "../queries/get-hero.js";
import { getQuest } from "../queries/get-quest.js";
import { listHeroes } from "../queries/list-heroes.js";
import { listQuests } from "../queries/list-quests.js";
import { getTrinket, listTrinkets } from "../queries/trinkets.js";
import type { GameStateDataSource } from "./data-source.js";

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
} as const;

function toolResult(key: string, value: unknown) {
  const structuredContent = { [key]: value };
  return {
    content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }],
    structuredContent,
  };
}

function notFoundResult(subject: string, id: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: `${subject} not found: ${id}` }],
  };
}

export function createDarkestDungeonServer(
  dataSource: GameStateDataSource,
): McpServer {
  const server = new McpServer(
    { name: "darkest-dungeon-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  server.registerTool(
    "get_game_state",
    {
      title: "Get game state summary",
      description:
        "Return a read-only summary of the roster, estate, town, and available quests.",
      inputSchema: z.object({
        stressThreshold: z.number().finite().nonnegative().optional(),
      }),
      outputSchema: z.object({ gameState: z.unknown() }),
      annotations: readOnlyAnnotations,
    },
    async ({ stressThreshold }) =>
      toolResult(
        "gameState",
        getGameStateSummary(await dataSource.load(), stressThreshold),
      ),
  );

  server.registerTool(
    "list_heroes",
    {
      title: "List heroes",
      description: "List normalized hero summaries with optional filters.",
      inputSchema: z.object({
        heroClass: z.string().min(1).optional(),
        rosterStatus: z.number().int().optional(),
        maxStress: z.number().finite().nonnegative().optional(),
      }),
      outputSchema: z.object({ heroes: z.array(z.unknown()) }),
      annotations: readOnlyAnnotations,
    },
    async ({ heroClass, rosterStatus, maxStress }) => {
      const state = await dataSource.load();
      const filters = {
        ...(heroClass === undefined ? {} : { heroClass }),
        ...(rosterStatus === undefined ? {} : { rosterStatus }),
        ...(maxStress === undefined ? {} : { maxStress }),
      };
      return toolResult("heroes", listHeroes(state.roster, filters));
    },
  );

  server.registerTool(
    "get_hero",
    {
      title: "Get hero details",
      description:
        "Return one normalized hero and their current town activity context.",
      inputSchema: z.object({ heroId: z.string().min(1) }),
      outputSchema: z.object({
        hero: z.unknown(),
        townContext: z.unknown(),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ heroId }) => {
      const state = await dataSource.load();
      const hero = getHero(state.roster, heroId);
      if (hero === undefined) {
        return notFoundResult("Hero", heroId);
      }

      const townContext = getHeroTownContext(
        state.roster,
        state.town,
        heroId,
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              hero,
              townContext,
            }),
          },
        ],
        structuredContent: {
          hero,
          townContext,
        },
      };
    },
  );

  server.registerTool(
    "list_quests",
    {
      title: "List quests",
      description: "List normalized quest summaries with optional filters.",
      inputSchema: z.object({
        dungeon: z.string().min(1).optional(),
        type: z.string().min(1).optional(),
        difficulty: z.number().int().nonnegative().optional(),
        isPlotQuest: z.boolean().optional(),
      }),
      outputSchema: z.object({ quests: z.array(z.unknown()) }),
      annotations: readOnlyAnnotations,
    },
    async ({ dungeon, type, difficulty, isPlotQuest }) => {
      const state = await dataSource.load();
      const filters = {
        ...(dungeon === undefined ? {} : { dungeon }),
        ...(type === undefined ? {} : { type }),
        ...(difficulty === undefined ? {} : { difficulty }),
        ...(isPlotQuest === undefined ? {} : { isPlotQuest }),
      };
      return toolResult("quests", listQuests(state.quests, filters));
    },
  );

  server.registerTool(
    "get_quest",
    {
      title: "Get quest details",
      description: "Return one normalized quest by its quest id.",
      inputSchema: z.object({ questId: z.string().min(1) }),
      outputSchema: z.object({ quest: z.unknown() }),
      annotations: readOnlyAnnotations,
    },
    async ({ questId }) => {
      const quest = getQuest((await dataSource.load()).quests, questId);
      return quest === undefined
        ? notFoundResult("Quest", questId)
        : toolResult("quest", quest);
    },
  );

  server.registerTool(
    "list_trinkets",
    {
      title: "List trinkets",
      description:
        "List trinkets across estate storage, equipped heroes, and town stores.",
      inputSchema: z.object({
        id: z.string().min(1).optional(),
        location: z.enum(["storage", "equipped", "store"]).optional(),
      }),
      outputSchema: z.object({ trinkets: z.array(z.unknown()) }),
      annotations: readOnlyAnnotations,
    },
    async ({ id, location }) => {
      const state = await dataSource.load();
      const filters = {
        ...(id === undefined ? {} : { id }),
        ...(location === undefined ? {} : { location }),
      };
      return toolResult("trinkets", listTrinkets(state, filters));
    },
  );

  server.registerTool(
    "get_trinket",
    {
      title: "Get trinket details",
      description:
        "Return one trinket with its storage, equipped, and store locations.",
      inputSchema: z.object({ trinketId: z.string().min(1) }),
      outputSchema: z.object({ trinket: z.unknown() }),
      annotations: readOnlyAnnotations,
    },
    async ({ trinketId }) => {
      const trinket = getTrinket(await dataSource.load(), trinketId);
      return trinket === undefined
        ? notFoundResult("Trinket", trinketId)
        : toolResult("trinket", trinket);
    },
  );

  return server;
}
