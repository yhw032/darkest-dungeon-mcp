export interface QuestRewardItem {
  id: string;
  type: string;
  amount: number;
}

export interface QuestReward {
  resolveXp: number;
  items: QuestRewardItem[];
}

export interface Quest {
  saveKey: string;
  id: string;
  mapName: string;
  isPlotQuest: boolean;
  isFromTownEvent: boolean;
  type: string;
  dungeon: string;
  difficulty: number;
  length: number;
  goalIds: string[];
  reward: QuestReward;
}

export interface QuestState {
  version: number;
  plotQuestTotal: number;
  quests: Quest[];
}
