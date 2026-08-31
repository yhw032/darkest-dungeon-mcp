import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { getGameStateSummary } from "../queries/get-game-state-summary.js";
import { getHeroTownContext } from "../queries/get-hero-town-context.js";
import { getHero } from "../queries/get-hero.js";
import { listHeroes } from "../queries/list-heroes.js";
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
        return {
          isError: true,
          content: [{ type: "text", text: `Hero not found: ${heroId}` }],
        };
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

  return server;
}
