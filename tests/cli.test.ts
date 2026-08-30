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

test("CLI reports estate resources as JSON", () => {
  const result = runCli("resources");

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout) as {
    resources: Array<{ type: string; amount: number }>;
    trinkets: { stacks: number; totalAmount: number };
  };
  assert.equal(
    output.resources.find((resource) => resource.type === "gold")?.amount,
    30790,
  );
  assert.deepEqual(output.trinkets, { stacks: 19, totalAmount: 19 });
});

test("CLI reports the combined game state as JSON", () => {
  const result = runCli("state", "--stress-threshold", "150");

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout) as {
    versions: { roster: number; estate: number };
    roster: { totalHeroes: number; highStressHeroes: unknown[] };
    estate: { trinkets: { totalAmount: number } };
  };
  assert.deepEqual(output.versions, { roster: 513, estate: 34 });
  assert.equal(output.roster.totalHeroes, 24);
  assert.equal(output.roster.highStressHeroes.length, 2);
  assert.equal(output.estate.trinkets.totalAmount, 19);
});
