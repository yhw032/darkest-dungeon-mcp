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
    versions: { roster: number; estate: number; town: number; quests: number };
    roster: { totalHeroes: number; highStressHeroes: unknown[] };
    estate: { trinkets: { totalAmount: number } };
  };
  assert.deepEqual(output.versions, {
    roster: 513,
    estate: 34,
    town: 513,
    quests: 42,
  });
  assert.equal(output.roster.totalHeroes, 24);
  assert.equal(output.roster.highStressHeroes.length, 2);
  assert.equal(output.estate.trinkets.totalAmount, 19);
});

test("CLI reports a town summary as JSON", () => {
  const result = runCli("town");

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout) as {
    buildings: number;
    activitySlots: number;
    availableRecruits: number;
    districts: number;
  };
  assert.deepEqual(output, {
    version: 513,
    buildings: 11,
    activitySlots: 24,
    occupiedActivitySlots: 0,
    storeItemAmount: 25,
    availableRecruits: 9,
    districts: 16,
    builtDistricts: [],
  });
});

test("CLI lists filtered quests as JSON", () => {
  const result = runCli(
    "quests",
    "--dungeon",
    "weald",
    "--plot",
    "false",
  );

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout) as {
    total: number;
    quests: Array<{ dungeon: string; isPlotQuest: boolean }>;
  };
  assert.equal(output.total, 2);
  assert.ok(
    output.quests.every(
      (quest) => quest.dungeon === "weald" && !quest.isPlotQuest,
    ),
  );
});

test("CLI gets a quest by id", () => {
  const result = runCli("quest", "generated_0");

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout) as {
    quest: { id: string; dungeon: string };
  };
  assert.deepEqual(
    { id: output.quest.id, dungeon: output.quest.dungeon },
    { id: "generated_0", dungeon: "crypts" },
  );
});
