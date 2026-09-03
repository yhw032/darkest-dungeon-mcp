import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  mergeStringTables,
  parseStringTableXml,
  type LocalizationByLanguage,
} from "./string-table.js";

export type GameLanguage = "en" | "ko";
export type GameLocalization = LocalizationByLanguage;

const languageIds: Record<GameLanguage, string> = {
  en: "english",
  ko: "koreana",
};
const supportedLanguageIds = new Set(Object.values(languageIds));

const localizationFiles = [
  { path: ["localization", "miscellaneous.string_table.xml"], optional: false },
  { path: ["localization", "heroes.string_table.xml"], optional: false },
  { path: ["localization", "curios.string_table.xml"], optional: true },
  { path: ["localization", "dialogue.string_table.xml"], optional: true },
  { path: ["localization", "backertrinkets.string_table.xml"], optional: true },
  { path: ["localization", "arena_base.string_table.xml"], optional: true },
  {
    path: ["dlc", "580100_crimson_court", "localization", "CC.string_table.xml"],
    optional: true,
  },
  {
    path: ["dlc", "702540_shieldbreaker", "localization", "shieldbreaker.string_table.xml"],
    optional: true,
  },
  {
    path: ["dlc", "735730_color_of_madness", "localization", "CoM.string_table.xml"],
    optional: true,
  },
] as const;

export async function loadGameLocalization(
  gameDirectory: string,
): Promise<GameLocalization> {
  const localization: GameLocalization = new Map();
  for (const file of localizationFiles) {
    try {
      const text = await readFile(resolve(gameDirectory, ...file.path), "utf8");
      mergeStringTables(
        localization,
        parseStringTableXml(text, supportedLanguageIds),
      );
    } catch (error) {
      if (
        file.optional &&
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        continue;
      }
      throw error;
    }
  }
  return localization;
}

export function localizeGameString(
  id: string,
  language: GameLanguage,
  localization?: GameLocalization,
): string | null {
  return localization?.get(languageIds[language])?.get(id) ?? null;
}

export function localizeHeroClass(
  heroClassId: string,
  language: GameLanguage,
  localization?: GameLocalization,
): string | null {
  return localizeGameString(
    `hero_class_name_${heroClassId}`,
    language,
    localization,
  );
}

export function localizeCombatSkill(
  heroClassId: string,
  skillId: string,
  language: GameLanguage,
  localization?: GameLocalization,
): string | null {
  return localizeGameString(
    `combat_skill_name_${heroClassId}_${skillId}`,
    language,
    localization,
  );
}

export function localizeInventoryItem(
  type: string,
  itemId: string,
  language: GameLanguage,
  localization?: GameLocalization,
): string | null {
  return localizeGameString(
    `str_inventory_title_${type}${itemId}`,
    language,
    localization,
  );
}

export function localizeTrinket(
  trinketId: string,
  language: GameLanguage,
  localization?: GameLocalization,
): string | null {
  return localizeInventoryItem("trinket", trinketId, language, localization);
}

export function localizeCurio(
  curioIdOrKey: string,
  language: GameLanguage,
  localization?: GameLocalization,
): string | null {
  const key = curioIdOrKey.startsWith("str_")
    ? curioIdOrKey
    : `str_curio_title_${curioIdOrKey}`;
  return localizeGameString(key, language, localization);
}

export function localizeTownBuilding(
  buildingId: string,
  language: GameLanguage,
  localization?: GameLocalization,
): string | null {
  return localizeGameString(`town_name_${buildingId}`, language, localization);
}

export function localizeTownActivity(
  activityId: string,
  language: GameLanguage,
  localization?: GameLocalization,
): string | null {
  return localizeGameString(
    `town_activity_name_${activityId}`,
    language,
    localization,
  );
}

export function localizeDistrict(
  districtId: string,
  language: GameLanguage,
  localization?: GameLocalization,
): string | null {
  return localizeGameString(`str_${districtId}_title`, language, localization);
}

export function localizeBuildingUpgradeTree(
  treeId: string,
  language: GameLanguage,
  localization?: GameLocalization,
): string | null {
  return localizeGameString(
    `upgrade_tree_name_${treeId}`,
    language,
    localization,
  );
}

export function localizeQuirk(
  quirkId: string,
  language: GameLanguage,
  localization?: GameLocalization,
): string | null {
  return localizeGameString(`str_quirk_name_${quirkId}`, language, localization);
}

export function localizeAffliction(
  afflictionId: string | null | undefined,
  language: GameLanguage,
  localization?: GameLocalization,
): string | null {
  if (!afflictionId) return null;
  return localizeGameString(
    `str_affliction_name_${afflictionId}`,
    language,
    localization,
  );
}

export function localizeVirtue(
  virtueId: string | null | undefined,
  language: GameLanguage,
  localization?: GameLocalization,
): string | null {
  if (!virtueId) return null;
  return localizeGameString(
    `str_virtue_name_${virtueId}`,
    language,
    localization,
  );
}

export function localizeGameStrings(
  ids: string[],
  language: GameLanguage,
  localization?: GameLocalization,
): string | null {
  const names = ids.map((id) => localizeGameString(id, language, localization));
  return names.every((name): name is string => name !== null)
    ? names.join(" / ")
    : null;
}
