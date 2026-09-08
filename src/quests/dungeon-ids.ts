import type { CombatRegionId } from "../domain/combat-knowledge.js";

const saveDungeonIdByAlias: Readonly<Record<string, string>> = {
  ruins: "crypts",
  crypts: "crypts",
  farmstead: "farm",
  farm: "farm",
  darkest_dungeon: "darkestdungeon",
  darkestdungeon: "darkestdungeon",
};

const combatRegionIdBySaveDungeonId: Readonly<
  Partial<Record<string, CombatRegionId>>
> = {
  crypts: "ruins",
  warrens: "warrens",
  weald: "weald",
  cove: "cove",
  courtyard: "courtyard",
  farm: "farmstead",
  darkestdungeon: "darkest_dungeon",
};

export function normalizeSaveDungeonId(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return saveDungeonIdByAlias[normalized] ?? normalized;
}

export function getCombatRegionId(
  dungeonId: string,
): CombatRegionId | undefined {
  return combatRegionIdBySaveDungeonId[normalizeSaveDungeonId(dungeonId)];
}
