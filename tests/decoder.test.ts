import assert from "node:assert/strict";
import { access, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { DdsSaveEditorDecoder } from "../src/decoder/dds-save-editor.js";
import { resolveDecoderJarPath } from "../src/decoder/resolve-decoder.js";
import type { SaveDecoder } from "../src/decoder/save-decoder.js";
import {
  LiveGameStateError,
  loadLiveGameState,
} from "../src/loaders/load-live-game-state.js";

const fixtures: Record<string, string> = {
  "persist.roster.json": fileURLToPath(
    new URL("../samples/roster-decoded.json", import.meta.url),
  ),
  "persist.estate.json": fileURLToPath(
    new URL("../samples/estate-decoded.json", import.meta.url),
  ),
  "persist.town.json": fileURLToPath(
    new URL("../samples/town-decoded.json", import.meta.url),
  ),
  "persist.quest.json": fileURLToPath(
    new URL("../samples/quest-decoded.json", import.meta.url),
  ),
};

class FixtureDecoder implements SaveDecoder {
  readonly calls: Array<{ inputPath: string; outputPath: string }> = [];

  async decode(inputPath: string, outputPath: string): Promise<void> {
    this.calls.push({ inputPath, outputPath });
    const fixture = fixtures[basename(inputPath)];
    if (fixture === undefined) throw new Error("Unexpected save file");
    await copyFile(fixture, outputPath);
  }
}

async function createRawSaveDirectory(root: string): Promise<string> {
  const saveDirectory = join(root, "profile_0");
  await mkdir(saveDirectory);
  await Promise.all(
    Object.keys(fixtures).map((fileName) =>
      writeFile(join(saveDirectory, fileName), `raw:${fileName}`, "utf8"),
    ),
  );
  await writeFile(join(saveDirectory, "unrelated.json"), "untouched", "utf8");
  return saveDirectory;
}

test("DDSaveEditor adapter passes paths as separate process arguments", async () => {
  const calls: Array<{ executable: string; args: readonly string[] }> = [];
  const decoder = new DdsSaveEditorDecoder({
    jarPath: "C:\\tools folder\\DDSaveEditor.jar",
    javaExecutable: "java",
    runCommand: (executable, args) => {
      calls.push({ executable, args });
      return Promise.resolve();
    },
  });

  await decoder.decode("C:\\save path\\persist.roster.json", "C:\\out path\\roster.json");

  assert.deepEqual(calls, [
    {
      executable: "java",
      args: [
        "-jar",
        "C:\\tools folder\\DDSaveEditor.jar",
        "decode",
        "--output",
        "C:\\out path\\roster.json",
        "C:\\save path\\persist.roster.json",
      ],
    },
  ]);
});

test("explicit decoder path takes precedence over environment and default", async () => {
  const root = await mkdtemp(join(tmpdir(), "ddmcp-resolver-test-"));
  try {
    const jarPath = join(root, "chosen.jar");
    await writeFile(jarPath, "fixture");

    assert.equal(
      await resolveDecoderJarPath({
        explicitPath: jarPath,
        environment: { DD_SAVE_EDITOR_JAR: join(root, "environment.jar") },
        defaultPath: join(root, "default.jar"),
      }),
      jarPath,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("snapshots allowed files, loads GameState, and cleans temporary data", async () => {
  const root = await mkdtemp(join(tmpdir(), "ddmcp-live-test-"));
  try {
    const saveDirectory = await createRawSaveDirectory(root);
    const decoder = new FixtureDecoder();
    const gameState = await loadLiveGameState({
      saveDirectory,
      decoder,
      temporaryRoot: root,
    });

    assert.equal(gameState.roster.heroes.length, 24);
    assert.equal(gameState.quests.quests.length, 11);
    assert.deepEqual(
      decoder.calls.map((call) => basename(call.inputPath)),
      Object.keys(fixtures),
    );
    assert.equal(
      await readFile(join(saveDirectory, "persist.roster.json"), "utf8"),
      "raw:persist.roster.json",
    );
    assert.equal(
      await readFile(join(saveDirectory, "unrelated.json"), "utf8"),
      "untouched",
    );
    await assert.rejects(access(dirname(decoder.calls[0]!.inputPath)));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("reports a missing required save component", async () => {
  const root = await mkdtemp(join(tmpdir(), "ddmcp-missing-test-"));
  try {
    const saveDirectory = await createRawSaveDirectory(root);
    await rm(join(saveDirectory, "persist.quest.json"));

    await assert.rejects(
      loadLiveGameState({
        saveDirectory,
        decoder: new FixtureDecoder(),
        temporaryRoot: root,
      }),
      (error) =>
        error instanceof LiveGameStateError &&
        error.stage === "snapshot" &&
        error.component === "quests" &&
        error.message.includes("persist.quest.json"),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("cleans temporary data after a decoder failure", async () => {
  const root = await mkdtemp(join(tmpdir(), "ddmcp-failure-test-"));
  try {
    const saveDirectory = await createRawSaveDirectory(root);
    let snapshotPath: string | undefined;
    const decoder: SaveDecoder = {
      decode(inputPath) {
        snapshotPath = inputPath;
        return Promise.reject(new Error("decoder failed"));
      },
    };

    await assert.rejects(
      loadLiveGameState({ saveDirectory, decoder, temporaryRoot: root }),
      (error) =>
        error instanceof LiveGameStateError && error.stage === "decode",
    );
    assert.ok(snapshotPath);
    await assert.rejects(access(snapshotPath));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
