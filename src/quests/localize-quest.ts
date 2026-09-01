import type { Quest } from "../domain/quest.js";
import type { QuestSummary } from "../queries/list-quests.js";

export type QuestLanguage = "en" | "ko";

export interface LocalizedDungeon {
  id: string;
  name: string | null;
}

const dungeonNames: Record<string, Record<QuestLanguage, string>> = {
  crypts: { en: "Ruins", ko: "폐허" },
  warrens: { en: "Warrens", ko: "사육장" },
  weald: { en: "Weald", ko: "삼림지대" },
  cove: { en: "Cove", ko: "해안 만" },
  courtyard: { en: "Courtyard", ko: "안뜰" },
  farm: { en: "Farmstead", ko: "농장" },
  darkestdungeon: {
    en: "Darkest Dungeon",
    ko: "가장 어두운 던전",
  },
};

export type LocalizedQuestSummary = Omit<QuestSummary, "dungeon"> & {
  dungeon: LocalizedDungeon;
};

export type LocalizedQuest = Omit<Quest, "dungeon"> & {
  dungeon: LocalizedDungeon;
};

export function localizeDungeon(
  dungeonId: string,
  language: QuestLanguage,
): LocalizedDungeon {
  return {
    id: dungeonId,
    name: dungeonNames[dungeonId]?.[language] ?? null,
  };
}

export function localizeQuestSummary(
  quest: QuestSummary,
  language: QuestLanguage,
): LocalizedQuestSummary {
  return {
    ...quest,
    dungeon: localizeDungeon(quest.dungeon, language),
  };
}

export function localizeQuest(
  quest: Quest,
  language: QuestLanguage,
): LocalizedQuest {
  return {
    ...quest,
    dungeon: localizeDungeon(quest.dungeon, language),
  };
}
