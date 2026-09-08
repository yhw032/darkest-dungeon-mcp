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
  const riskyHero = state.roster.heroes.find(
    (hero) => hero.rosterStatus !== 3 && hero.quirks.length > 0,
  );
  const riskyQuirk = riskyHero?.quirks[0];
  assert.ok(expectedHero);
  assert.ok(expectedQuest);
  assert.ok(expectedStoredTrinket);
  assert.ok(riskyHero);
  assert.ok(riskyQuirk);

  const server = createDarkestDungeonServer(dataSource, {
    loadGameLocalization: async () =>
      new Map([
        [
          "koreana",
          new Map([
            ["dungeon_name_cove", "해안 만"],
            [`town_quest_name_${expectedQuest.id}`, "세이렌 처치"],
            [
              `town_quest_description_${expectedQuest.id}`,
              "세이렌을 찾아 처치하십시오.",
            ],
            [`town_quest_length_${String(expectedQuest.length)}`, "중간"],
            ...expectedQuest.reward.items.map((item) => [
              `str_inventory_title_${item.type}${item.id}`,
              `시험 보상 ${item.type}:${item.id}`,
            ] as const),
            [
              `str_inventory_title_trinket${expectedStoredTrinket.id}`,
              "시험 장신구",
            ],
            ["str_monstername_collector_A", "수집가"],
            ["str_monstername_bloated_corpse_A", "익사한 노예"],
            [`hero_class_name_${expectedHero.heroClass}`, "시험 직업"],
            [`hero_class_name_${riskyHero.heroClass}`, "시험 직업"],
            ...expectedHero.combatSkillSelections.map(({ id }) => [
              `combat_skill_name_${expectedHero.heroClass}_${id}`,
              `시험 기술 ${id}`,
            ] as const),
            ["hero_class_name_leper", "나병환자"],
            [
              "combat_skill_name_leper_chop",
              "토막치기",
            ],
            ["town_name_guild", "길드"],
            ["upgrade_tree_name_guild.skill_levels", "훈련 교관 숙련도"],
            ["str_inventory_title_gold", "골드"],
            ["str_inventory_title_heirloombust", "흉상"],
            ["str_inventory_title_heirloomportrait", "초상화"],
            ["str_inventory_title_shard", "혜성의 파편"],
            ["str_inventory_title_trinketheavens_hairpin", "천국의 머리핀"],
            ["str_inventory_title_trinketcollector_1", "디스마스의 머리"],
            ["str_curio_title_eldritch_altar", "괴이한 제단"],
            ["str_curio_title_shamblers_altar", "기는 혼돈의 제단"],
            ["str_affliction_name_depressed", "절망"],
            ["str_virtue_name_focused", "정신 집중"],
            ["str_quirk_name_nervous_bleeder", "출혈 긴장증"],
            ["str_quirk_name_torn_rotator_cuff", "인대 파열"],
          ]),
        ],
      ]),
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
    loadHeroProgressionRules: async () => ({
      resolveLevelThresholds: [0, 2, 8, 14, 24, 36, 48],
    }),
    loadQuestRestrictionRules: async () => ({
      maximumResolveLevelByDifficulty: [2, 2, 3, 4, 5, 99, 99],
    }),
    loadHeroCombatSkillPositions: async () =>
      expectedHero.combatSkillSelections.map(({ id }) => ({
        heroClass: expectedHero.heroClass,
        skillId: id,
        usableFromPartyPositions: [2, 3, 4],
        target: { side: "enemy", mode: "single", positions: [2, 3, 4] },
        movement: { backward: 0, forward: 0 },
      })),
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
    loadTrinketDefinitions: async () => [
      {
        id: "heavens_hairpin",
        rarity: "very_rare",
        price: 25000,
        limit: 0,
        heroClassRequirements: ["hellion"],
        originDungeon: null,
        effects: [
          {
            buffId: "BUFF_CRIT",
            statType: "crit_chance",
            statSubType: "",
            amount: 0.1,
            ruleType: "always",
            isFalseRule: false,
          },
        ],
        unresolvedBuffIds: [],
      },
      {
        id: "collector_1",
        rarity: "collector",
        price: 15000,
        limit: 1,
        heroClassRequirements: [],
        originDungeon: null,
        effects: [],
        unresolvedBuffIds: [],
      },
    ],
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
  assert.match(instructions ?? "", /compare_heroes/);
  assert.match(instructions ?? "", /query_classes/);
  assert.match(instructions ?? "", /query_combat/);
  assert.match(instructions ?? "", /recommend_trinkets/);
  assert.match(instructions ?? "", /plan_expedition/);
  assert.match(instructions ?? "", /recommend_building_upgrades/);
  assert.match(instructions ?? "", /editorial strategy knowledge/);

  const { tools } = await client.listTools();
  assert.deepEqual(
    tools.map((tool) => tool.name).sort(),
    [
      "compare_heroes",
      "get_curio_advice",
      "get_game_state",
      "get_hero",
      "get_quest",
      "list_building_upgrades",
      "list_heroes",
      "list_quests",
      "list_risky_quirks",
      "list_trinkets",
      "plan_expedition",
      "query_classes",
      "query_combat",
      "recommend_building_upgrades",
      "recommend_trinkets",
      "refresh_game_state",
      "search_curios",
    ],
  );
  assert.ok(tools.every((tool) => tool.annotations?.readOnlyHint === true));
  assert.equal(
    tools.find((tool) => tool.name === "plan_expedition")?.title,
    "Plan expedition",
  );
  assert.equal(
    tools.find((tool) => tool.name === "recommend_building_upgrades")?.title,
    "Recommend building upgrades",
  );

  const refreshResult = await client.callTool({
    name: "refresh_game_state",
    arguments: {},
  });
  const refreshedSnapshot = (
    refreshResult.structuredContent as
      | { snapshot?: { snapshotId?: unknown; source?: unknown } }
      | undefined
  )?.snapshot;
  assert.equal(typeof refreshedSnapshot?.snapshotId, "string");
  assert.equal(refreshedSnapshot?.source, "sample");

  const listHeroesTool = tools.find((tool) => tool.name === "list_heroes");
  const listHeroesOutput = listHeroesTool?.outputSchema as
    | {
        properties?: {
          heroes?: {
            items?: { properties?: Record<string, { description?: string }> };
          };
        };
      }
    | undefined;
  const heroProperties = listHeroesOutput?.properties?.heroes?.items?.properties;
  assert.ok(heroProperties?.id);
  assert.ok(heroProperties?.name);
  assert.match(heroProperties?.resolveXp?.description ?? "", /not the hero's resolve level/i);
  assert.match(heroProperties?.rosterStatus?.description ?? "", /do not infer availability/i);
  assert.match(heroProperties?.rosterState?.description ?? "", /deceased heroes are excluded/i);

  const getHeroTool = tools.find((tool) => tool.name === "get_hero");
  const getHeroOutput = getHeroTool?.outputSchema as
    | {
        properties?: {
          hero?: { properties?: Record<string, unknown> };
          townContext?: { properties?: Record<string, unknown> };
        };
      }
    | undefined;
  assert.ok(getHeroOutput?.properties?.hero?.properties?.combatSkillDetails);
  assert.ok(getHeroOutput?.properties?.townContext?.properties?.activityAssignments);

  const summaryResult = await client.callTool({
    name: "get_game_state",
    arguments: { stressThreshold: 50, language: "ko" },
  });
  assert.equal(summaryResult.isError, undefined);
  const summaryContent = summaryResult.structuredContent as
    | Record<string, unknown>
    | undefined;
  assert.ok(summaryContent?.gameState);
  const gameStateSummary = summaryContent.gameState as {
    roster?: {
      byClassDetails?: Array<{ id: string; name: string | null; count: number }>;
    };
    estate?: {
      resources?: Array<{ type: string; name?: string | null; amount: number }>;
    };
    quests?: {
      byDungeonDetails?: Array<{ id: string; name: string | null; count: number }>;
    };
  };
  assert.ok(Array.isArray(gameStateSummary.roster?.byClassDetails));
  assert.ok((gameStateSummary.roster?.byClassDetails?.length ?? 0) > 0);
  assert.equal(
    gameStateSummary.roster?.byClassDetails?.find(
      ({ id }) => id === expectedHero.heroClass,
    )?.name,
    "시험 직업",
  );
  assert.ok(Array.isArray(gameStateSummary.estate?.resources));
  assert.equal(
    gameStateSummary.estate?.resources?.find(({ type }) => type === "gold")?.name,
    "골드",
  );
  assert.equal(
    gameStateSummary.estate?.resources?.find(({ type }) => type === "bust")?.name,
    "흉상",
  );
  assert.equal(
    gameStateSummary.estate?.resources?.find(({ type }) => type === "portrait")?.name,
    "초상화",
  );
  assert.equal(
    gameStateSummary.estate?.resources?.find(({ type }) => type === "shard")?.name,
    "혜성의 파편",
  );
  assert.ok(Array.isArray(gameStateSummary.quests?.byDungeonDetails));
  assert.ok((gameStateSummary.quests?.byDungeonDetails?.length ?? 0) > 0);
  assert.equal(
    gameStateSummary.quests?.byDungeonDetails?.find(({ id }) => id === "cove")?.name,
    "해안 만",
  );

  const upgradeResult = await client.callTool({
    name: "list_building_upgrades",
    arguments: { buildingId: "guild", language: "ko" },
  });
  const upgradeContent = upgradeResult.structuredContent as
    | Record<string, unknown>
    | undefined;
  const upgrades = upgradeContent?.upgrades;
  assert.ok(Array.isArray(upgrades));
  assert.equal(upgrades.length, 1);
  assert.deepEqual(upgrades[0], {
    treeId: "guild.skill_levels",
    treeName: "훈련 교관 숙련도",
    buildingId: "guild",
    buildingName: "길드",
    purchasedCodes: ["a", "b", "c"],
    purchasedCount: 3,
    totalCount: 4,
    highestPurchasedCode: "c",
    nextRequirement: {
      code: "d",
      currencyCost: [{ type: "portrait", name: "초상화", amount: 33 }],
    },
    isComplete: false,
  });

  const riskyResult = await client.callTool({
    name: "list_risky_quirks",
    arguments: { heroId: riskyHero.id, language: "ko" },
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
  assert.equal(
    (riskyHeroes[0] as { heroClassName?: unknown } | undefined)?.heroClassName,
    "시험 직업",
  );
  const localizedRiskyQuirk = (
    riskyHeroes[0] as
      | { riskyQuirks?: Array<{ name?: unknown; description?: unknown }> }
      | undefined
  )?.riskyQuirks?.[0];
  assert.equal(localizedRiskyQuirk?.name, "위험 테스트 기벽");
  assert.equal(localizedRiskyQuirk?.description, "테스트 위험");

  const listResult = await client.callTool({
    name: "list_heroes",
    arguments: { heroClass: expectedHero.heroClass, language: "ko" },
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
        hero.heroClass === expectedHero.heroClass &&
        "heroClassName" in hero &&
        hero.heroClassName === "시험 직업" &&
        "rosterState" in hero &&
        hero.rosterState !== "deceased",
    ),
  );

  const eligibleResult = await client.callTool({
    name: "list_heroes",
    arguments: { questId: expectedQuest.id, eligibleOnly: true },
  });
  const eligibleHeroes = (
    eligibleResult.structuredContent as { heroes?: unknown[] } | undefined
  )?.heroes;
  assert.ok(Array.isArray(eligibleHeroes));
  assert.ok(eligibleHeroes.length > 0);
  assert.ok(
    eligibleHeroes.every(
      (candidate) =>
        typeof candidate === "object" &&
        candidate !== null &&
        "questEligibility" in candidate &&
        candidate.questEligibility !== null &&
        typeof candidate.questEligibility === "object" &&
        "isEligible" in candidate.questEligibility &&
        candidate.questEligibility.isEligible === true,
    ),
  );

  const heroResult = await client.callTool({
    name: "get_hero",
    arguments: { heroId: expectedHero.id, language: "ko" },
  });
  const heroContent = heroResult.structuredContent as
    | Record<string, unknown>
    | undefined;
  assert.deepEqual(heroContent?.hero, {
    ...expectedHero,
    buildingId: expectedHero.buildingName,
    heroClassName: "시험 직업",
    rosterState: "deceased",
    resolveLevel: expectedHero.resolveXp >= 2 ? 1 : 0,
    availability: {
      isAvailableForPartySelection:
        expectedHero.rosterStatus === 0 && expectedHero.buildingName === null,
      reasons:
        expectedHero.rosterStatus === 1
          ? ["already_selected_for_raid"]
          : expectedHero.rosterStatus !== 0
            ? ["roster_status_unavailable"]
            : expectedHero.buildingName !== null
              ? ["assigned_to_town_activity"]
              : [],
    },
    questEligibility: null,
    afflictionName: "절망",
    virtueName: null,
    quirks: expectedHero.quirks.map((quirk) => ({
      ...quirk,
      name:
        quirk.id === "nervous_bleeder"
          ? "출혈 긴장증"
          : quirk.id === "torn_rotator_cuff"
            ? "인대 파열"
            : null,
    })),
    equippedTrinkets: expectedHero.equippedTrinkets.map((trinket) => ({
      ...trinket,
      name: null,
    })),
    combatSkillDetails: expectedHero.combatSkillSelections.map(
      ({ id, rawSelectionValue }) => ({
        id,
        name: `시험 기술 ${id}`,
        level: null,
        isSelected: true,
        rawSelectionValue,
        usableFromPartyPositions: [2, 3, 4],
        target: { side: "enemy", mode: "single", positions: [2, 3, 4] },
        movement: { backward: 0, forward: 0 },
      }),
    ),
    campingSkillDetails: [
      {
        id: "first_aid",
        name: null,
        cost: 2,
        preventsNightAmbush: false,
        curesDisease: false,
        primaryCategory: "heal",
      },
      {
        id: "experimental_vapours",
        name: null,
        cost: 4,
        preventsNightAmbush: false,
        curesDisease: false,
        primaryCategory: "buff",
      },
      {
        id: "leeches",
        name: null,
        cost: 3,
        preventsNightAmbush: false,
        curesDisease: true,
        primaryCategory: "heal",
      },
    ],
    combatPositionAnalysis: {
      status: "complete",
      selectedSkillCount: expectedHero.combatSkillSelections.length,
      definedSkillCount: expectedHero.combatSkillSelections.length,
      positionNumbering: { front: 1, back: 4 },
      positionCoverage: [1, 2, 3, 4].map((partyPosition) => ({
        partyPosition,
        usableSkillIds:
          partyPosition >= 2
            ? expectedHero.combatSkillSelections.map(({ id }) => id)
            : [],
        unusableSkillIds:
          partyPosition >= 2
            ? []
            : expectedHero.combatSkillSelections.map(({ id }) => id),
        unknownSkillIds: [],
      })),
      fullyUsablePartyPositions: [2, 3, 4],
      bestCoveragePartyPositions: [2, 3, 4],
    },
  });

  const equippedHeroResult = await client.callTool({
    name: "get_hero",
    arguments: { heroId: "18", language: "ko" },
  });
  const equippedHero = (
    equippedHeroResult.structuredContent as
      | {
          hero?: {
            equippedTrinkets?: Array<{
              id: string;
              name: string | null;
              rarity?: string | null;
              isUsableByHeroClass?: boolean;
              heroClassRequirements?: string[];
              effects?: Array<{ statType: string; amount: number }>;
            }>;
          };
        }
      | undefined
  )?.hero;
  assert.deepEqual(
    equippedHero?.equippedTrinkets?.map(({ id, name }) => ({ id, name })),
    [
      { id: "heavens_hairpin", name: "천국의 머리핀" },
      { id: "collector_1", name: "디스마스의 머리" },
    ],
  );
  assert.equal(equippedHero?.equippedTrinkets?.[0]?.rarity, "very_rare");
  assert.equal(equippedHero?.equippedTrinkets?.[0]?.isUsableByHeroClass, true);
  assert.deepEqual(
    equippedHero?.equippedTrinkets?.[0]?.heroClassRequirements,
    ["hellion"],
  );
  assert.equal(equippedHero?.equippedTrinkets?.[0]?.effects?.length, 1);
  assert.equal(
    equippedHero?.equippedTrinkets?.[0]?.effects?.[0]?.statType,
    "crit_chance",
  );
  assert.equal(equippedHero?.equippedTrinkets?.[1]?.rarity, "collector");
  assert.equal(equippedHero?.equippedTrinkets?.[1]?.isUsableByHeroClass, true);

  const afflictedHeroResult = await client.callTool({
    name: "get_hero",
    arguments: { heroId: "7", language: "ko" },
  });
  const afflictedHero = (
    afflictedHeroResult.structuredContent as
      | {
          hero?: {
            afflictionId?: string | null;
            afflictionName?: string | null;
            quirks?: Array<{ id: string; name: string | null }>;
          };
        }
      | undefined
  )?.hero;
  assert.equal(afflictedHero?.afflictionId, "depressed");
  assert.equal(afflictedHero?.afflictionName, "절망");
  assert.equal(
    afflictedHero?.quirks?.find(({ id }) => id === "nervous_bleeder")?.name,
    "출혈 긴장증",
  );
  assert.equal(
    afflictedHero?.quirks?.find(({ id }) => id === "torn_rotator_cuff")?.name,
    "인대 파열",
  );

  const virtuousHeroResult = await client.callTool({
    name: "get_hero",
    arguments: { heroId: "20", language: "ko" },
  });
  const virtuousHero = (
    virtuousHeroResult.structuredContent as
      | {
          hero?: {
            virtueId?: string | null;
            virtueName?: string | null;
          };
        }
      | undefined
  )?.hero;
  assert.equal(virtuousHero?.virtueId, "focused");
  assert.equal(virtuousHero?.virtueName, "정신 집중");

  const secondHero = state.roster.heroes[1];
  assert.ok(secondHero);
  const comparisonResult = await client.callTool({
    name: "compare_heroes",
    arguments: {
      heroIds: [expectedHero.id, secondHero.id],
      questId: expectedQuest.id,
      language: "ko",
    },
  });
  assert.equal(comparisonResult.isError, undefined);
  const comparison = (
    comparisonResult.structuredContent as
      | { comparison?: { heroes?: unknown[]; highlights?: unknown } }
      | undefined
  )?.comparison;
  assert.equal(comparison?.heroes?.length, 2);
  assert.ok(comparison?.highlights);
  assert.deepEqual(
    comparison?.heroes?.map((candidate) =>
      (candidate as { id?: unknown }).id),
    [expectedHero.id, secondHero.id],
  );
  assert.deepEqual(
    comparison?.heroes?.map((candidate) =>
      (candidate as { rosterState?: unknown }).rosterState),
    ["deceased", "active"],
  );
  assert.ok(
    !JSON.stringify(comparison?.highlights).includes(expectedHero.id),
  );

  const riskyComparisonResult = await client.callTool({
    name: "compare_heroes",
    arguments: {
      heroIds: [expectedHero.id, riskyHero.id],
      language: "ko",
    },
  });
  const riskyComparison = (
    riskyComparisonResult.structuredContent as
      | {
          comparison?: {
            heroes?: Array<{
              id: string;
              quirkTreatmentAnalysis?: {
                status: string;
                risk: {
                  overallPriority: string;
                  riskyQuirkIds: string[];
                  riskyQuirks: Array<{ id: string; name: string | null }>;
                } | null;
              };
            }>;
          };
        }
      | undefined
  )?.comparison;
  const comparedRiskyHero = riskyComparison?.heroes?.find(
    (h) => h.id === riskyHero.id,
  );
  assert.equal(
    comparedRiskyHero?.quirkTreatmentAnalysis?.status,
    "available",
  );
  assert.deepEqual(
    comparedRiskyHero?.quirkTreatmentAnalysis?.risk?.riskyQuirks,
    [{ id: riskyQuirk.id, name: "위험 테스트 기벽" }],
  );

  const missingResult = await client.callTool({
    name: "get_hero",
    arguments: { heroId: "missing-hero" },
  });
  assert.equal(missingResult.isError, true);

  const questListResult = await client.callTool({
    name: "list_quests",
    arguments: { dungeon: expectedQuest.dungeon, language: "ko" },
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
        typeof quest.dungeon === "object" &&
        quest.dungeon !== null &&
        "id" in quest.dungeon &&
        quest.dungeon.id === expectedQuest.dungeon &&
        "name" in quest.dungeon &&
        typeof quest.dungeon.name === "string",
    ),
  );

  const questResult = await client.callTool({
    name: "get_quest",
    arguments: { questId: expectedQuest.id, language: "ko" },
  });
  const questContent = questResult.structuredContent as
    | Record<string, unknown>
    | undefined;
  assert.deepEqual(questContent?.quest, {
    ...expectedQuest,
    dungeon: { id: expectedQuest.dungeon, name: "해안 만" },
    title: "세이렌 처치",
    description: "세이렌을 찾아 처치하십시오.",
    length: { value: expectedQuest.length, name: "중간" },
    reward: {
      ...expectedQuest.reward,
      items: expectedQuest.reward.items.map((item) => ({
        ...item,
        name:
          item.type === "gold"
            ? "골드"
            : `시험 보상 ${item.type}:${item.id}`,
      })),
    },
  });
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
    arguments: { location: "storage", language: "ko" },
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
  assert.equal(
    (
      trinkets.find(
        (trinket) =>
          typeof trinket === "object" &&
          trinket !== null &&
          "id" in trinket &&
          trinket.id === expectedStoredTrinket.id,
      ) as { name?: unknown } | undefined
    )?.name,
    "시험 장신구",
  );

  const localizedTrinketResult = await client.callTool({
    name: "list_trinkets",
    arguments: { query: "시험 장신구", language: "ko" },
  });
  assert.equal(
    (
      localizedTrinketResult.structuredContent as
        | { trinkets?: Array<{ id?: unknown }> }
        | undefined
    )?.trinkets?.[0]?.id,
    expectedStoredTrinket.id,
  );

  const trinketResult = await client.callTool({
    name: "list_trinkets",
    arguments: { id: expectedStoredTrinket.id },
  });
  const trinketContent = trinketResult.structuredContent as
    | Record<string, unknown>
    | undefined;
  assert.equal(
    (
      trinketContent?.trinkets as Array<{ id?: unknown }> | undefined
    )?.[0]?.id,
    expectedStoredTrinket.id,
  );
  const missingTrinketResult = await client.callTool({
    name: "list_trinkets",
    arguments: { id: "missing-trinket" },
  });
  assert.deepEqual(
    (missingTrinketResult.structuredContent as { trinkets?: unknown })
      .trinkets,
    [],
  );
  const limitedTrinketResult = await client.callTool({
    name: "list_trinkets",
    arguments: { limit: 1 },
  });
  assert.equal(
    (
      limitedTrinketResult.structuredContent as
        | { trinkets?: unknown[] }
        | undefined
    )?.trinkets?.length,
    1,
  );

  const classFilteredResult = await client.callTool({
    name: "list_trinkets",
    arguments: { heroClass: "hellion", rarity: "very_rare", language: "ko" },
  });
  const classFilteredContent = classFilteredResult.structuredContent as
    | {
        trinkets?: Array<{
          id: string;
          rarity?: string;
          heroClassRequirements?: string[];
          effects?: unknown[];
        }>;
      }
    | undefined;
  assert.ok(classFilteredContent?.trinkets?.some((t) => t.id === "heavens_hairpin"));
  const heavensHairpin = classFilteredContent?.trinkets?.find(
    (t) => t.id === "heavens_hairpin",
  );
  assert.equal(heavensHairpin?.rarity, "very_rare");
  assert.deepEqual(heavensHairpin?.heroClassRequirements, ["hellion"]);
  assert.equal(heavensHairpin?.effects?.length, 1);

  const recommendResult = await client.callTool({
    name: "recommend_trinkets",
    arguments: { heroId: "18", onlyOwned: true, language: "ko" },
  });
  const recommendContent = recommendResult.structuredContent as
    | {
        recommendations?: {
          heroContext?: { heroId: string; heroClass: string };
          recommendations?: Array<{
            trinketId: string;
            tier: string;
            matchReason: string;
            ownership: { isOwned: boolean; status: string };
          }>;
        };
      }
    | undefined;
  assert.ok(recommendContent?.recommendations);
  assert.equal(recommendContent.recommendations.heroContext?.heroId, "18");
  assert.equal(recommendContent.recommendations.heroContext?.heroClass, "hellion");
  assert.ok((recommendContent.recommendations.recommendations?.length ?? 0) > 0);
  const recommendedHairpin =
    recommendContent.recommendations.recommendations?.find(
      (r) => r.trinketId === "heavens_hairpin",
    );
  assert.ok(recommendedHairpin);
  assert.equal(recommendedHairpin.tier, "S");
  assert.equal(recommendedHairpin.ownership.isOwned, true);

  const missingTrinketGuidanceResult = await client.callTool({
    name: "recommend_trinkets",
    arguments: { trinketId: "does_not_exist" },
  });
  assert.equal(missingTrinketGuidanceResult.isError, true);

  const conflictingRecommendationModes = await client.callTool({
    name: "recommend_trinkets",
    arguments: { heroId: "18", heroClass: "hellion" },
  });
  assert.equal(conflictingRecommendationModes.isError, true);

  const curioSearchResult = await client.callTool({
    name: "search_curios",
    arguments: { query: "기는 혼돈의 제단", region: "ruins", language: "ko" },
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
  assert.equal(
    (curios[0] as { name?: unknown } | undefined)?.name,
    "기는 혼돈의 제단",
  );

  const classQueryResult = await client.callTool({
    name: "query_classes",
    arguments: { query: "나병환자", role: "damage", language: "ko" },
  });
  const classQueryContent = classQueryResult.structuredContent as
    | Record<string, unknown>
    | undefined;
  const classes = classQueryContent?.classes;
  assert.ok(Array.isArray(classes));
  assert.equal(
    (classes[0] as { id?: unknown } | undefined)?.id,
    "leper",
  );
  assert.equal(
    (classes[0] as { name?: unknown } | undefined)?.name,
    "나병환자",
  );
  assert.ok(
    Array.isArray(
      (classes[0] as { positionGuidance?: unknown } | undefined)
        ?.positionGuidance,
    ),
  );
  assert.equal(
    (classes[0] as { skillGuidance?: unknown[] } | undefined)?.skillGuidance
      ?.length,
    7,
  );
  const chop = (
    classes[0] as
      | { skillGuidance?: Array<{ skillId?: unknown; name?: unknown }> }
      | undefined
  )?.skillGuidance?.find(({ skillId }) => skillId === "chop");
  assert.equal(chop?.name, "토막치기");

  const combatQueryResult = await client.callTool({
    name: "query_combat",
    arguments: {
      region: "cove",
      threat: "stress",
      priority: "critical",
      scope: "enemies",
      language: "ko",
    },
  });
  const combatQueryContent = combatQueryResult.structuredContent as
    | { regions?: unknown[]; enemies?: Array<{ id?: unknown }> }
    | undefined;
  assert.deepEqual(combatQueryContent?.regions, []);
  assert.deepEqual(
    combatQueryContent?.enemies?.map(({ id }) => id),
    [
      "collector",
      "drowned_crew",
      "drowned_thrall",
      "madman",
      "shambler",
      "siren",
      "squiffy_ghast",
    ],
  );
  assert.equal(
    (combatQueryContent?.enemies?.[0] as { name?: unknown } | undefined)?.name,
    "수집가",
  );

  const localizedCombatRegionResult = await client.callTool({
    name: "query_combat",
    arguments: { query: "해안 만", scope: "regions", language: "ko" },
  });
  const localizedCombatRegionContent =
    localizedCombatRegionResult.structuredContent as
      | { regions?: Array<{ id?: unknown; name?: unknown }> }
      | undefined;
  assert.deepEqual(localizedCombatRegionContent?.regions?.[0], {
    ...(localizedCombatRegionContent?.regions?.[0] ?? {}),
    id: "cove",
    name: "해안 만",
  });

  const curioAdviceResult = await client.callTool({
    name: "get_curio_advice",
    arguments: {
      name: "괴이한 제단",
      availableItems: ["Holy Water"],
      language: "ko",
    },
  });
  const curioAdviceContent = curioAdviceResult.structuredContent as
    | Record<string, unknown>
    | undefined;
  const advice = curioAdviceContent?.advice as
    | {
        status?: unknown;
        curio?: { name?: unknown };
        recommendedInteraction?: { item?: unknown };
      }
    | undefined;
  assert.equal(advice?.status, "found");
  assert.equal(advice?.curio?.name, "괴이한 제단");
  assert.equal(advice?.recommendedInteraction?.item, "holy_water");

  const missingCurioResult = await client.callTool({
    name: "get_curio_advice",
    arguments: { name: "missing curio" },
  });
  assert.equal(missingCurioResult.isError, true);

  const planExpeditionResult = await client.callTool({
    name: "plan_expedition",
    arguments: { language: "ko" },
  });
  const planContent = planExpeditionResult.structuredContent as
    | {
        plan?: {
          quest?: { id?: unknown; dungeon?: unknown };
          rolePool?: {
            frontlineDps?: unknown[];
            primaryHealer?: unknown[];
          };
          provisions?: {
            items?: Array<{ id?: unknown; amount?: unknown }>;
            totalEstimatedCost?: unknown;
          };
          campingStrategy?: {
            hasCamping?: boolean;
            firewoodCount?: number;
            ambushPrevention?: { isAvailable?: boolean };
            respitePointPlan?: string[];
          };
        };
      }
    | undefined;
  assert.ok(planContent?.plan?.quest?.id);
  assert.ok(planContent?.plan?.rolePool?.frontlineDps);
  assert.ok(planContent?.plan?.provisions?.items);
  assert.ok(Number(planContent?.plan?.provisions?.totalEstimatedCost) > 0);
  assert.ok(planContent?.plan?.campingStrategy);
  assert.ok(planContent?.plan?.campingStrategy?.respitePointPlan);

  const upgradeRecResult = await client.callTool({
    name: "recommend_building_upgrades",
    arguments: { language: "ko" },
  });
  const upgradeRecContent = upgradeRecResult.structuredContent as
    | {
        recommendations?: {
          estateResources?: unknown[];
          topPriorities?: unknown[];
          immediateAffordableOptions?: unknown[];
          strategicGuidance?: unknown[];
        };
      }
    | undefined;
  assert.ok(upgradeRecContent?.recommendations?.estateResources);
  assert.ok(upgradeRecContent?.recommendations?.topPriorities);
  assert.ok(upgradeRecContent?.recommendations?.strategicGuidance);
});

test("list_trinkets rejects definition-backed filters without game data", async (t) => {
  const server = createDarkestDungeonServer(new SampleGameStateDataSource());
  const client = new Client({ name: "mcp-test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  t.after(async () => {
    await client.close();
    await server.close();
  });

  const result = await client.callTool({
    name: "list_trinkets",
    arguments: { heroClass: "hellion" },
  });
  assert.equal(result.isError, true);
  assert.match(
    result.content[0]?.type === "text" ? result.content[0].text : "",
    /DD_GAME_DIR/,
  );
});
