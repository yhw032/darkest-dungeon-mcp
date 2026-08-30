import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

function runCli(...args: string[]) {
  return spawnSync(
    process.execPath,
    ["--import", "tsx", "src/cli/index.ts", ...args],
    { cwd: projectRoot, encoding: "utf8" },
  );
}

test("CLI lists filtered heroes as JSON", () => {
  const result = runCli(
    "heroes",
    "--class",
    "vestal",
    "--max-stress",
    "40",
  );

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout) as {
    total: number;
    heroes: Array<{ heroClass: string; stress: number }>;
  };
  assert.equal(output.total, 2);
  assert.ok(
    output.heroes.every(
      (hero) => hero.heroClass === "vestal" && hero.stress <= 40,
    ),
  );
});

test("CLI reports an unknown hero on stderr", () => {
  const result = runCli("hero", "missing");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Hero not found: missing/);
  assert.equal(result.stdout, "");
});
