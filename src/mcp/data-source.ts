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
  refresh(): Promise<GameStateSnapshotInfo>;
  getSnapshotInfo(): GameStateSnapshotInfo | null;
}

export interface GameStateSnapshotInfo {
  snapshotId: string;
  source: "sample" | "live";
  loadedAt: string;
  expiresAt: string | null;
}

interface CachedGameStateDataSourceOptions {
  source: GameStateSnapshotInfo["source"];
  ttlMs: number | null;
  now?: () => number;
}

interface CachedSnapshot {
  state: GameState;
  info: GameStateSnapshotInfo;
  expiresAtMs: number | null;
}

export class CachedGameStateDataSource implements GameStateDataSource {
  private snapshot: CachedSnapshot | undefined;
  private pending: Promise<CachedSnapshot> | undefined;
  private generation = 0;
  private refreshEpoch = 0;
  private readonly now: () => number;

  constructor(
    private readonly loader: () => Promise<GameState>,
    private readonly options: CachedGameStateDataSourceOptions,
  ) {
    this.now = options.now ?? Date.now;
  }

  async load(): Promise<GameState> {
    return (await this.loadSnapshot()).state;
  }

  async refresh(): Promise<GameStateSnapshotInfo> {
    this.refreshEpoch += 1;
    this.snapshot = undefined;
    this.pending = undefined;
    return (await this.loadSnapshot()).info;
  }

  getSnapshotInfo(): GameStateSnapshotInfo | null {
    return this.snapshot?.info ?? null;
  }

  private async loadSnapshot(): Promise<CachedSnapshot> {
    const now = this.now();
    if (
      this.snapshot !== undefined &&
      (this.snapshot.expiresAtMs === null || this.snapshot.expiresAtMs > now)
    ) {
      return this.snapshot;
    }
    if (this.pending !== undefined) return this.pending;

    const refreshEpoch = this.refreshEpoch;
    const pending = this.loader().then((state) => {
      const loadedAtMs = this.now();
      const expiresAtMs =
        this.options.ttlMs === null
          ? null
          : loadedAtMs + this.options.ttlMs;
      const snapshot: CachedSnapshot = {
        state,
        expiresAtMs,
        info: {
          snapshotId: `${this.options.source}-${String(loadedAtMs)}-${String(++this.generation)}`,
          source: this.options.source,
          loadedAt: new Date(loadedAtMs).toISOString(),
          expiresAt:
            expiresAtMs === null ? null : new Date(expiresAtMs).toISOString(),
        },
      };
      if (this.refreshEpoch === refreshEpoch) this.snapshot = snapshot;
      return snapshot;
    });
    this.pending = pending;

    try {
      return await pending;
    } finally {
      if (this.pending === pending) this.pending = undefined;
    }
  }
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
  upgradesPath: fileURLToPath(
    new URL("../../samples/upgrades-decoded.json", import.meta.url),
  ),
};

export class SampleGameStateDataSource implements GameStateDataSource {
  private readonly cache = new CachedGameStateDataSource(
    () => loadGameState(samplePaths),
    { source: "sample", ttlMs: null },
  );

  async load(): Promise<GameState> {
    return this.cache.load();
  }

  async refresh(): Promise<GameStateSnapshotInfo> {
    return this.cache.refresh();
  }

  getSnapshotInfo(): GameStateSnapshotInfo | null {
    return this.cache.getSnapshotInfo();
  }
}

export class LiveGameStateDataSource implements GameStateDataSource {
  private readonly cache: CachedGameStateDataSource;

  constructor(
    private readonly saveDirectory: string,
    private readonly environment: NodeJS.ProcessEnv = process.env,
  ) {
    this.cache = new CachedGameStateDataSource(
      () => this.loadUncached(),
      { source: "live", ttlMs: 120_000 },
    );
  }

  async load(): Promise<GameState> {
    return this.cache.load();
  }

  async refresh(): Promise<GameStateSnapshotInfo> {
    return this.cache.refresh();
  }

  getSnapshotInfo(): GameStateSnapshotInfo | null {
    return this.cache.getSnapshotInfo();
  }

  private async loadUncached(): Promise<GameState> {
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
