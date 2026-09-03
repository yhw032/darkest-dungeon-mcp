import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { TrinketGuidanceKnowledgeBase } from "../domain/trinket-guidance.js";
import { parseTrinketGuidanceKnowledgeJson } from "./trinket-guidance-schema.js";

const defaultKnowledgePath = fileURLToPath(
  new URL("../../data/knowledge/trinkets.json", import.meta.url),
);

export async function loadTrinketGuidance(
  path = defaultKnowledgePath,
): Promise<TrinketGuidanceKnowledgeBase> {
  return parseTrinketGuidanceKnowledgeJson(await readFile(path, "utf8"), path);
}
