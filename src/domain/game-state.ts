import type { Estate } from "./estate.js";
import type { Roster } from "./hero.js";
import type { QuestState } from "./quest.js";
import type { Town } from "./town.js";
import type { UpgradeState } from "./upgrades.js";

export interface GameState {
  roster: Roster;
  estate: Estate;
  town: Town;
  quests: QuestState;
  upgrades: UpgradeState;
}
