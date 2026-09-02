import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  buildingUpgradeProgressSchema,
  classKnowledgeSchema,
  combatRegionSchema,
  combatThreatSchema,
  curioAdviceSchema,
  curioRegionSchema,
  curioSummarySchema,
  gameStateSummarySchema,
  heroComparisonSchema,
  heroDetailSchema,
  heroSummarySchema,
  heroTownContextSchema,
  enemyCombatKnowledgeSchema,
  enemyPrioritySchema,
  questSchema,
  questSummarySchema,
  riskyHeroSchema,
  regionCombatKnowledgeSchema,
  trinketRecordSchema,
} from "./output-schemas.js";

import type { BuildingUpgradeTree } from "../domain/building-upgrades.js";
import type { ClassKnowledgeBase } from "../domain/class-knowledge.js";
import type { CombatKnowledgeBase } from "../domain/combat-knowledge.js";
import type { CurioKnowledgeBase } from "../domain/curio-knowledge.js";
import type {
  HeroCombatSkillPositionDefinition,
  HeroCombatSkillTree,
} from "../domain/hero-skills.js";
import type { HeroProgressionRules } from "../domain/hero-progression.js";
import type { QuirkDefinition } from "../domain/quirk-definitions.js";
import type { QuirkTreatmentKnowledgeBase } from "../domain/quirk-treatment-knowledge.js";
import type { QuestRestrictionRules } from "../domain/quest-restrictions.js";
import { loadCurioKnowledge } from "../knowledge/load-curio-knowledge.js";
import { loadClassKnowledge } from "../knowledge/load-class-knowledge.js";
import { loadCombatKnowledge } from "../knowledge/load-combat-knowledge.js";
import {
  loadGameLocalization,
  localizeCombatSkill,
  localizeHeroClass,
  type GameLocalization,
} from "../localization/game-localization.js";
import { loadQuirkTreatmentKnowledge } from "../knowledge/load-quirk-treatment-knowledge.js";
import { analyzeRiskyQuirks } from "../queries/analyze-risky-quirks.js";
import { getCurioAdvice } from "../queries/get-curio-advice.js";
import { getGameStateSummary } from "../queries/get-game-state-summary.js";
import { getHeroTownContext } from "../queries/get-hero-town-context.js";
import {
  getHeroAvailability,
  getResolveLevel,
  loadHeroProgressionRules,
} from "../progression/hero-progression.js";
import { getHero } from "../queries/get-hero.js";
import { getHeroComparisonHighlights } from "../queries/compare-heroes.js";
import { loadHeroCombatSkillPositions } from "../skills/combat-skill-positions.js";
import { analyzeHeroCombatPositions } from "../skills/analyze-combat-positions.js";
import { getQuest } from "../queries/get-quest.js";
import { listHeroes } from "../queries/list-heroes.js";
import {
  getQuestEligibility,
  loadQuestRestrictionRules,
} from "../quests/quest-eligibility.js";
import {
  localizeQuest,
  localizeQuestSummary,
  type QuestLocalization,
} from "../quests/localize-quest.js";
import { listQuests } from "../queries/list-quests.js";
import { queryClasses } from "../queries/query-classes.js";
import { queryCombatKnowledge } from "../queries/query-combat.js";
import { searchCurios } from "../queries/search-curios.js";
import { listTrinkets } from "../queries/trinkets.js";
import { loadQuirkDefinitions } from "../quirks/load-quirk-definitions.js";
import { getHeroRosterState } from "../roster/hero-roster-state.js";
import {
  getBuildingUpgradeProgress,
  loadBuildingUpgradeTrees,
} from "../upgrades/building-upgrades.js";
import {
  getHeroCombatSkillDetails,
  loadHeroCombatSkillTrees,
} from "../upgrades/hero-skills.js";
import type { GameStateDataSource } from "./data-source.js";

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
} as const;

