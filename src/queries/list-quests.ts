import type { Quest, QuestState } from "../domain/quest.js";
import { normalizeSaveDungeonId } from "../quests/dungeon-ids.js";

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
  const dungeon =
    filters.dungeon === undefined
      ? undefined
      : normalizeSaveDungeonId(filters.dungeon);
  return state.quests
    .filter(
      (quest) =>
        (dungeon === undefined ||
          normalizeSaveDungeonId(quest.dungeon) === dungeon) &&
        (filters.type === undefined || quest.type === filters.type) &&
        (filters.difficulty === undefined ||
          quest.difficulty === filters.difficulty) &&
        (filters.isPlotQuest === undefined ||
          quest.isPlotQuest === filters.isPlotQuest),
    )
    .map(toQuestSummary);
}
