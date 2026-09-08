import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import type {
  QuirkBuffEffect,
  QuirkDefinition,
  QuirkLocalizedText,
} from "../domain/quirk-definitions.js";
import {
  gameLanguageCodes,
  getGameLocalizationId,
  supportedGameLocalizationIds,
  type GameLanguage,
} from "../localization/languages.js";
import {
  mergeStringTables,
  parseStringTableXml,
  type LocalizationByLanguage,
} from "../localization/string-table.js";
import {
  expectArray,
  expectBoolean,
  expectNumber,
  expectRecord,
  expectString,
  optionalBoolean,
} from "../parser/roster-schema.js";

interface GameDataFile {
  path: readonly string[];
  optional: boolean;
}

interface RawQuirkDefinition {
  id: string;
  isPositive: boolean;
  isDisease: boolean;
  classification: string;
  incompatibleQuirks: string[];
  curioTag: string | null;
  curioTagChance: number;
  keepsLoot: boolean;
  canModifyInActivity: boolean;
  canBeReplacedByNewQuirk: boolean;
  buffIds: string[];
}

const quirkFiles: readonly GameDataFile[] = [
  { path: ["shared", "quirk", "quirk_library.json"], optional: false },
  {
    path: [
      "dlc",
      "580100_crimson_court",
      "features",
      "crimson_court",
      "shared",
      "quirk",
      "crimson_court.quirk_library.json",
    ],
    optional: true,
  },
  {
    path: [
      "dlc",
      "735730_color_of_madness",
      "shared",
      "quirk",
      "com.quirk_library.json",
    ],
    optional: true,
  },
];

const buffFiles: readonly GameDataFile[] = [
  { path: ["shared", "buffs", "base.buffs.json"], optional: false },
  {
    path: [
      "dlc",
      "580100_crimson_court",
      "features",
      "crimson_court",
      "shared",
      "buffs",
      "crimson_court.buffs.json",
    ],
    optional: true,
  },
  {
    path: [
      "dlc",
      "735730_color_of_madness",
      "shared",
      "buffs",
      "com.buffs.json",
    ],
    optional: true,
  },
];

const localizationFiles: readonly GameDataFile[] = [
  {
    path: ["localization", "miscellaneous.string_table.xml"],
    optional: false,
  },
  {
    path: ["dlc", "580100_crimson_court", "localization", "CC.string_table.xml"],
    optional: true,
  },
  {
    path: ["dlc", "735730_color_of_madness", "localization", "CoM.string_table.xml"],
    optional: true,
  },
];

function parseStringArray(value: unknown, path: string): string[] {
  return expectArray(value, path).map((item, index) =>
    expectString(item, `${path}[${String(index)}]`),
  );
}

function parseRawQuirks(value: unknown, source: string): RawQuirkDefinition[] {
  const document = expectRecord(value, source);
  return expectArray(document.quirks, `${source}.quirks`).map((value, index) => {
    const path = `${source}.quirks[${String(index)}]`;
    const quirk = expectRecord(value, path);
    const curioTag = expectString(quirk.curio_tag, `${path}.curio_tag`);
    return {
      id: expectString(quirk.id, `${path}.id`),
      isPositive: expectBoolean(quirk.is_positive, `${path}.is_positive`),
      isDisease: expectBoolean(quirk.is_disease, `${path}.is_disease`),
      classification: expectString(
        quirk.classification,
        `${path}.classification`,
      ),
      incompatibleQuirks: parseStringArray(
        quirk.incompatible_quirks,
        `${path}.incompatible_quirks`,
      ),
      curioTag: curioTag === "" ? null : curioTag,
      curioTagChance: expectNumber(
        quirk.curio_tag_chance,
        `${path}.curio_tag_chance`,
      ),
      keepsLoot: expectBoolean(quirk.keep_loot, `${path}.keep_loot`),
      canModifyInActivity: expectBoolean(
        quirk.can_modify_in_activity,
        `${path}.can_modify_in_activity`,
      ),
      canBeReplacedByNewQuirk: expectBoolean(
        quirk.can_be_replaced_by_new_quirk,
        `${path}.can_be_replaced_by_new_quirk`,
      ),
      buffIds: parseStringArray(quirk.buffs, `${path}.buffs`),
    };
  });
}

