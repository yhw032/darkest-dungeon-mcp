import { readdir, readFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import type {
  HeroCombatSkillPositionDefinition,
  HeroCombatSkillTarget,
} from "../domain/hero-skills.js";

function capture(text: string, pattern: RegExp, field: string): string {
  const value = pattern.exec(text)?.[1];
  if (value === undefined) throw new Error(`Combat skill is missing ${field}`);
  return value;
}

function ranks(value: string, field: string): number[] {
  const parsed = [...value].map(Number).sort((left, right) => left - right);
  if (parsed.length === 0 || parsed.some((rank) => rank < 1 || rank > 4)) {
    throw new Error(`Combat skill has invalid ${field}: ${value}`);
  }
  return [...new Set(parsed)];
}

function parseTarget(line: string): HeroCombatSkillTarget {
  const match =
    /(?:^|\s)\.target\s*([@~?]*)([1-4]*)(?=\s+\.|\s*$)/.exec(line);
  if (match === null) throw new Error("Combat skill is missing target");
  const modifiers = match[1] ?? "";
  const rankText = match[2] ?? "";
  if (rankText === "") return { side: "self", mode: "single", ranks: [] };
  return {
    side: modifiers.includes("@") ? "ally" : "enemy",
    mode: modifiers.includes("?")
      ? "random"
      : modifiers.includes("~")
        ? "group"
        : "single",
    ranks: ranks(rankText, "target ranks"),
  };
}

function parseMovement(line: string): { backward: number; forward: number } {
  const match = /(?:^|\s)\.move\s+(\d+)\s+(\d+)(?=\s+\.|\s*$)/.exec(line);
  return match === null
    ? { backward: 0, forward: 0 }
    : { backward: Number(match[1]), forward: Number(match[2]) };
}

export function parseHeroCombatSkillPositions(
  text: string,
  heroClass: string,
): HeroCombatSkillPositionDefinition[] {
  const bySkill = new Map<string, HeroCombatSkillPositionDefinition>();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trimStart().startsWith("combat_skill:")) continue;
    const level = Number(capture(line, /(?:^|\s)\.level\s+(\d+)/, "level"));
    if (level !== 0) continue;
    const skillId = capture(line, /(?:^|\s)\.id\s+"([^"]+)"/, "id");
    const launch = capture(line, /(?:^|\s)\.launch\s+([1-4]+)/, "launch");
    if (bySkill.has(skillId)) {
      throw new Error(
        `Duplicate level-zero combat skill: ${heroClass}.${skillId}`,
      );
    }
    bySkill.set(skillId, {
      heroClass,
      skillId,
      usableFromRanks: ranks(launch, "launch ranks"),
      target: parseTarget(line),
      movement: parseMovement(line),
    });
  }
  return [...bySkill.values()];
}

async function findInfoFiles(directory: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === "modes") continue;
    const child = join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...await findInfoFiles(child));
    } else if (entry.isFile() && entry.name.endsWith(".info.darkest")) {
      result.push(child);
    }
  }
  return result;
}

export async function loadHeroCombatSkillPositions(
  gameDirectory: string,
): Promise<HeroCombatSkillPositionDefinition[]> {
  const files = await findInfoFiles(resolve(gameDirectory, "heroes"));
  try {
    files.push(...await findInfoFiles(resolve(gameDirectory, "dlc")));
  } catch (error) {
    if (
      !(
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
      )
    ) {
      throw error;
    }
  }
  const heroFiles = files.filter((path) =>
    path.toLocaleLowerCase("en-US").split(/[\\/]/).includes("heroes"),
  );
  const definitions = (
    await Promise.all(
      heroFiles.sort().map(async (path) => {
        const heroClass = basename(dirname(path));
        return parseHeroCombatSkillPositions(
          await readFile(path, "utf8"),
          heroClass,
        );
      }),
    )
  ).flat();
  return [
    ...new Map(
      definitions.map((definition) => [
        `${definition.heroClass}.${definition.skillId}`,
        definition,
      ]),
    ).values(),
  ];
}
