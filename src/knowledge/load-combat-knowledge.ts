import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { CombatKnowledgeBase } from "../domain/combat-knowledge.js";
import { parseCombatKnowledgeJson } from "./combat-knowledge-schema.js";

const defaultKnowledgePath = fileURLToPath(
  new URL("../../data/knowledge/combat.json", import.meta.url),
);

export async function loadCombatKnowledge(
  path = defaultKnowledgePath,
): Promise<CombatKnowledgeBase> {
  return parseCombatKnowledgeJson(await readFile(path, "utf8"));
}
