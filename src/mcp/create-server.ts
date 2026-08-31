import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import type { BuildingUpgradeTree } from "../domain/building-upgrades.js";
import type { CurioKnowledgeBase } from "../domain/curio-knowledge.js";
import type { QuirkDefinition } from "../domain/quirk-definitions.js";
import type { QuirkTreatmentKnowledgeBase } from "../domain/quirk-treatment-knowledge.js";
import { loadCurioKnowledge } from "../knowledge/load-curio-knowledge.js";
import { loadQuirkTreatmentKnowledge } from "../knowledge/load-quirk-treatment-knowledge.js";
import { analyzeRiskyQuirks } from "../queries/analyze-risky-quirks.js";
import { getCurioAdvice } from "../queries/get-curio-advice.js";
import { getGameStateSummary } from "../queries/get-game-state-summary.js";
import { getHeroTownContext } from "../queries/get-hero-town-context.js";
import { getHero } from "../queries/get-hero.js";
import { getQuest } from "../queries/get-quest.js";
import { listHeroes } from "../queries/list-heroes.js";
import { listQuests } from "../queries/list-quests.js";
import { searchCurios } from "../queries/search-curios.js";
import { getTrinket, listTrinkets } from "../queries/trinkets.js";
import { loadQuirkDefinitions } from "../quirks/load-quirk-definitions.js";
import {
  getBuildingUpgradeProgress,
  loadBuildingUpgradeTrees,
} from "../upgrades/building-upgrades.js";
import type { GameStateDataSource } from "./data-source.js";

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
} as const;

const curioRegionSchema = z.enum([
  "ruins",
  "warrens",
  "weald",
  "cove",
  "courtyard",
  "farmstead",
  "darkest_dungeon",
  "old_road",
  "hamlet",
]);

export interface DarkestDungeonServerOptions {
  loadCurioKnowledge?: () => Promise<CurioKnowledgeBase>;
  gameDirectory?: string;
  loadBuildingUpgradeTrees?: () => Promise<BuildingUpgradeTree[]>;
  loadQuirkDefinitions?: () => Promise<QuirkDefinition[]>;
  loadQuirkTreatmentKnowledge?: () => Promise<QuirkTreatmentKnowledgeBase>;
}