function parseBuffs(value: unknown, source: string): QuirkBuffEffect[] {
  const document = expectRecord(value, source);
  return expectArray(document.buffs, `${source}.buffs`).map((value, index) => {
    const path = `${source}.buffs[${String(index)}]`;
    const buff = expectRecord(value, path);
    return {
      buffId: expectString(buff.id, `${path}.id`),
      statType: expectString(buff.stat_type, `${path}.stat_type`),
      statSubType: expectString(buff.stat_sub_type, `${path}.stat_sub_type`),
      amount: expectNumber(buff.amount, `${path}.amount`),
      ruleType: expectString(buff.rule_type, `${path}.rule_type`),
      isFalseRule: optionalBoolean(buff.is_false_rule, `${path}.is_false_rule`),
    };
  });
}

export function parseQuirkLocalizationXml(text: string): LocalizationByLanguage {
  return parseStringTableXml(text, supportedGameLocalizationIds);
}

function localizedText(
  entries: Map<string, string> | undefined,
  quirkId: string,
): QuirkLocalizedText {
  return {
    name: entries?.get(`str_quirk_name_${quirkId}`) ?? null,
    description: entries?.get(`str_quirk_description_${quirkId}`) ?? null,
  };
}

function localizedTextByLanguage(
  localization: LocalizationByLanguage,
  quirkId: string,
): Partial<Record<GameLanguage, QuirkLocalizedText>> {
  return Object.fromEntries(
    gameLanguageCodes.flatMap((language) => {
      const entries = localization.get(getGameLocalizationId(language));
      return entries === undefined
        ? []
        : [[language, localizedText(entries, quirkId)] as const];
    }),
  );
}

async function readGameFiles(
  gameDirectory: string,
  files: readonly GameDataFile[],
): Promise<Array<{ source: string; text: string }>> {
  const loaded = await Promise.all(
    files.map(async (file) => {
      const source = join(...file.path);
      try {
        return {
          source,
          text: await readFile(resolve(gameDirectory, ...file.path), "utf8"),
        };
      } catch (error) {
        if (
          file.optional &&
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          return null;
        }
        throw error;
      }
    }),
  );
  return loaded.filter((file) => file !== null);
}

export async function loadQuirkDefinitions(
  gameDirectory: string,
): Promise<QuirkDefinition[]> {
  const [quirkDocuments, buffDocuments, localizationDocuments] =
    await Promise.all([
      readGameFiles(gameDirectory, quirkFiles),
      readGameFiles(gameDirectory, buffFiles),
      readGameFiles(gameDirectory, localizationFiles),
    ]);

  const rawQuirks = quirkDocuments.flatMap(({ source, text }) =>
    parseRawQuirks(JSON.parse(text) as unknown, source),
  );
  const effects = new Map<string, QuirkBuffEffect>();
  for (const { source, text } of buffDocuments) {
    for (const effect of parseBuffs(JSON.parse(text) as unknown, source)) {
      effects.set(effect.buffId, effect);
    }
  }
  const localization: LocalizationByLanguage = new Map();
  for (const { text } of localizationDocuments) {
    mergeStringTables(localization, parseQuirkLocalizationXml(text));
  }

  const seen = new Set<string>();
  return rawQuirks.map((quirk) => {
    if (seen.has(quirk.id)) {
      throw new Error(`Duplicate quirk id: ${quirk.id}`);
    }
    seen.add(quirk.id);
    const resolvedEffects = quirk.buffIds.flatMap((id) => {
      const effect = effects.get(id);
      return effect === undefined ? [] : [effect];
    });
    return {
      id: quirk.id,
      isPositive: quirk.isPositive,
      isDisease: quirk.isDisease,
      classification: quirk.classification,
      incompatibleQuirks: quirk.incompatibleQuirks,
      curioTag: quirk.curioTag,
      curioTagChance: quirk.curioTagChance,
      keepsLoot: quirk.keepsLoot,
      canModifyInActivity: quirk.canModifyInActivity,
      canBeReplacedByNewQuirk: quirk.canBeReplacedByNewQuirk,
      effects: resolvedEffects,
      unresolvedBuffIds: quirk.buffIds.filter((id) => !effects.has(id)),
      localization: localizedTextByLanguage(localization, quirk.id),
    };
  });
}
