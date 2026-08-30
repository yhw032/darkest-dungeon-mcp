import type { Quest, QuestState } from "../domain/quest.js";

export function getQuest(state: QuestState, questId: string): Quest | undefined {
  return state.quests.find((quest) => quest.id === questId);
}
