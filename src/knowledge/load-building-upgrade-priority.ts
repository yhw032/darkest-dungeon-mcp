import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { BuildingUpgradePriorityKnowledge } from "../domain/building-upgrade-recommendations.js";

const defaultPath = fileURLToPath(
  new URL("../../data/knowledge/building-upgrade-priority.json", import.meta.url),
);

export async function loadBuildingUpgradePriorityKnowledge(
  path = defaultPath,
): Promise<BuildingUpgradePriorityKnowledge> {
  const text = await readFile(path, "utf8");
  const data = JSON.parse(text) as BuildingUpgradePriorityKnowledge;
  return data;
}
