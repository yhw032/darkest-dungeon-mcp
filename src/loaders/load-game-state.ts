import { readFile } from "node:fs/promises";

import type { GameState } from "../domain/game-state.js";
import { parseEstateJson } from "../parser/parse-estate.js";
import { parseQuestStateJson } from "../parser/parse-quest.js";
import { parseRosterJson } from "../parser/parse-roster.js";
import { parseTownJson } from "../parser/parse-town.js";
import { parseUpgradeStateJson } from "../parser/parse-upgrades.js";

type GameStateComponent =
  | "roster"
  | "estate"
  | "town"
  | "quests"
  | "upgrades";

export interface GameStatePaths {
  rosterPath: string;
  estatePath: string;
  townPath: string;
  questPath: string;
  upgradesPath: string;
}

export class GameStateLoadError extends Error {
  constructor(
    public readonly component: GameStateComponent,
    public readonly filePath: string,
    cause: unknown,
  ) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`Failed to load ${component} from ${filePath}: ${detail}`, { cause });
    this.name = "GameStateLoadError";
  }
}

async function loadComponent<T>(
  component: GameStateComponent,
  filePath: string,
  parser: (text: string) => T,
): Promise<T> {
  try {
    return parser(await readFile(filePath, "utf8"));
  } catch (error) {
    throw new GameStateLoadError(component, filePath, error);
  }
}

export async function loadGameState(paths: GameStatePaths): Promise<GameState> {
  const [roster, estate, town, quests, upgrades] = await Promise.all([
    loadComponent("roster", paths.rosterPath, parseRosterJson),
    loadComponent("estate", paths.estatePath, parseEstateJson),
    loadComponent("town", paths.townPath, parseTownJson),
    loadComponent("quests", paths.questPath, parseQuestStateJson),
    loadComponent("upgrades", paths.upgradesPath, parseUpgradeStateJson),
  ]);

  return { roster, estate, town, quests, upgrades };
}
