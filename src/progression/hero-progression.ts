import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { Hero } from "../domain/hero.js";
import type {
  HeroAvailability,
  HeroProgressionRules,
} from "../domain/hero-progression.js";
import type { HeroTownContext } from "../queries/get-hero-town-context.js";
import {
  expectArray,
  expectNumber,
  expectRecord,
} from "../parser/roster-schema.js";

export function parseHeroProgressionRules(
  value: unknown,
  sourceName: string,
): HeroProgressionRules {
  const document = expectRecord(value, sourceName);
  const thresholds = expectArray(
    document.resolve_level_thresholds,
    `${sourceName}.resolve_level_thresholds`,
  ).map((threshold, index) =>
    expectNumber(
      threshold,
      `${sourceName}.resolve_level_thresholds[${String(index)}]`,
    ),
  );
  if (thresholds.length === 0) {
    throw new Error(`${sourceName}.resolve_level_thresholds must not be empty`);
  }
  if (thresholds.some((threshold, index) => index > 0 && threshold <= thresholds[index - 1]!)) {
    throw new Error(`${sourceName}.resolve_level_thresholds must be strictly increasing`);
  }
  return { resolveLevelThresholds: thresholds };
}

export async function loadHeroProgressionRules(
  gameDirectory: string,
): Promise<HeroProgressionRules> {
  const path = resolve(
    gameDirectory,
    "campaign",
    "roster",
    "roster.variables.json",
  );
  return parseHeroProgressionRules(
    JSON.parse(await readFile(path, "utf8")) as unknown,
    "roster.variables.json",
  );
}

export function getResolveLevel(
  resolveXp: number,
  rules?: HeroProgressionRules,
): number | null {
  if (rules === undefined) return null;
  let level = 0;
  for (const [index, threshold] of rules.resolveLevelThresholds.entries()) {
    if (resolveXp < threshold) break;
    level = index;
  }
  return level;
}

export function getHeroAvailability(
  hero: Hero,
  townContext: HeroTownContext,
): HeroAvailability {
  const reasons: HeroAvailability["reasons"] = [];
  if (hero.rosterStatus === 1) reasons.push("already_selected_for_raid");
  else if (hero.rosterStatus !== 0) reasons.push("roster_status_unavailable");
  if (
    hero.buildingName !== null ||
    townContext.activityAssignments.length > 0
  ) {
    reasons.push("assigned_to_town_activity");
  }
  return {
    isAvailableForPartySelection: reasons.length === 0,
    reasons,
  };
}
