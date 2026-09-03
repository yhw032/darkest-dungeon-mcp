import assert from "node:assert/strict";
import test from "node:test";

import {
  localizeBuildingUpgradeProgress,
  localizeHeroTownContext,
  localizeTownSummary,
} from "../src/queries/localize-town.js";

const localization = new Map([
  [
    "koreana",
    new Map([
      ["town_name_abbey", "수도원"],
      ["town_activity_name_meditation", "명상실"],
      ["str_bank_title", "은행"],
      ["upgrade_tree_name_abbey.meditation", "명상실"],
      ["str_inventory_title_heirloomportrait", "초상화"],
    ]),
  ],
]);

test("localizes hero town activity context", () => {
  const result = localizeHeroTownContext(
    {
      buildingName: "abbey",
      activityAssignments: [
        {
          buildingId: "abbey",
          activityId: "meditation",
          slotId: "slot_0",
          visitsRemaining: 1,
          residentOccupied: 0,
          isSideEffectResult: false,
        },
      ],
    },
    "ko",
    localization,
  );

  assert.equal(result.buildingId, "abbey");
  assert.equal(result.buildingName, "수도원");
  assert.equal(result.activityAssignments[0]?.buildingName, "수도원");
  assert.equal(result.activityAssignments[0]?.activityName, "명상실");
});

test("localizes building upgrade and heirloom names", () => {
  const result = localizeBuildingUpgradeProgress(
    {
      treeId: "abbey.meditation",
      buildingId: "abbey",
      purchasedCodes: [],
      purchasedCount: 0,
      totalCount: 1,
      highestPurchasedCode: null,
      nextRequirement: {
        code: "a",
        currencyCost: [{ type: "portrait", amount: 10 }],
      },
      isComplete: false,
    },
    "ko",
    localization,
  );

  assert.equal(result.treeName, "명상실");
  assert.equal(result.buildingName, "수도원");
  assert.equal(result.nextRequirement?.currencyCost[0]?.name, "초상화");
});

test("adds localized details without replacing stable district ids", () => {
  const result = localizeTownSummary(
    { builtDistricts: ["bank"] },
    "ko",
    localization,
  );

  assert.deepEqual(result.builtDistricts, ["bank"]);
  assert.deepEqual(result.builtDistrictDetails, [
    { id: "bank", name: "은행" },
  ]);
});
