import type {
  Quest,
  QuestReward,
  QuestRewardItem,
  QuestState,
} from "../domain/quest.js";
import {
  SaveValidationError,
  expectBoolean,
  expectNumber,
  expectRecord,
  expectString,
} from "./roster-schema.js";

function parseStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) {
    throw new SaveValidationError("expected an array", path);
  }

  return value.map((item, index) => expectString(item, `${path}.${index}`));
}

function parseRewardItems(value: unknown, path: string): QuestRewardItem[] {
  const definition = expectRecord(value, path);
  const items = expectRecord(definition.items, `${path}.items`);

  return Object.entries(items).map(([key, rawItem]) => {
    const itemPath = `${path}.items.${key}`;
    const item = expectRecord(rawItem, itemPath);
    return {
      id: expectString(item.id, `${itemPath}.id`),
      type: expectString(item.type, `${itemPath}.type`),
      amount: expectNumber(item.amount, `${itemPath}.amount`),
    };
  });
}

function parseReward(value: unknown, path: string): QuestReward {
  const reward = expectRecord(value, path);
  return {
    resolveXp: expectNumber(reward.resolve_xp, `${path}.resolve_xp`),
    items: parseRewardItems(
      reward.items_definition,
      `${path}.items_definition`,
    ),
  };
}

function parseQuest(saveKey: string, value: unknown, path: string): Quest {
  const quest = expectRecord(value, path);
  return {
    saveKey,
    id: expectString(quest.id, `${path}.id`),
    mapName: expectString(quest.map_name, `${path}.map_name`),
    isPlotQuest: expectBoolean(quest.is_plot_quest, `${path}.is_plot_quest`),
    isFromTownEvent: expectBoolean(
      quest.is_from_town_event,
      `${path}.is_from_town_event`,
    ),
    type: expectString(quest.type, `${path}.type`),
    dungeon: expectString(quest.dungeon, `${path}.dungeon`),
    difficulty: expectNumber(quest.difficulty, `${path}.difficulty`),
    length: expectNumber(quest.length, `${path}.length`),
    goalIds: parseStringArray(quest.goal_ids, `${path}.goal_ids`),
    reward: parseReward(quest.completion_reward, `${path}.completion_reward`),
  };
}

export function parseQuestState(value: unknown): QuestState {
  const document = expectRecord(value, "$");
  const root = expectRecord(document.base_root, "$.base_root");
  const quests = expectRecord(root.quests, "$.base_root.quests");

  return {
    version: expectNumber(root.version, "$.base_root.version"),
    plotQuestTotal: expectNumber(
      root.plot_quest_total,
      "$.base_root.plot_quest_total",
    ),
    quests: Object.entries(quests).map(([key, quest]) =>
      parseQuest(key, quest, `$.base_root.quests.${key}`),
    ),
  };
}

export function parseQuestStateJson(text: string): QuestState {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new SaveValidationError(`invalid JSON (${detail})`, "$");
  }
  return parseQuestState(value);
}
