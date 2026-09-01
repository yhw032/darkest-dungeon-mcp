import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { ClassKnowledgeBase } from "../domain/class-knowledge.js";
import { parseClassKnowledgeJson } from "./class-knowledge-schema.js";

const defaultKnowledgePath = fileURLToPath(
  new URL("../../data/knowledge/classes.json", import.meta.url),
);

export async function loadClassKnowledge(
  path = defaultKnowledgePath,
): Promise<ClassKnowledgeBase> {
  return parseClassKnowledgeJson(await readFile(path, "utf8"));
}
