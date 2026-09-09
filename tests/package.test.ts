import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { Client } from "@modelcontextprotocol/client";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/client/stdio";

const execFileAsync = promisify(execFile);
const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const serverPath = join(projectRoot, "dist", "mcp", "stdio.js");

test("built stdio entrypoint serves sample tools outside the project", async (t) => {
  const workingDirectory = await mkdtemp(join(tmpdir(), "ddmcp-package-test-"));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    cwd: workingDirectory,
    env: {
      ...getDefaultEnvironment(),
      DD_SAVE_DIR: "",
      DD_GAME_DIR: "",
    },
    stderr: "pipe",
  });
  const client = new Client({ name: "package-test-client", version: "1.0.0" });
  t.after(async () => {
    await client.close();
    await rm(workingDirectory, { recursive: true, force: true });
  });

  await client.connect(transport);
  const { tools } = await client.listTools();

  assert.ok(tools.some((tool) => tool.name === "get_game_state"));
  assert.ok(tools.some((tool) => tool.name === "recommend_quirk_management"));

  const stateResult = await client.callTool({
    name: "get_game_state",
    arguments: { stressThreshold: 50 },
  });
  assert.equal(stateResult.isError, undefined);
  const stateContent = stateResult.structuredContent as
    | Record<string, unknown>
    | undefined;
  assert.ok(stateContent?.gameState);

  const searchResult = await client.callTool({
    name: "search_curios",
    arguments: { query: "Shambler Altar", region: "ruins" },
  });
  assert.equal(searchResult.isError, undefined);
  const searchContent = searchResult.structuredContent as
    | Record<string, unknown>
    | undefined;
  const curios = searchContent?.curios;
  assert.ok(Array.isArray(curios));
  assert.equal(
    (curios[0] as { id?: unknown } | undefined)?.id,
    "shamblers_altar",
  );

  const adviceResult = await client.callTool({
    name: "get_curio_advice",
    arguments: {
      name: "Eldritch Altar",
      availableItems: ["Holy Water"],
    },
  });
  assert.equal(adviceResult.isError, undefined);
  const adviceContent = adviceResult.structuredContent as
    | Record<string, unknown>
    | undefined;
  const advice = adviceContent?.advice as
    | { status?: unknown; recommendedInteraction?: { item?: unknown } }
    | undefined;
  assert.equal(advice?.status, "found");
  assert.equal(advice?.recommendedInteraction?.item, "holy_water");
});

test("npm package contains the runtime, knowledge, samples, and notices", async () => {
  const cacheDirectory = await mkdtemp(join(tmpdir(), "ddmcp-npm-cache-"));
  try {
    const { stdout } = await execFileAsync(
      "npm",
      ["pack", "--dry-run", "--json", "--ignore-scripts"],
      {
        cwd: projectRoot,
        encoding: "utf8",
        env: { ...process.env, npm_config_cache: cacheDirectory },
        shell: process.platform === "win32",
      },
    );
    const jsonReport = stdout.match(/(\[\s*\{\s*"id"[\s\S]*\])\s*$/)?.[1];
    assert.ok(jsonReport, "npm pack did not return a JSON report");
    const reports = JSON.parse(jsonReport) as Array<{
      files: Array<{ path: string }>;
    }>;
    const paths = new Set(reports[0]?.files.map((file) => file.path));

    for (const requiredPath of [
      "dist/mcp/stdio.js",
      "data/knowledge/curios.json",
      "data/knowledge/quirk-treatment.json",
      "docs/CLIENT_CONFIGURATION.md",
      "samples/roster-decoded.json",
      ".env.example",
      "tools/README.md",
      "README.md",
      "LICENSE.md",
      "package.json",
    ]) {
      assert.ok(paths.has(requiredPath), `package is missing ${requiredPath}`);
    }
  } finally {
    await rm(cacheDirectory, { recursive: true, force: true });
  }
});