export interface DarkestDungeonServerOptions {
  loadClassKnowledge?: () => Promise<ClassKnowledgeBase>;
  loadCombatKnowledge?: () => Promise<CombatKnowledgeBase>;
  loadCurioKnowledge?: () => Promise<CurioKnowledgeBase>;
  gameDirectory?: string;
  loadBuildingUpgradeTrees?: () => Promise<BuildingUpgradeTree[]>;
  loadHeroCombatSkillTrees?: () => Promise<HeroCombatSkillTree[]>;
  loadHeroCombatSkillPositions?: () => Promise<HeroCombatSkillPositionDefinition[]>;
  loadHeroProgressionRules?: () => Promise<HeroProgressionRules>;
  loadQuestRestrictionRules?: () => Promise<QuestRestrictionRules>;
  loadQuestLocalization?: () => Promise<QuestLocalization>;
  loadGameLocalization?: () => Promise<GameLocalization>;
  loadQuirkDefinitions?: () => Promise<QuirkDefinition[]>;
  loadQuirkTreatmentKnowledge?: () => Promise<QuirkTreatmentKnowledgeBase>;
}

export const serverInstructions = [
  "This read-only server provides normalized Darkest Dungeon 1 save state and verified gameplay knowledge.",
  "Answer in the user's language. Treat English guidance fields as source material to summarize rather than text to reproduce verbatim, and use localized name fields for game terminology.",
  "Use save-state tools for facts about the current campaign instead of guessing.",
  "Use roster.activeHeroes for the current barracks count; roster.totalHeroRecords includes deceased history.",
  "list_heroes excludes deceased heroes by default; set includeDeceased only when historical records are requested.",
  "Use resolveLevel instead of resolveXp when stating a hero level, and use availability.isAvailableForPartySelection when choosing new party members.",
  "For a specific quest, pass questId to list_heroes or get_hero and use questEligibility instead of inferring level restrictions.",
  "Pass the user's language to quest tools and display dungeon.name, title, description, length.name, and reward item names; their ids and raw values are stable machine-readable fields.",
  "Use compare_heroes for objective comparisons instead of selecting a winner from raw experience points or class stereotypes.",
  "Pass the user's language to hero tools and display heroClassName and combatSkillDetails.name; preserve their ids only as stable identifiers.",
  "In hero details, use combatSkillDetails.level for combat skill levels; rawSelectionValue is not a level.",
  "Use combatSkillDetails.usableFromPartyPositions, target, and movement for formation claims instead of relying on class stereotypes.",
  "Formation position 1 is frontmost and position 4 is rearmost for both parties.",
  "Use combatPositionAnalysis for objective selected-skill position coverage; bestCoveragePartyPositions is not by itself a tactical recommendation.",
  "Use list_building_upgrades for verified building upgrade progress and next costs.",
  "Use list_trinkets for owned, equipped, and store trinkets; pass the user's language and display the localized name while preserving id as a stable identifier.",
  "Use list_risky_quirks for treatment-priority questions; pass the user's language, display localized hero-class and quirk names, and present its English policy and reasons as editorial guidance to summarize rather than absolute game values.",
  "Use query_classes for verified class roles, strengths, limitations, position guidance, mechanics, and party synergies instead of relying on class stereotypes; pass the user's language and display the localized class and skill names it returns.",
  "Use query_combat for verified region and enemy priorities, dangerous actions, threat types, and counters instead of inventing combat advice; pass the user's language and display the localized region name.",
  "Class position guidance is editorial strategy knowledge; use combatSkillDetails for the current hero's exact selected-skill positions.",
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
  const classKnowledgeLoader =
    options.loadClassKnowledge ?? loadClassKnowledge;
  let classKnowledgePromise: Promise<ClassKnowledgeBase> | undefined;
  const getClassKnowledge = () => {
    classKnowledgePromise ??= classKnowledgeLoader();
    return classKnowledgePromise;
  };
  const combatKnowledgeLoader =
    options.loadCombatKnowledge ?? loadCombatKnowledge;
  let combatKnowledgePromise: Promise<CombatKnowledgeBase> | undefined;
  const getCombatKnowledge = () => {
    combatKnowledgePromise ??= combatKnowledgeLoader();
    return combatKnowledgePromise;
  };
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
  const heroCombatSkillTreeLoader =
    options.loadHeroCombatSkillTrees ??
    (() => {
      const gameDirectory = options.gameDirectory?.trim();
      return gameDirectory === undefined || gameDirectory === ""
        ? Promise.resolve(undefined)
        : loadHeroCombatSkillTrees(gameDirectory);
    });
  let heroCombatSkillTreesPromise:
    | Promise<HeroCombatSkillTree[] | undefined>
    | undefined;
  const getHeroCombatSkillTrees = () => {
    heroCombatSkillTreesPromise ??= Promise.resolve().then(
      heroCombatSkillTreeLoader,
    );
    return heroCombatSkillTreesPromise;
  };
  const heroCombatSkillPositionLoader =
    options.loadHeroCombatSkillPositions ??
    (() => {
      const gameDirectory = options.gameDirectory?.trim();
      return gameDirectory === undefined || gameDirectory === ""
        ? Promise.resolve(undefined)
        : loadHeroCombatSkillPositions(gameDirectory);
    });
  let heroCombatSkillPositionsPromise:
    | Promise<HeroCombatSkillPositionDefinition[] | undefined>
    | undefined;
  const getHeroCombatSkillPositions = () => {
    heroCombatSkillPositionsPromise ??= Promise.resolve().then(
      heroCombatSkillPositionLoader,
    );
    return heroCombatSkillPositionsPromise;
  };
  const heroProgressionRulesLoader =
    options.loadHeroProgressionRules ??
    (() => {
      const gameDirectory = options.gameDirectory?.trim();
      return gameDirectory === undefined || gameDirectory === ""
        ? Promise.resolve(undefined)
        : loadHeroProgressionRules(gameDirectory);
    });
  let heroProgressionRulesPromise:
    | Promise<HeroProgressionRules | undefined>
    | undefined;
  const getHeroProgressionRules = () => {
    heroProgressionRulesPromise ??= Promise.resolve().then(
      heroProgressionRulesLoader,
    );
    return heroProgressionRulesPromise;
  };
  const questRestrictionRulesLoader =
    options.loadQuestRestrictionRules ??
    (() => {
      const gameDirectory = options.gameDirectory?.trim();
      return gameDirectory === undefined || gameDirectory === ""
        ? Promise.resolve(undefined)
        : loadQuestRestrictionRules(gameDirectory);
    });
  let questRestrictionRulesPromise:
    | Promise<QuestRestrictionRules | undefined>
    | undefined;
  const getQuestRestrictionRules = () => {
    questRestrictionRulesPromise ??= Promise.resolve().then(
      questRestrictionRulesLoader,
    );
    return questRestrictionRulesPromise;
  };
  const gameLocalizationLoader =
    options.loadGameLocalization ??
    options.loadQuestLocalization ??
    (() => {
      const gameDirectory = options.gameDirectory?.trim();
      return gameDirectory === undefined || gameDirectory === ""
        ? Promise.resolve(undefined)
        : loadGameLocalization(gameDirectory);
    });
  let gameLocalizationPromise:
    | Promise<QuestLocalization | undefined>
    | undefined;
  const getGameLocalization = () => {
    gameLocalizationPromise ??= Promise.resolve().then(
      gameLocalizationLoader,
    );
    return gameLocalizationPromise;
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
      outputSchema: z.object({ gameState: gameStateSummarySchema }),
      annotations: readOnlyAnnotations,
    },
    async ({ stressThreshold }) => {
      const [state, progressionRules] = await Promise.all([
        dataSource.load(),
        getHeroProgressionRules(),
      ]);
      return toolResult(
        "gameState",
        getGameStateSummary(state, stressThreshold, progressionRules),
      );
    },
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
      outputSchema: z.object({ upgrades: z.array(buildingUpgradeProgressSchema) }),
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
        language: z.enum(["en", "ko"]).default("en"),
        limit: z.number().int().min(1).max(50).default(10),
      }),
      outputSchema: z.object({
        policy: z.object({ title: z.string(), disclaimer: z.string() }),
        heroes: z.array(riskyHeroSchema),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ minimumPriority, lockedOnly, heroId, language, limit }) => {
      const [state, definitions, knowledge, localization] = await Promise.all([
        dataSource.load(),
        getQuirkDefinitions(),
        getTreatmentKnowledge(),
        getGameLocalization(),
      ]);
      const filters = {
        minimumPriority,
        lockedOnly,
        ...(heroId === undefined ? {} : { heroId }),
        language,
        limit,
      };
      const heroes = analyzeRiskyQuirks(
        state.roster,
        definitions,
        knowledge,
        filters,
      ).map((hero) => ({
        ...hero,
        heroClassName: localizeHeroClass(
          hero.heroClass,
          language,
          localization,
        ),
      }));
      const structuredContent = {
        policy: knowledge.policy,
        heroes,
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
      description:
        "List normalized hero summaries with verified resolve levels and party-selection availability when game definitions are configured.",
      inputSchema: z.object({
        heroClass: z.string().min(1).optional(),
        rosterStatus: z.number().int().optional(),
        maxStress: z.number().finite().nonnegative().optional(),
        availableOnly: z.boolean().default(false),
        includeDeceased: z
          .boolean()
          .default(false)
          .describe("Include deceased historical hero records. Defaults to false."),
        questId: z.string().min(1).optional(),
        eligibleOnly: z.boolean().default(false),
        language: z.enum(["en", "ko"]).default("en"),
      }).refine(
        ({ questId, eligibleOnly }) => !eligibleOnly || questId !== undefined,
        { message: "eligibleOnly requires questId." },
      ),
      outputSchema: z.object({ heroes: z.array(heroSummarySchema) }),
      annotations: readOnlyAnnotations,
    },
    async ({
      heroClass,
      rosterStatus,
      maxStress,
      availableOnly,
      includeDeceased,
      questId,
      eligibleOnly,
      language,
    }) => {
      const [state, progressionRules, restrictionRules, localization] = await Promise.all([
        dataSource.load(),
        getHeroProgressionRules(),
        questId === undefined
          ? Promise.resolve(undefined)
          : getQuestRestrictionRules(),
        getGameLocalization(),
      ]);
      const quest = questId === undefined
        ? undefined
        : getQuest(state.quests, questId);
      if (questId !== undefined && quest === undefined) {
        return notFoundResult("Quest", questId);
      }
      const filters = {
        ...(heroClass === undefined ? {} : { heroClass }),
        ...(rosterStatus === undefined ? {} : { rosterStatus }),
        ...(maxStress === undefined ? {} : { maxStress }),
        availableOnly,
        includeDeceased,
      };
      const heroes = listHeroes(
        state.roster,
        filters,
        state.town,
        progressionRules,
      ).map((hero) => ({
        ...hero,
        heroClassName: localizeHeroClass(hero.heroClass, language, localization),
        questEligibility:
          quest === undefined
            ? null
            : getQuestEligibility(
                quest,
                hero.resolveLevel,
                restrictionRules,
              ),
      })).filter(
        (hero) =>
          !eligibleOnly || hero.questEligibility?.isEligible === true,
      );
      return toolResult("heroes", heroes);
    },
  );

  server.registerTool(
    "compare_heroes",
    {
      title: "Compare heroes",
      description:
        "Compare 2 to 8 heroes using resolve level, stress, availability, optional quest eligibility, equipment, selected combat skills, formation coverage, and curated quirk treatment risk. Returns objective highlights without choosing an overall winner.",
      inputSchema: z.object({
        heroIds: z
          .array(z.string().min(1))
          .min(2)
          .max(8)
          .refine((ids) => new Set(ids).size === ids.length, {
            message: "heroIds must be unique.",
          }),
        questId: z.string().min(1).optional(),
        language: z.enum(["en", "ko"]).default("en"),
      }),
      outputSchema: z.object({ comparison: heroComparisonSchema }),
      annotations: readOnlyAnnotations,
    },
    async ({ heroIds, questId, language }) => {
      const canAnalyzeQuirkRisk =
        options.loadQuirkDefinitions !== undefined ||
        (options.gameDirectory?.trim() ?? "") !== "";
      const [
        state,
        skillTrees,
        skillPositions,
        progressionRules,
        restrictionRules,
        quirkDefinitions,
        treatmentKnowledge,
        localization,
      ] = await Promise.all([
        dataSource.load(),
        getHeroCombatSkillTrees(),
        getHeroCombatSkillPositions(),
        getHeroProgressionRules(),
        questId === undefined
          ? Promise.resolve(undefined)
          : getQuestRestrictionRules(),
        canAnalyzeQuirkRisk
          ? getQuirkDefinitions()
          : Promise.resolve(undefined),
        canAnalyzeQuirkRisk
          ? getTreatmentKnowledge()
          : Promise.resolve(undefined),
        getGameLocalization(),
      ]);
      const missingHeroIds = heroIds.filter(
        (heroId) => getHero(state.roster, heroId) === undefined,
      );
      if (missingHeroIds.length > 0) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Heroes not found: ${missingHeroIds.join(", ")}`,
            },
          ],
        };
      }
      const quest = questId === undefined
        ? undefined
        : getQuest(state.quests, questId);
      if (questId !== undefined && quest === undefined) {
        return notFoundResult("Quest", questId);
      }
      const riskyHeroes =
        quirkDefinitions === undefined || treatmentKnowledge === undefined
          ? []
          : heroIds.flatMap((heroId) =>
              analyzeRiskyQuirks(
                state.roster,
                quirkDefinitions,
                treatmentKnowledge,
                { minimumPriority: "low", heroId, limit: 1 },
              ),
            );
      const riskByHeroId = new Map(
        riskyHeroes.map((hero) => [hero.heroId, hero]),
      );
      const heroes = heroIds.map((heroId) => {
        const hero = getHero(state.roster, heroId)!;
        const townContext = getHeroTownContext(
          state.roster,
          state.town,
          heroId,
        )!;
        const resolveLevel = getResolveLevel(
          hero.resolveXp,
          progressionRules,
        );
        const combatSkillDetails = getHeroCombatSkillDetails(
          hero,
          state.upgrades,
          skillTrees,
          skillPositions,
        );
        const risk = riskByHeroId.get(heroId);
        return {
          id: hero.id,
          name: hero.name,
          heroClass: hero.heroClass,
          heroClassName: localizeHeroClass(hero.heroClass, language, localization),
          rosterState: getHeroRosterState(hero.rosterStatus),
          resolveXp: hero.resolveXp,
          resolveLevel,
          stress: hero.stress,
          availability: getHeroAvailability(hero, townContext),
          questEligibility:
            quest === undefined
              ? null
              : getQuestEligibility(quest, resolveLevel, restrictionRules),
          equipment: {
            weaponRank: hero.weaponRank,
            armourRank: hero.armourRank,
          },
          selectedCombatSkills: combatSkillDetails
            .filter((skill) => skill.isSelected)
            .map((skill) => ({
              ...skill,
              name: localizeCombatSkill(
                hero.heroClass,
                skill.id,
                language,
                localization,
              ),
            })),
          combatPositionAnalysis:
            analyzeHeroCombatPositions(combatSkillDetails),
          quirkTreatmentAnalysis: {
            status: canAnalyzeQuirkRisk
              ? "available" as const
              : "unavailable" as const,
            risk: risk === undefined
              ? null
              : {
                  overallPriority: risk.overallPriority,
                  riskyQuirkIds: risk.riskyQuirks.map((quirk) => quirk.id),
                },
          },
        };
      });
      return toolResult("comparison", {
        heroes,
        highlights: getHeroComparisonHighlights(heroes),
      });
    },
  );

  server.registerTool(
    "get_hero",
    {
      title: "Get hero details",
      description:
        "Return one normalized hero with verified resolve and combat skill levels when game definitions are available, party-selection availability, and current town activity context. Raw selection values are not skill levels.",
      inputSchema: z.object({
        heroId: z.string().min(1),
        questId: z.string().min(1).optional(),
        language: z.enum(["en", "ko"]).default("en"),
      }),
      outputSchema: z.object({
        hero: heroDetailSchema,
        townContext: heroTownContextSchema,
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ heroId, questId, language }) => {
      const [
        state,
        skillTrees,
        skillPositions,
        progressionRules,
        restrictionRules,
        localization,
      ] = await Promise.all([
        dataSource.load(),
        getHeroCombatSkillTrees(),
        getHeroCombatSkillPositions(),
        getHeroProgressionRules(),
        questId === undefined
          ? Promise.resolve(undefined)
          : getQuestRestrictionRules(),
        getGameLocalization(),
      ]);
      const hero = getHero(state.roster, heroId);
      if (hero === undefined) {
        return notFoundResult("Hero", heroId);
      }
      const quest = questId === undefined
        ? undefined
        : getQuest(state.quests, questId);
      if (questId !== undefined && quest === undefined) {
        return notFoundResult("Quest", questId);
      }

      const townContext = getHeroTownContext(
        state.roster,
        state.town,
        heroId,
      );
      const combatSkillDetails = getHeroCombatSkillDetails(
        hero,
        state.upgrades,
        skillTrees,
        skillPositions,
      );
      const resolveLevel = getResolveLevel(hero.resolveXp, progressionRules);
      const heroDetails = {
        ...hero,
        heroClassName: localizeHeroClass(hero.heroClass, language, localization),
        rosterState: getHeroRosterState(hero.rosterStatus),
        resolveLevel,
        availability: getHeroAvailability(hero, townContext!),
        questEligibility:
          quest === undefined
            ? null
            : getQuestEligibility(quest, resolveLevel, restrictionRules),
        combatSkillDetails: combatSkillDetails.map((skill) => ({
          ...skill,
          name: localizeCombatSkill(
            hero.heroClass,
            skill.id,
            language,
            localization,
          ),
        })),
        combatPositionAnalysis: analyzeHeroCombatPositions(combatSkillDetails),
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              hero: heroDetails,
              townContext,
            }),
          },
        ],
        structuredContent: {
          hero: heroDetails,
          townContext,
        },
      };
    },
  );

  server.registerTool(
    "list_quests",
    {
      title: "List quests",
      description:
        "List normalized quest summaries with optional filters and one localized dungeon display name.",
      inputSchema: z.object({
        dungeon: z
          .string()
          .min(1)
          .optional()
          .describe("Raw dungeon id used for filtering, such as crypts or weald."),
        type: z.string().min(1).optional(),
        difficulty: z.number().int().nonnegative().optional(),
        isPlotQuest: z.boolean().optional(),
        language: z
          .enum(["en", "ko"])
          .default("en")
          .describe("Display language for dungeon.name."),
      }),
      outputSchema: z.object({ quests: z.array(questSummarySchema) }),
      annotations: readOnlyAnnotations,
    },
    async ({ dungeon, type, difficulty, isPlotQuest, language }) => {
      const [state, localization] = await Promise.all([
        dataSource.load(),
        getGameLocalization(),
      ]);
      const filters = {
        ...(dungeon === undefined ? {} : { dungeon }),
        ...(type === undefined ? {} : { type }),
        ...(difficulty === undefined ? {} : { difficulty }),
        ...(isPlotQuest === undefined ? {} : { isPlotQuest }),
      };
      return toolResult(
        "quests",
        listQuests(state.quests, filters).map((quest) =>
          localizeQuestSummary(quest, language, localization),
        ),
      );
    },
  );

  server.registerTool(
    "get_quest",
    {
      title: "Get quest details",
      description:
        "Return one normalized quest with a localized dungeon display name.",
      inputSchema: z.object({
        questId: z.string().min(1),
        language: z
          .enum(["en", "ko"])
          .default("en")
          .describe("Display language for dungeon.name."),
      }),
      outputSchema: z.object({ quest: questSchema }),
      annotations: readOnlyAnnotations,
    },
    async ({ questId, language }) => {
      const [state, localization] = await Promise.all([
        dataSource.load(),
        getGameLocalization(),
      ]);
      const quest = getQuest(state.quests, questId);
      return quest === undefined
        ? notFoundResult("Quest", questId)
        : toolResult("quest", localizeQuest(quest, language, localization));
    },
  );

  server.registerTool(
    "list_trinkets",
    {
      title: "Query trinkets",
      description:
        "Query trinkets across estate storage, equipped heroes, and town stores by exact id or localized name. Omit filters to list all trinkets.",
      inputSchema: z.object({
        id: z.string().min(1).optional(),
        query: z.string().min(1).optional(),
        location: z.enum(["storage", "equipped", "store"]).optional(),
        language: z.enum(["en", "ko"]).default("en"),
      }),
      outputSchema: z.object({ trinkets: z.array(trinketRecordSchema) }),
      annotations: readOnlyAnnotations,
    },
    async ({ id, query, location, language }) => {
      const [state, localization] = await Promise.all([
        dataSource.load(),
        getGameLocalization(),
      ]);
      const filters = {
        ...(id === undefined ? {} : { id }),
        ...(query === undefined ? {} : { query }),
        ...(location === undefined ? {} : { location }),
        language,
      };
      return toolResult("trinkets", listTrinkets(state, filters, localization));
    },
  );

  server.registerTool(
    "query_classes",
    {
      title: "Query class knowledge",
      description:
        "Query verified Darkest Dungeon 1 class guidance by exact id, localized name, alias, role, or DLC. Omit filters to list all covered classes.",
      inputSchema: z.object({
        id: z.string().min(1).optional(),
        query: z.string().min(1).optional(),
        role: z.string().min(1).optional(),
        isDlc: z.boolean().optional(),
        dlc: z.string().min(1).optional(),
        language: z.enum(["en", "ko"]).default("en"),
        limit: z.number().int().min(1).max(20).default(20),
      }),
      outputSchema: z.object({ classes: z.array(classKnowledgeSchema) }),
      annotations: readOnlyAnnotations,
    },
    async ({ id, query, role, isDlc, dlc, language, limit }) => {
      const filters = {
        ...(id === undefined ? {} : { id }),
        ...(query === undefined ? {} : { query }),
        ...(role === undefined ? {} : { role }),
        ...(isDlc === undefined ? {} : { isDlc }),
        ...(dlc === undefined ? {} : { dlc }),
        language,
        limit,
      };
      const [knowledge, localization] = await Promise.all([
        getClassKnowledge(),
        getGameLocalization(),
      ]);
      return toolResult(
        "classes",
        queryClasses(knowledge, filters, localization),
      );
    },
  );

  server.registerTool(
    "query_combat",
    {
      title: "Query combat knowledge",
      description:
        "Query verified Darkest Dungeon 1 region and enemy combat guidance by localized name, region, threat type, or enemy priority. Use scope to return only regions or enemies and keep responses focused.",
      inputSchema: z.object({
        query: z.string().min(1).optional(),
        region: combatRegionSchema.optional(),
        threat: combatThreatSchema.optional(),
        priority: enemyPrioritySchema.optional(),
        scope: z.enum(["all", "regions", "enemies"]).default("all"),
        language: z.enum(["en", "ko"]).default("en"),
        limit: z.number().int().min(1).max(50).default(20),
      }),
      outputSchema: z.object({
        regions: z.array(regionCombatKnowledgeSchema),
        enemies: z.array(enemyCombatKnowledgeSchema),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ query, region, threat, priority, scope, language, limit }) => {
      const filters = {
        ...(query === undefined ? {} : { query }),
        ...(region === undefined ? {} : { region }),
        ...(threat === undefined ? {} : { threat }),
        ...(priority === undefined ? {} : { priority }),
        scope,
        language,
        limit,
      };
      const [knowledge, localization] = await Promise.all([
        getCombatKnowledge(),
        getGameLocalization(),
      ]);
      const result = queryCombatKnowledge(knowledge, filters, localization);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
        structuredContent: result,
      };
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
      outputSchema: z.object({ curios: z.array(curioSummarySchema) }),
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
      outputSchema: z.object({ advice: curioAdviceSchema }),
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
