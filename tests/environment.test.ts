import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { loadProjectEnvironment } from "../src/mcp/load-environment.js";

test("loads MCP settings from an env file without overriding the environment", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "darkest-dungeon-env-"));
  const path = join(directory, ".env");
  const loadedKey = "DD_MCP_ENV_LOADED_TEST";
  const preservedKey = "DD_MCP_ENV_PRESERVED_TEST";
  const previousLoaded = process.env[loadedKey];
  const previousPreserved = process.env[preservedKey];
  t.after(async () => {
    if (previousLoaded === undefined) delete process.env[loadedKey];
    else process.env[loadedKey] = previousLoaded;
    if (previousPreserved === undefined) delete process.env[preservedKey];
    else process.env[preservedKey] = previousPreserved;
    await rm(directory, { recursive: true, force: true });
  });

  delete process.env[loadedKey];
  process.env[preservedKey] = "from-process";
  await writeFile(
    path,
    `${loadedKey}=from-file\n${preservedKey}=from-file\n`,
    "utf8",
  );

  assert.equal(loadProjectEnvironment(path), true);
  assert.equal(process.env[loadedKey], "from-file");
  assert.equal(process.env[preservedKey], "from-process");
});

test("allows the optional env file to be absent", () => {
  assert.equal(
    loadProjectEnvironment(join(tmpdir(), "missing-darkest-dungeon.env")),
    false,
  );
});
