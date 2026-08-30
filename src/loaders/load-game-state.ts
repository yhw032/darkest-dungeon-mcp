import { readFile } from "node:fs/promises";

import type { GameState } from "../domain/game-state.js";
import { parseEstateJson } from "../parser/parse-estate.js";
import { parseRosterJson } from "../parser/parse-roster.js";

export interface GameStatePaths {
  rosterPath: string;
  estatePath: string;
}

export class GameStateLoadError extends Error {
  constructor(
    public readonly component: "roster" | "estate",
    public readonly filePath: string,
    cause: unknown,
  ) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`Failed to load ${component} from ${filePath}: ${detail}`, { cause });
    this.name = "GameStateLoadError";
  }
}

async function loadComponent<T>(
  component: "roster" | "estate",
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
  const [roster, estate] = await Promise.all([
    loadComponent("roster", paths.rosterPath, parseRosterJson),
    loadComponent("estate", paths.estatePath, parseEstateJson),
  ]);

  return { roster, estate };
}
