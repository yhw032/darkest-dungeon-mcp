import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { CurioKnowledgeBase } from "../domain/curio-knowledge.js";
import { parseCurioKnowledgeJson } from "./curio-schema.js";

const defaultKnowledgePath = fileURLToPath(
  new URL("../../data/knowledge/curios.json", import.meta.url),
);

export async function loadCurioKnowledge(
  path = defaultKnowledgePath,
): Promise<CurioKnowledgeBase> {
  return parseCurioKnowledgeJson(await readFile(path, "utf8"));
}
