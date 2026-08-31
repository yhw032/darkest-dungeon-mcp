import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  defaultEnvironmentFile,
  readEnvironmentFile,
} from "../src/mcp/load-environment.js";
import { resolveRuntimeConfiguration } from "../src/mcp/runtime-options.js";

test("reads an environment file without mutating process.env", () => {
  const directory = mkdtempSync(join(tmpdir(), "ddmcp-env-"));
  const path = join(directory, ".env");
  writeFileSync(path, "DD_SAVE_DIR=from-file\nDD_GAME_DIR='game path'\n");

  try {
    assert.deepEqual(readEnvironmentFile(path), {
      DD_GAME_DIR: "game path",
      DD_SAVE_DIR: "from-file",
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("an absent optional environment file is ignored", () => {
  assert.equal(
    readEnvironmentFile(join(tmpdir(), "missing-darkest-dungeon.env")),
    undefined,
  );
});

test("default environment file is resolved from the installed module", () => {
  const projectRoot = fileURLToPath(new URL("..", import.meta.url));
  assert.equal(defaultEnvironmentFile, join(projectRoot, ".env"));
});

test("runtime options override process variables and an explicit env file", () => {
  const directory = mkdtempSync(join(tmpdir(), "ddmcp-options-"));
  const path = join(directory, "server.env");
  writeFileSync(
    path,
    [
      "DD_SAVE_DIR=file-save",
      "DD_GAME_DIR=file-game",
      "DD_SAVE_EDITOR_JAR=file.jar",
      "DD_JAVA_EXECUTABLE=file-java",
    ].join("\n"),
  );

  try {
    const { environment, environmentFile } = resolveRuntimeConfiguration(
      [
        "--env-file",
        path,
        "--save-dir=cli-save",
        "--decoder-jar",
        "cli.jar",
        "--java",
        "cli-java",
      ],
      { DD_SAVE_DIR: "process-save", DD_GAME_DIR: "process-game" },
    );

    assert.equal(environmentFile, path);
    assert.equal(environment.DD_SAVE_DIR, "cli-save");
    assert.equal(environment.DD_GAME_DIR, "process-game");
    assert.equal(environment.DD_SAVE_EDITOR_JAR, "cli.jar");
    assert.equal(environment.DD_JAVA_EXECUTABLE, "cli-java");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("explicit missing env files and invalid options fail clearly", () => {
  assert.throws(
    () => resolveRuntimeConfiguration(["--env-file", "missing.env"], {}),
    /ENOENT/,
  );
  assert.throws(
    () => resolveRuntimeConfiguration(["--save-dir"], {}),
    /requires a value/,
  );
  assert.throws(
    () => resolveRuntimeConfiguration(["--wat", "value"], {}),
    /Unknown option/,
  );
});
