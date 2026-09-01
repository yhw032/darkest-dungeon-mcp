import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { Quest } from "../domain/quest.js";
import {
  mergeStringTables,
  parseStringTableXml,
  type LocalizationByLanguage,
} from "../localization/string-table.js";
import type { QuestSummary } from "../queries/list-quests.js";

export type QuestLanguage = "en" | "ko";

export interface LocalizedDungeon {
  id: string;
  name: string | null;
}

export type QuestLocalization = LocalizationByLanguage;

const languageIds: Record<QuestLanguage, string> = {
  en: "english",
  ko: "koreana",
};
const supportedLanguageIds = new Set(Object.values(languageIds));

const localizationFiles = [
  { path: ["localization", "miscellaneous.string_table.xml"], optional: false },
  {
    path: ["dlc", "580100_crimson_court", "localization", "CC.string_table.xml"],
    optional: true,
  },
  {
    path: ["dlc", "735730_color_of_madness", "localization", "CoM.string_table.xml"],
    optional: true,
  },
] as const;

export async function loadQuestLocalization(
  gameDirectory: string,
): Promise<QuestLocalization> {
  const localization: QuestLocalization = new Map();
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

export type LocalizedQuestSummary = Omit<QuestSummary, "dungeon"> & {
  dungeon: LocalizedDungeon;
};

export type LocalizedQuest = Omit<Quest, "dungeon"> & {
  dungeon: LocalizedDungeon;
};

export function localizeDungeon(
  dungeonId: string,
  language: QuestLanguage,
  localization?: QuestLocalization,
): LocalizedDungeon {
  return {
    id: dungeonId,
    name: localization
      ?.get(languageIds[language])
      ?.get(`dungeon_name_${dungeonId}`) ?? null,
  };
}

export function localizeQuestSummary(
  quest: QuestSummary,
  language: QuestLanguage,
  localization?: QuestLocalization,
): LocalizedQuestSummary {
  return {
    ...quest,
    dungeon: localizeDungeon(quest.dungeon, language, localization),
  };
}

export function localizeQuest(
  quest: Quest,
  language: QuestLanguage,
  localization?: QuestLocalization,
): LocalizedQuest {
  return {
    ...quest,
    dungeon: localizeDungeon(quest.dungeon, language, localization),
  };
}
