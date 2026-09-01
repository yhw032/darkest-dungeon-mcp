import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { Quest } from "../domain/quest.js";
import type {
  QuestEligibility,
  QuestRestrictionRules,
} from "../domain/quest-restrictions.js";
import {
  expectArray,
  expectNumber,
  expectRecord,
} from "../parser/roster-schema.js";

export function parseQuestRestrictionRules(
  value: unknown,
  sourceName: string,
): QuestRestrictionRules {
  const document = expectRecord(value, sourceName);
  const restriction = expectRecord(
    document.restriction,
    `${sourceName}.restriction`,
  );
  const difficulty = expectRecord(
    restriction.difficulty,
    `${sourceName}.restriction.difficulty`,
  );
  const table = expectArray(
    difficulty.resolve_level_threshold_table,
    `${sourceName}.restriction.difficulty.resolve_level_threshold_table`,
  ).map((entry, index) => {
    const maximum = expectNumber(
      entry,
      `${sourceName}.restriction.difficulty.resolve_level_threshold_table[${String(index)}]`,
    );
    if (!Number.isInteger(maximum) || maximum < 0) {
      throw new Error(
        `${sourceName}.restriction.difficulty.resolve_level_threshold_table[${String(index)}] must be a non-negative integer`,
      );
    }
    return maximum;
  });
  if (table.length === 0) {
    throw new Error(
      `${sourceName}.restriction.difficulty.resolve_level_threshold_table must not be empty`,
    );
  }
  return { maximumResolveLevelByDifficulty: table };
}

export async function loadQuestRestrictionRules(
  gameDirectory: string,
): Promise<QuestRestrictionRules> {
  const path = resolve(
    gameDirectory,
    "campaign",
    "quest",
    "quest.restriction.json",
  );
  return parseQuestRestrictionRules(
    JSON.parse(await readFile(path, "utf8")) as unknown,
    "quest.restriction.json",
  );
}

export function getQuestEligibility(
  quest: Quest,
  resolveLevel: number | null,
  rules?: QuestRestrictionRules,
): QuestEligibility {
  if (rules === undefined) {
    return {
      questId: quest.id,
      questDifficulty: quest.difficulty,
      status: "unknown",
      isEligible: null,
      maximumResolveLevel: null,
      reason: "restriction_rules_unavailable",
    };
  }
  const configuredMaximum =
    rules.maximumResolveLevelByDifficulty[quest.difficulty];
  if (configuredMaximum === undefined) {
    return {
      questId: quest.id,
      questDifficulty: quest.difficulty,
      status: "unknown",
      isEligible: null,
      maximumResolveLevel: null,
      reason: "quest_difficulty_undefined",
    };
  }
  const maximumResolveLevel = configuredMaximum >= 99
    ? null
    : configuredMaximum;
  if (resolveLevel === null) {
    return {
      questId: quest.id,
      questDifficulty: quest.difficulty,
      status: "unknown",
      isEligible: null,
      maximumResolveLevel,
      reason: "resolve_level_unavailable",
    };
  }
  const isEligible =
    maximumResolveLevel === null || resolveLevel <= maximumResolveLevel;
  return {
    questId: quest.id,
    questDifficulty: quest.difficulty,
    status: isEligible ? "eligible" : "ineligible",
    isEligible,
    maximumResolveLevel,
    reason: isEligible ? null : "resolve_level_too_high",
  };
}
