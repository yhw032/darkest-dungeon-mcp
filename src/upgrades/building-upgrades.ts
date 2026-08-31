import { readdir, readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import type {
  BuildingUpgradeProgress,
  BuildingUpgradeRequirement,
  BuildingUpgradeTree,
  UpgradeCurrencyCost,
} from "../domain/building-upgrades.js";
import type { UpgradeState } from "../domain/upgrades.js";
import {
  expectArray,
  expectBoolean,
  expectNumber,
  expectRecord,
  expectString,
} from "../parser/roster-schema.js";

export function darkestDungeonStringHash(value: string): number {
  let hash = 0;
  for (const byte of Buffer.from(value, "utf8")) {
    hash = (Math.imul(hash, 53) + byte) | 0;
  }
  return hash;
}

function parseCurrencyCost(value: unknown, path: string): UpgradeCurrencyCost {
  const cost = expectRecord(value, path);
  return {
    type: expectString(cost.type, `${path}.type`),
    amount: expectNumber(cost.amount, `${path}.amount`),
  };
}

function parseRequirement(
  value: unknown,
  path: string,
): BuildingUpgradeRequirement {
  const requirement = expectRecord(value, path);
  const currencyCost = expectArray(
    requirement.currency_cost,
    `${path}.currency_cost`,
  );
  return {
    code: expectString(requirement.code, `${path}.code`),
    currencyCost: currencyCost.map((cost, index) =>
      parseCurrencyCost(cost, `${path}.currency_cost[${String(index)}]`),
    ),
  };
}

export function parseBuildingUpgradeTrees(
  value: unknown,
  sourceName: string,
): BuildingUpgradeTree[] {
  const document = expectRecord(value, sourceName);
  const rawTrees = expectArray(document.trees, `${sourceName}.trees`);
  const buildingId = basename(sourceName, ".upgrades.json");

  return rawTrees.map((rawTree, treeIndex) => {
    const treePath = `${sourceName}.trees[${String(treeIndex)}]`;
    const tree = expectRecord(rawTree, treePath);
    expectBoolean(tree.is_instanced, `${treePath}.is_instanced`);
    const requirements = expectArray(
      tree.requirements,
      `${treePath}.requirements`,
    );
    const id = expectString(tree.id, `${treePath}.id`);
    return {
      id,
      hash: darkestDungeonStringHash(id),
      buildingId,
      requirements: requirements.map((requirement, index) =>
        parseRequirement(
          requirement,
          `${treePath}.requirements[${String(index)}]`,
        ),
      ),
    };
  });
}

export async function loadBuildingUpgradeTrees(
  gameDirectory: string,
): Promise<BuildingUpgradeTree[]> {
  const directory = resolve(gameDirectory, "upgrades", "building");
  const files = (await readdir(directory, { withFileTypes: true }))
    .filter(
      (entry) => entry.isFile() && entry.name.endsWith(".upgrades.json"),
    )
    .map((entry) => entry.name)
    .sort();

  const treeGroups = await Promise.all(
    files.map(async (fileName) => {
      const text = await readFile(join(directory, fileName), "utf8");
      return parseBuildingUpgradeTrees(JSON.parse(text) as unknown, fileName);
    }),
  );
  return treeGroups.flat();
}

export function getBuildingUpgradeProgress(
  upgrades: UpgradeState,
  trees: BuildingUpgradeTree[],
): BuildingUpgradeProgress[] {
  return trees.map((tree) => {
    const purchased = new Set(
      upgrades.purchases
        .filter(
          (purchase) =>
            purchase.instanceNumber === 0 &&
            purchase.treeId === tree.hash &&
            purchase.isPurchased,
        )
        .map((purchase) => purchase.requirementCode),
    );
    const purchasedCodes = tree.requirements
      .map((requirement) => requirement.code)
      .filter((code) => purchased.has(code));
    const nextRequirement =
      tree.requirements.find((requirement) => !purchased.has(requirement.code)) ??
      null;

    return {
      treeId: tree.id,
      buildingId: tree.buildingId,
      purchasedCodes,
      purchasedCount: purchasedCodes.length,
      totalCount: tree.requirements.length,
      highestPurchasedCode: purchasedCodes.at(-1) ?? null,
      nextRequirement,
      isComplete: purchasedCodes.length === tree.requirements.length,
    };
  });
}
