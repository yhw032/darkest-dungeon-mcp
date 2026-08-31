import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

import type { SaveDecoder } from "../decoder/save-decoder.js";
import type { GameState } from "../domain/game-state.js";
import { loadGameState } from "./load-game-state.js";

const saveFiles = {
  roster: "persist.roster.json",
  estate: "persist.estate.json",
  town: "persist.town.json",
  quests: "persist.quest.json",
  upgrades: "persist.upgrades.json",
} as const;

type SaveComponent = keyof typeof saveFiles;

export interface LiveGameStateOptions {
  saveDirectory: string;
  decoder: SaveDecoder;
  temporaryRoot?: string;
}

export class LiveGameStateError extends Error {
  constructor(
    public readonly stage: "snapshot" | "decode" | "load",
    public readonly component: SaveComponent | undefined,
    cause: unknown,
  ) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    const subject = component === undefined ? "save state" : saveFiles[component];
    super(`Failed to ${stage} ${subject}: ${detail}`, { cause });
    this.name = "LiveGameStateError";
  }
}

async function snapshotFiles(
  saveDirectory: string,
  snapshotDirectory: string,
): Promise<Record<SaveComponent, string>> {
  const result = {} as Record<SaveComponent, string>;

  for (const [component, fileName] of Object.entries(saveFiles) as Array<
    [SaveComponent, string]
  >) {
    const sourcePath = join(saveDirectory, fileName);
    const snapshotPath = join(snapshotDirectory, fileName);
    try {
      await copyFile(sourcePath, snapshotPath);
    } catch (error) {
      throw new LiveGameStateError("snapshot", component, error);
    }
    result[component] = snapshotPath;
  }

  return result;
}

async function decodeFiles(
  snapshots: Record<SaveComponent, string>,
  decodedDirectory: string,
  decoder: SaveDecoder,
): Promise<Record<SaveComponent, string>> {
  const result = {} as Record<SaveComponent, string>;

  for (const component of Object.keys(saveFiles) as SaveComponent[]) {
    const outputPath = join(decodedDirectory, `${component}-decoded.json`);
    try {
      await decoder.decode(snapshots[component], outputPath);
    } catch (error) {
      throw new LiveGameStateError("decode", component, error);
    }
    result[component] = outputPath;
  }

  return result;
}

export async function loadLiveGameState(
  options: LiveGameStateOptions,
): Promise<GameState> {
  const parentDirectory = resolve(options.temporaryRoot ?? tmpdir());
  const temporaryDirectory = await mkdtemp(
    join(parentDirectory, "darkest-dungeon-mcp-"),
  );
  const snapshotDirectory = join(temporaryDirectory, "snapshot");
  const decodedDirectory = join(temporaryDirectory, "decoded");

  try {
    await Promise.all([
      mkdir(snapshotDirectory, { recursive: true }),
      mkdir(decodedDirectory, { recursive: true }),
    ]);
    const snapshots = await snapshotFiles(
      resolve(options.saveDirectory),
      snapshotDirectory,
    );
    const decoded = await decodeFiles(
      snapshots,
      decodedDirectory,
      options.decoder,
    );

    try {
      return await loadGameState({
        rosterPath: decoded.roster,
        estatePath: decoded.estate,
        townPath: decoded.town,
        questPath: decoded.quests,
        upgradesPath: decoded.upgrades,
      });
    } catch (error) {
      throw new LiveGameStateError("load", undefined, error);
    }
  } finally {
    if (basename(temporaryDirectory).startsWith("darkest-dungeon-mcp-")) {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }
}
