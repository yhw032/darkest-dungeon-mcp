import { readdir, readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import type {
  HeroCombatSkillDetail,
  HeroCombatSkillPositionDefinition,
  HeroCombatSkillTree,
} from "../domain/hero-skills.js";
import type { Hero } from "../domain/hero.js";
import type { UpgradeState } from "../domain/upgrades.js";
import {
  expectArray,
  expectBoolean,
  expectRecord,
  expectString,
} from "../parser/roster-schema.js";
import { darkestDungeonStringHash } from "./building-upgrades.js";

function parseTags(value: unknown, path: string): string[] {
  return expectArray(value, path).map((tag, index) =>
    expectString(tag, `${path}[${String(index)}]`),
  );
}

export function parseHeroCombatSkillTrees(
  value: unknown,
  sourceName: string,
): HeroCombatSkillTree[] {
  const document = expectRecord(value, sourceName);
  const rawTrees = expectArray(document.trees, `${sourceName}.trees`);
  const heroClass = basename(sourceName, ".upgrades.json");

  return rawTrees.flatMap((rawTree, treeIndex) => {
    const path = `${sourceName}.trees[${String(treeIndex)}]`;
    const tree = expectRecord(rawTree, path);
    const isInstanced = expectBoolean(tree.is_instanced, `${path}.is_instanced`);
    const tags = parseTags(tree.tags, `${path}.tags`);
    if (!isInstanced || !tags.includes("combat_skill")) return [];

    const id = expectString(tree.id, `${path}.id`);
    const prefix = `${heroClass}.`;
    if (!id.startsWith(prefix) || id.length === prefix.length) {
      throw new Error(`${path}.id does not identify a ${heroClass} skill`);
    }
    const requirements = expectArray(tree.requirements, `${path}.requirements`);
    return [
      {
        id,
        hash: darkestDungeonStringHash(id),
        heroClass,
        skillId: id.slice(prefix.length),
        requirementCodes: requirements.map((requirement, index) => {
          const requirementPath = `${path}.requirements[${String(index)}]`;
          return expectString(
            expectRecord(requirement, requirementPath).code,
            `${requirementPath}.code`,
          );
        }),
      },
    ];
  });
}

export async function loadHeroCombatSkillTrees(
  gameDirectory: string,
): Promise<HeroCombatSkillTree[]> {
  const baseDirectory = resolve(gameDirectory, "upgrades", "heroes");
  const definitionFiles = await listDefinitionFiles(baseDirectory);
  const dlcDirectory = resolve(gameDirectory, "dlc");
  try {
    definitionFiles.push(...(await findDlcDefinitionFiles(dlcDirectory)));
  } catch (error) {
    const isMissingDirectory =
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT";
    if (!isMissingDirectory) throw error;
  }
  const groups = await Promise.all(
    definitionFiles.map(async (path) =>
      parseHeroCombatSkillTrees(
        JSON.parse(await readFile(path, "utf8")) as unknown,
        basename(path),
      ),
    ),
  );
  return [...new Map(groups.flat().map((tree) => [tree.id, tree])).values()];
}

async function listDefinitionFiles(directory: string): Promise<string[]> {
  return (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".upgrades.json"))
    .map((entry) => join(directory, entry.name))
    .sort();
}

async function findDlcDefinitionFiles(directory: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "modes") continue;
    const child = join(directory, entry.name);
    if (basename(directory) === "upgrades" && entry.name === "heroes") {
      result.push(...await listDefinitionFiles(child));
    } else {
      result.push(...await findDlcDefinitionFiles(child));
    }
  }
  return result;
}

export function getHeroCombatSkillDetails(
  hero: Hero,
  upgrades: UpgradeState,
  trees?: HeroCombatSkillTree[],
  positions?: HeroCombatSkillPositionDefinition[],
): HeroCombatSkillDetail[] {
  const selections = new Map(
    hero.combatSkillSelections.map(({ id, rawSelectionValue }) => [
      id,
      rawSelectionValue,
    ]),
  );
  const classTrees = trees?.filter((tree) => tree.heroClass === hero.heroClass);
  const positionBySkill = new Map(
    positions
      ?.filter((definition) => definition.heroClass === hero.heroClass)
      .map((definition) => [definition.skillId, definition]),
  );
  const positionFields = (id: string) => {
    const position = positionBySkill.get(id);
    return position === undefined
      ? { usableFromPartyPositions: null, target: null, movement: null }
      : {
          usableFromPartyPositions: [
            ...position.usableFromPartyPositions,
          ],
          target: {
            ...position.target,
            positions: [...position.target.positions],
          },
          movement: { ...position.movement },
        };
  };
  if (classTrees === undefined || classTrees.length === 0) {
    return hero.combatSkills.map((id) => ({
      id,
      level: null,
      isSelected: true,
      rawSelectionValue: selections.get(id) ?? null,
      ...positionFields(id),
    }));
  }

  const heroId = Number(hero.id);
  return classTrees.map((tree) => {
    const purchasedCodes = new Set(
      upgrades.purchases
        .filter(
          (purchase) =>
            Number.isFinite(heroId) &&
            purchase.instanceNumber === heroId &&
            purchase.treeId === tree.hash &&
            purchase.isPurchased,
        )
        .map((purchase) => purchase.requirementCode),
    );
    const highestPurchasedIndex = tree.requirementCodes.reduce(
      (highest, code, index) => (purchasedCodes.has(code) ? index : highest),
      -1,
    );
    return {
      id: tree.skillId,
      level: highestPurchasedIndex === -1 ? null : highestPurchasedIndex + 1,
      isSelected: selections.has(tree.skillId),
      rawSelectionValue: selections.get(tree.skillId) ?? null,
      ...positionFields(tree.skillId),
    };
  });
}
