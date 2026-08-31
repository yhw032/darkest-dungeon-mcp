import type { GameState } from "../domain/game-state.js";
import { fileURLToPath } from "node:url";
import { DdsSaveEditorDecoder } from "../decoder/dds-save-editor.js";
import {
  resolveDecoderJarPath,
  resolveJavaExecutable,
} from "../decoder/resolve-decoder.js";
import { loadGameState } from "../loaders/load-game-state.js";
import { loadLiveGameState } from "../loaders/load-live-game-state.js";

export interface GameStateDataSource {
  load(): Promise<GameState>;
}

const samplePaths = {
  rosterPath: fileURLToPath(
    new URL("../../samples/roster-decoded.json", import.meta.url),
  ),
  estatePath: fileURLToPath(
    new URL("../../samples/estate-decoded.json", import.meta.url),
  ),
  townPath: fileURLToPath(
    new URL("../../samples/town-decoded.json", import.meta.url),
  ),
  questPath: fileURLToPath(
    new URL("../../samples/quest-decoded.json", import.meta.url),
  ),
};

export class SampleGameStateDataSource implements GameStateDataSource {
  async load(): Promise<GameState> {
    return loadGameState(samplePaths);
  }
}

export class LiveGameStateDataSource implements GameStateDataSource {
  constructor(
    private readonly saveDirectory: string,
    private readonly environment: NodeJS.ProcessEnv = process.env,
  ) {}

  async load(): Promise<GameState> {
    const [jarPath, javaExecutable] = await Promise.all([
      resolveDecoderJarPath({ environment: this.environment }),
      resolveJavaExecutable(
        this.environment.DD_JAVA_EXECUTABLE,
        this.environment,
      ),
    ]);

    return loadLiveGameState({
      saveDirectory: this.saveDirectory,
      decoder: new DdsSaveEditorDecoder({ jarPath, javaExecutable }),
    });
  }
}

export function createConfiguredDataSource(
  environment: NodeJS.ProcessEnv = process.env,
): GameStateDataSource {
  const saveDirectory = environment.DD_SAVE_DIR;
  return saveDirectory === undefined || saveDirectory.trim() === ""
    ? new SampleGameStateDataSource()
    : new LiveGameStateDataSource(saveDirectory, environment);
}
