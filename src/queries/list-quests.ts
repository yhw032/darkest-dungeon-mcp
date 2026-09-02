import type { Quest, QuestState } from "../domain/quest.js";

export type QuestSummary = Pick<
  Quest,
  | "id"
  | "isPlotQuest"
  | "type"
  | "dungeon"
  | "difficulty"
  | "length"
  | "goalIds"
  | "reward"
>;

export interface QuestFilters {
  dungeon?: string;
  type?: string;
  difficulty?: number;
  isPlotQuest?: boolean;
}

export function toQuestSummary(quest: Quest): QuestSummary {
  const {
    id,
    isPlotQuest,
    type,
    dungeon,
    difficulty,
    length,
    goalIds,
    reward,
  } = quest;
  return { id, isPlotQuest, type, dungeon, difficulty, length, goalIds, reward };
}

export function listQuests(
  state: QuestState,
  filters: QuestFilters = {},
): QuestSummary[] {
  return state.quests
    .filter(
      (quest) =>
        (filters.dungeon === undefined || quest.dungeon === filters.dungeon) &&
        (filters.type === undefined || quest.type === filters.type) &&
        (filters.difficulty === undefined ||
          quest.difficulty === filters.difficulty) &&
        (filters.isPlotQuest === undefined ||
          quest.isPlotQuest === filters.isPlotQuest),
    )
    .map(toQuestSummary);
}
