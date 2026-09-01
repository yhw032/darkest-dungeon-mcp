import type { GameState } from "../domain/game-state.js";
import type { HeroProgressionRules } from "../domain/hero-progression.js";
import {
  type EstateResourcesSummary,
  getEstateResources,
} from "./get-estate-resources.js";
import {
  type RosterSummary,
  summarizeRoster,
} from "./summarize-roster.js";
import { type TownSummary, getTownSummary } from "./get-town-summary.js";
import {
  type QuestStateSummary,
  getQuestStateSummary,
} from "./get-quest-state-summary.js";

export interface GameStateSummary {
  versions: {
    roster: number;
    estate: number;
    town: number;
    quests: number;
    upgrades: number;
  };
  roster: RosterSummary;
  estate: Omit<EstateResourcesSummary, "version">;
  town: Omit<TownSummary, "version">;
  quests: Omit<QuestStateSummary, "version">;
  upgrades: {
    totalPurchases: number;
    purchased: number;
  };
}

export function getGameStateSummary(
  gameState: GameState,
  stressThreshold?: number,
  progressionRules?: HeroProgressionRules,
): GameStateSummary {
  const estateSummary = getEstateResources(gameState.estate);
  const { version: _version, ...estate } = estateSummary;
  const townSummary = getTownSummary(gameState.town);
  const { version: _townVersion, ...town } = townSummary;
  const questSummary = getQuestStateSummary(gameState.quests);
  const { version: _questVersion, ...quests } = questSummary;

  return {
    versions: {
      roster: gameState.roster.version,
      estate: gameState.estate.version,
      town: gameState.town.version,
      quests: gameState.quests.version,
      upgrades: gameState.upgrades.version,
    },
    roster: summarizeRoster(
      gameState.roster,
      stressThreshold,
      gameState.town,
      progressionRules,
    ),
    estate,
    town,
    quests,
    upgrades: {
      totalPurchases: gameState.upgrades.purchases.length,
      purchased: gameState.upgrades.purchases.filter(
        (purchase) => purchase.isPurchased,
      ).length,
    },
  };
}
