import type { QuestState } from "../domain/quest.js";

export interface QuestStateSummary {
  version: number;
  totalQuests: number;
  plotQuests: number;
  generatedQuests: number;
  byDungeon: Record<string, number>;
}

export function getQuestStateSummary(state: QuestState): QuestStateSummary {
  const byDungeon: Record<string, number> = {};
  let plotQuests = 0;

  for (const quest of state.quests) {
    byDungeon[quest.dungeon] = (byDungeon[quest.dungeon] ?? 0) + 1;
    if (quest.isPlotQuest) plotQuests += 1;
  }

  return {
    version: state.version,
    totalQuests: state.quests.length,
    plotQuests,
    generatedQuests: state.quests.length - plotQuests,
    byDungeon,
  };
}