export const serverInstructions = [
  "This read-only server provides normalized Darkest Dungeon 1 save state and verified gameplay knowledge.",
  "Use save-state tools for facts about the current campaign instead of guessing.",
  "Use list_building_upgrades for verified building upgrade progress and next costs.",
  "Use list_risky_quirks for treatment-priority questions, and present its policy as editorial guidance rather than an absolute game value.",
  "For curio questions, call search_curios when the identity is uncertain, then call get_curio_advice.",
  "Treat only returned knowledge as verified; never invent curio effects, probabilities, item interactions, or localized names.",
  "The availableItems argument means expedition items explicitly supplied by the user; do not infer it from estate storage.",
  "Keep Darkest Dungeon 1 information separate from Darkest Dungeon 2.",
].join(" ");

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
  options: DarkestDungeonServerOptions = {},
): McpServer {
  const knowledgeLoader = options.loadCurioKnowledge ?? loadCurioKnowledge;
  let knowledgePromise: Promise<CurioKnowledgeBase> | undefined;
  const getKnowledge = () => {
    knowledgePromise ??= knowledgeLoader();
    return knowledgePromise;
  };
  const upgradeTreeLoader =
    options.loadBuildingUpgradeTrees ??
    (() => {
      const gameDirectory = options.gameDirectory?.trim();
      if (gameDirectory === undefined || gameDirectory === "") {
        throw new Error(
          "Building upgrade definitions require DD_GAME_DIR to point to the Darkest Dungeon installation.",
        );
      }
      return loadBuildingUpgradeTrees(gameDirectory);
    });
  let upgradeTreesPromise: Promise<BuildingUpgradeTree[]> | undefined;
  const getUpgradeTrees = () => {
    upgradeTreesPromise ??= Promise.resolve().then(upgradeTreeLoader);
    return upgradeTreesPromise;
  };
  const quirkDefinitionLoader =
    options.loadQuirkDefinitions ??
    (() => {
      const gameDirectory = options.gameDirectory?.trim();
      if (gameDirectory === undefined || gameDirectory === "") {
        throw new Error(
          "Quirk definitions require DD_GAME_DIR to point to the Darkest Dungeon installation.",
        );
      }
      return loadQuirkDefinitions(gameDirectory);
    });
  let quirkDefinitionsPromise: Promise<QuirkDefinition[]> | undefined;
  const getQuirkDefinitions = () => {
    quirkDefinitionsPromise ??= Promise.resolve().then(quirkDefinitionLoader);
    return quirkDefinitionsPromise;
  };
  const treatmentKnowledgeLoader =
    options.loadQuirkTreatmentKnowledge ?? loadQuirkTreatmentKnowledge;
  let treatmentKnowledgePromise:
    | Promise<QuirkTreatmentKnowledgeBase>
    | undefined;
  const getTreatmentKnowledge = () => {
    treatmentKnowledgePromise ??= treatmentKnowledgeLoader();
    return treatmentKnowledgePromise;
  };
  const server = new McpServer(
    { name: "darkest-dungeon-mcp", version: "1.0.0" },
    {
      capabilities: { tools: {} },
      instructions: serverInstructions,
    },
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
    "list_building_upgrades",
    {
      title: "List building upgrade progress",
      description:
        "List purchased building upgrades and the next verified heirloom cost, optionally filtered by building id.",
      inputSchema: z.object({
        buildingId: z.string().min(1).optional(),
      }),
      outputSchema: z.object({ upgrades: z.array(z.unknown()) }),
      annotations: readOnlyAnnotations,
    },
    async ({ buildingId }) => {
      const [state, trees] = await Promise.all([
        dataSource.load(),
        getUpgradeTrees(),
      ]);
      const upgrades = getBuildingUpgradeProgress(state.upgrades, trees).filter(
        (upgrade) =>
          buildingId === undefined || upgrade.buildingId === buildingId,
      );
      return toolResult("upgrades", upgrades);
    },
  );

  server.registerTool(
    "list_risky_quirks",
    {
      title: "List risky quirks",
      description:
        "Rank heroes with treatment-worthy quirks using verified game definitions and an explicit editorial priority policy.",
      inputSchema: z.object({
        minimumPriority: z
          .enum(["critical", "high", "medium", "low"])
          .default("high"),
        lockedOnly: z.boolean().default(false),
        heroId: z.string().min(1).optional(),
        limit: z.number().int().min(1).max(50).default(10),
      }),
      outputSchema: z.object({
        policy: z.unknown(),
        heroes: z.array(z.unknown()),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ minimumPriority, lockedOnly, heroId, limit }) => {
      const [state, definitions, knowledge] = await Promise.all([
        dataSource.load(),
        getQuirkDefinitions(),
        getTreatmentKnowledge(),
      ]);
      const filters = {
        minimumPriority,
        lockedOnly,
        ...(heroId === undefined ? {} : { heroId }),
        limit,
      };
      const structuredContent = {
        policy: knowledge.policy,
        heroes: analyzeRiskyQuirks(
          state.roster,
          definitions,
          knowledge,
          filters,
        ),
      };
      return {
        content: [
          { type: "text", text: JSON.stringify(structuredContent) },
        ],
        structuredContent,
      };
    },
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

  server.registerTool(
    "search_curios",
    {
      title: "Search curio knowledge",
      description:
        "Search verified Darkest Dungeon 1 curio knowledge by id, localized name, alias, or region.",
      inputSchema: z.object({
        query: z.string().min(1).optional(),
        region: curioRegionSchema.optional(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
      outputSchema: z.object({ curios: z.array(z.unknown()) }),
      annotations: readOnlyAnnotations,
    },
    async ({ query, region, limit }) => {
      const filters = {
        ...(query === undefined ? {} : { query }),
        ...(region === undefined ? {} : { region }),
        limit,
      };
      return toolResult(
        "curios",
        searchCurios(await getKnowledge(), filters),
      );
    },
  );

  server.registerTool(
    "get_curio_advice",
    {
      title: "Get curio interaction advice",
      description:
        "Return verified curio interactions, prioritizing recommendations enabled by the supplied inventory items.",
      inputSchema: z
        .object({
          curioId: z.string().min(1).optional(),
          name: z.string().min(1).optional(),
          availableItems: z.array(z.string().min(1)).max(64).optional(),
        })
        .refine(
          ({ curioId, name }) =>
            Number(curioId !== undefined) + Number(name !== undefined) === 1,
          { message: "Provide exactly one of curioId or name." },
        ),
      outputSchema: z.object({ advice: z.unknown() }),
      annotations: readOnlyAnnotations,
    },
    async ({ curioId, name, availableItems }) => {
      const request = {
        ...(curioId === undefined ? {} : { curioId }),
        ...(name === undefined ? {} : { name }),
        ...(availableItems === undefined ? {} : { availableItems }),
      };
      const advice = getCurioAdvice(await getKnowledge(), request);
      if (advice.status === "not_found") {
        return notFoundResult("Curio", advice.query);
      }
      if (advice.status === "invalid_request") {
        return {
          isError: true,
          content: [{ type: "text", text: advice.message }],
        };
      }
      return toolResult("advice", advice);
    },
  );

  return server;
}
