import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { QuirkTreatmentKnowledgeBase } from "../domain/quirk-treatment-knowledge.js";
import { parseQuirkTreatmentKnowledgeJson } from "./quirk-treatment-schema.js";

const defaultKnowledgePath = fileURLToPath(
  new URL("../../data/knowledge/quirk-treatment.json", import.meta.url),
);

export async function loadQuirkTreatmentKnowledge(
  path = defaultKnowledgePath,
): Promise<QuirkTreatmentKnowledgeBase> {
  return parseQuirkTreatmentKnowledgeJson(await readFile(path, "utf8"));
}
