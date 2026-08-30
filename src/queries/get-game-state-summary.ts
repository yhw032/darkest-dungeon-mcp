import type { GameState } from "../domain/game-state.js";
import {
  type EstateResourcesSummary,
  getEstateResources,
} from "./get-estate-resources.js";
import {
  type RosterSummary,
  summarizeRoster,
} from "./summarize-roster.js";

export interface GameStateSummary {
  versions: {
    roster: number;
    estate: number;
  };
  roster: RosterSummary;
  estate: Omit<EstateResourcesSummary, "version">;
}

export function getGameStateSummary(
  gameState: GameState,
  stressThreshold?: number,
): GameStateSummary {
  const estateSummary = getEstateResources(gameState.estate);
  const { version: _version, ...estate } = estateSummary;

  return {
    versions: {
      roster: gameState.roster.version,
      estate: gameState.estate.version,
    },
    roster: summarizeRoster(gameState.roster, stressThreshold),
    estate,
  };
}
