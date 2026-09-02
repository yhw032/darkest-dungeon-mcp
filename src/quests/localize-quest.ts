import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { Quest, QuestReward } from "../domain/quest.js";
import {
  localizeGameString,
  type GameLanguage,
} from "../localization/game-localization.js";
import {
  mergeStringTables,
  parseStringTableXml,
  type LocalizationByLanguage,
} from "../localization/string-table.js";
import type { QuestSummary } from "../queries/list-quests.js";

export type QuestLanguage = GameLanguage;

export interface LocalizedDungeon {
  id: string;
  name: string | null;
}

export interface LocalizedQuestLength {
  value: number;
  name: string | null;
}

export interface LocalizedQuestRewardItem {
  id: string;
  type: string;
  amount: number;
  name: string | null;
}

export interface LocalizedQuestReward extends Omit<QuestReward, "items"> {
  items: LocalizedQuestRewardItem[];
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

export interface LocalizedQuestSummary
  extends Omit<QuestSummary, "dungeon" | "length" | "reward"> {
  dungeon: LocalizedDungeon;
  title: string | null;
  description: string | null;
  length: LocalizedQuestLength;
  reward: LocalizedQuestReward;
}

export interface LocalizedQuest
  extends Omit<Quest, "dungeon" | "length" | "reward"> {
  dungeon: LocalizedDungeon;
  title: string | null;
  description: string | null;
  length: LocalizedQuestLength;
  reward: LocalizedQuestReward;
}

function questLocalizationSuffix(
  quest: Pick<Quest, "id" | "type" | "dungeon" | "length" | "goalIds">,
): string {
  return quest.id.startsWith("generated_")
    ? [quest.type, quest.length, quest.dungeon, ...quest.goalIds].join("+")
    : quest.id;
}

function localizeQuestFields(
  quest: Pick<
    Quest,
    "id" | "type" | "dungeon" | "length" | "goalIds" | "reward"
  >,
  language: QuestLanguage,
  localization?: QuestLocalization,
) {
  const suffix = questLocalizationSuffix(quest);
  return {
    dungeon: localizeDungeon(quest.dungeon, language, localization),
    title: localizeGameString(
      `town_quest_name_${suffix}`,
      language,
      localization,
    ),
    description: localizeGameString(
      `town_quest_description_${suffix}`,
      language,
      localization,
    ),
    length: {
      value: quest.length,
      name: localizeGameString(
        `town_quest_length_${String(quest.length)}`,
        language,
        localization,
      ),
    },
    reward: {
      resolveXp: quest.reward.resolveXp,
      items: quest.reward.items.map((item) => ({
        ...item,
        name: localizeGameString(
          `str_inventory_title_${item.type}${item.id}`,
          language,
          localization,
        ),
      })),
    },
  };
}

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
    ...localizeQuestFields(quest, language, localization),
  };
}

export function localizeQuest(
  quest: Quest,
  language: QuestLanguage,
  localization?: QuestLocalization,
): LocalizedQuest {
  return {
    ...quest,
    ...localizeQuestFields(quest, language, localization),
  };
}
