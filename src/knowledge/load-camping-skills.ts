import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { CampingSkillKnowledgeBase } from "../domain/camping-skills.js";

const defaultPath = fileURLToPath(
  new URL("../../data/knowledge/camping-skills.json", import.meta.url),
);

export async function loadCampingSkills(
  path = defaultPath,
): Promise<CampingSkillKnowledgeBase> {
  const text = await readFile(path, "utf8");
  return JSON.parse(text) as CampingSkillKnowledgeBase;
}
