import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { UpgradeState } from "../src/domain/upgrades.js";
import {
  darkestDungeonStringHash,
  getBuildingUpgradeProgress,
  loadBuildingUpgradeTrees,
  parseBuildingUpgradeTrees,
} from "../src/upgrades/building-upgrades.js";

function guildDefinition(): unknown {
  return {
    trees: [
      {
        id: "guild.skill_levels",
        is_instanced: false,
        tags: ["building", "guild"],
        requirements: [
          {
            code: "a",
            currency_cost: [
              { type: "portrait", amount: 6 },
              { type: "crest", amount: 14 },
            ],
            prerequisite_requirements: [],
          },
          {
            code: "b",
            currency_cost: [
              { type: "portrait", amount: 15 },
              { type: "crest", amount: 38 },
            ],
            prerequisite_requirements: [],
          },
        ],
      },
    ],
  };
}

test("matches the signed hash used by Darkest Dungeon saves", () => {
  assert.equal(darkestDungeonStringHash("guild.skill_levels"), -166715556);
  assert.equal(darkestDungeonStringHash("blacksmith.weapon"), -884840462);
});

test("parses building upgrade definitions and costs", () => {
  const trees = parseBuildingUpgradeTrees(
    guildDefinition(),
    "guild.upgrades.json",
  );

  assert.deepEqual(trees, [
    {
      id: "guild.skill_levels",
      hash: -166715556,
      buildingId: "guild",
      requirements: [
        {
          code: "a",
          currencyCost: [
            { type: "portrait", amount: 6 },
            { type: "crest", amount: 14 },
          ],
        },
        {
          code: "b",
          currencyCost: [
            { type: "portrait", amount: 15 },
            { type: "crest", amount: 38 },
          ],
        },
      ],
    },
  ]);
});

test("maps non-instanced save purchases to building progress", () => {
  const upgrades: UpgradeState = {
    version: 1,
    purchases: [
      {
        id: "0",
        instanceNumber: 0,
        treeId: -166715556,
        requirementCode: "a",
        isPurchased: true,
      },
      {
        id: "1",
        instanceNumber: 18,
        treeId: -166715556,
        requirementCode: "b",
        isPurchased: true,
      },
    ],
  };
  const trees = parseBuildingUpgradeTrees(
    guildDefinition(),
    "guild.upgrades.json",
  );

  assert.deepEqual(getBuildingUpgradeProgress(upgrades, trees), [
    {
      treeId: "guild.skill_levels",
      buildingId: "guild",
      purchasedCodes: ["a"],
      purchasedCount: 1,
      totalCount: 2,
      highestPurchasedCode: "a",
      nextRequirement: {
        code: "b",
        currencyCost: [
          { type: "portrait", amount: 15 },
          { type: "crest", amount: 38 },
        ],
      },
      isComplete: false,
    },
  ]);
});

test("loads only base building definitions from the game directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "ddmcp-upgrade-definitions-"));
  try {
    const directory = join(root, "upgrades", "building");
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, "guild.upgrades.json"),
      JSON.stringify(guildDefinition()),
      "utf8",
    );
    await writeFile(join(directory, "ignored.txt"), "ignored", "utf8");

    const trees = await loadBuildingUpgradeTrees(root);

    assert.equal(trees.length, 1);
    assert.equal(trees[0]?.id, "guild.skill_levels");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
