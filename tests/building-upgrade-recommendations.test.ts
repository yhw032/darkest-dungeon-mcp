import assert from "node:assert/strict";
import test from "node:test";

import type { BuildingUpgradeTree } from "../src/domain/building-upgrades.js";
import type { BuildingUpgradePriorityKnowledge } from "../src/domain/building-upgrade-recommendations.js";
import type { GameState } from "../src/domain/game-state.js";
import { recommendBuildingUpgrades } from "../src/queries/recommend-building-upgrades.js";

const mockTrees: BuildingUpgradeTree[] = [
  {
    id: "weaponsmithing",
    hash: 101,
    buildingId: "blacksmith",
    requirements: [
      {
        code: "blacksmith.weapon.1",
        currencyCost: [
          { type: "deed", amount: 10 },
          { type: "crest", amount: 20 },
        ],
      },
      {
        code: "blacksmith.weapon.2",
        currencyCost: [
          { type: "deed", amount: 20 },
          { type: "crest", amount: 35 },
        ],
      },
    ],
  },
  {
    id: "network",
    hash: 102,
    buildingId: "stage_coach",
    requirements: [
      {
        code: "stage_coach.network.1",
        currencyCost: [
          { type: "deed", amount: 3 },
          { type: "crest", amount: 10 },
        ],
      },
    ],
  },
  {
    id: "roster_size",
    hash: 103,
    buildingId: "stage_coach",
    requirements: [
      {
        code: "stage_coach.roster.1",
        currencyCost: [
          { type: "portrait", amount: 4 },
          { type: "crest", amount: 15 },
        ],
      },
    ],
  },
  {
    id: "bar",
    hash: 104,
    buildingId: "tavern",
    requirements: [
      {
        code: "tavern.bar.1",
        currencyCost: [
          { type: "portrait", amount: 4 },
          { type: "crest", amount: 15 },
        ],
      },
    ],
  },
];

const mockPriorityKnowledge: BuildingUpgradePriorityKnowledge = {
  schemaVersion: 1,
  farmingRegionsByHeirloom: {
    deed: ["weald"],
    portrait: ["warrens"],
    bust: ["ruins"],
    crest: ["ruins", "warrens", "weald", "cove"],
  },
  treePriorities: [
    {
      buildingId: "blacksmith",
      treeId: "weaponsmithing",
      priorityTier: "S",
      strategicImportance: "무기 공격력 강화",
    },
    {
      buildingId: "stage_coach",
      treeId: "network",
      priorityTier: "S",
      strategicImportance: "신병 공급 풀 확장",
    },
    {
      buildingId: "stage_coach",
      treeId: "roster_size",
      priorityTier: "A",
      strategicImportance: "영웅 정원 확장",
    },
    {
      buildingId: "tavern",
      treeId: "bar",
      priorityTier: "C",
      strategicImportance: "술집 슬롯 확장",
    },
  ],
};

function createMockGameState(resources: Array<{ type: string; amount: number }>, purchasedCodes: string[] = []): GameState {
  return {
    roster: { version: 1, nextGuid: 1, heroes: [] },
    quests: { version: 1, plotQuestTotal: 0, quests: [] },
    estate: {
      version: 1,
      resources,
      trinkets: [],
      estateItems: [],
    },
    town: { version: 1, buildings: [], districts: [] },
    upgrades: {
      version: 1,
      purchases: purchasedCodes.map((code, index) => ({
        id: `p_${index}`,
        instanceNumber: 0,
        treeId: 101, // for mock
        requirementCode: code,
        isPurchased: true,
      })),
    },
  };
}

test("categorizes S/A tiers as topPriorities and keeps C tiers out of top priorities", () => {
  const state = createMockGameState([
    { type: "deed", amount: 5 },
    { type: "crest", amount: 30 },
    { type: "portrait", amount: 10 },
  ]);

  const result = recommendBuildingUpgrades(
    state,
    mockTrees,
    mockPriorityKnowledge,
    { language: "en" },
  );

  assert.ok(result.topPriorities.length > 0);
  assert.ok(result.topPriorities.every((r) => r.priorityTier === "S" || r.priorityTier === "A"));
  assert.ok(!result.topPriorities.some((r) => r.buildingId === "tavern"));
});

test("accurately calculates missing heirloom amounts and matches primary farming dungeons", () => {
  // Deed is 5, weaponsmithing needs 10 deeds -> missing 5
  const state = createMockGameState([
    { type: "deed", amount: 5 },
    { type: "crest", amount: 50 },
  ]);

  const result = recommendBuildingUpgrades(
    state,
    mockTrees,
    mockPriorityKnowledge,
    { language: "en" },
  );

  const weaponRec = result.topPriorities.find((r) => r.treeId === "weaponsmithing");
  assert.ok(weaponRec);
  assert.equal(weaponRec.isAffordable, false);

  const deedCost = weaponRec.costs.find((c) => c.type === "deed");
  assert.ok(deedCost);
  assert.equal(deedCost.current, 5);
  assert.equal(deedCost.required, 10);
  assert.equal(deedCost.missing, 5);

  // Weald should be recommended for Deed farming
  assert.ok(weaponRec.recommendedFarmingRegions.includes("weald"));
});

test("simulates heirloom exchange possibility when surplus heirlooms exist", () => {
  // Deed needed: 10, current: 2 -> missing 8 deeds (worth 24 points)
  // Surplus Bust: 30 (worth 90 points)
  const state = createMockGameState([
    { type: "deed", amount: 2 },
    { type: "crest", amount: 50 },
    { type: "bust", amount: 30 },
  ]);

  const result = recommendBuildingUpgrades(
    state,
    mockTrees,
    mockPriorityKnowledge,
    { language: "en" },
  );

  const weaponRec = result.topPriorities.find((r) => r.treeId === "weaponsmithing");
  assert.ok(weaponRec);
  assert.equal(weaponRec.isAffordable, false);
  assert.equal(weaponRec.exchangePossibility.canAffordViaExchange, true);
  assert.ok(weaponRec.exchangePossibility.recommendedExchanges.length > 0);
  assert.equal(weaponRec.exchangePossibility.recommendedExchanges[0]?.sourceType, "bust");
  assert.equal(weaponRec.exchangePossibility.recommendedExchanges[0]?.targetType, "deed");
});

test("separates immediately affordable options across all tiers", () => {
  // Can afford network (deed 3, crest 10) and roster_size (portrait 4, crest 15) and bar (portrait 4, crest 15)
  // but cannot afford weaponsmithing (deed 10)
  const state = createMockGameState([
    { type: "deed", amount: 5 },
    { type: "portrait", amount: 10 },
    { type: "crest", amount: 50 },
  ]);

  const result = recommendBuildingUpgrades(
    state,
    mockTrees,
    mockPriorityKnowledge,
    { language: "en" },
  );

  assert.ok(result.immediateAffordableOptions.length > 0);
  assert.ok(result.immediateAffordableOptions.every((r) => r.isAffordable));
  // Weaponsmithing is not affordable, so it should not be in immediateAffordableOptions
  assert.ok(!result.immediateAffordableOptions.some((r) => r.treeId === "weaponsmithing"));
  // But network and roster_size should be in immediateAffordableOptions
  assert.ok(result.immediateAffordableOptions.some((r) => r.treeId === "network"));
  assert.ok(result.immediateAffordableOptions.some((r) => r.treeId === "roster_size"));
});
