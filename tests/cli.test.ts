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

test("CLI reports expanded hero details and town context", () => {
  const result = runCli("hero", "18");

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout) as {
    hero: {
      weaponRank: number;
      armourRank: number;
      equippedTrinkets: Array<{ id: string }>;
    };
    town: { buildingName: string | null; activityAssignments: unknown[] };
  };
  assert.equal(output.hero.weaponRank, 2);
  assert.equal(output.hero.armourRank, 2);
  assert.deepEqual(
    output.hero.equippedTrinkets.map((trinket) => trinket.id),
    ["heavens_hairpin", "collector_1"],
  );
  assert.deepEqual(output.town, {
    buildingName: null,
    activityAssignments: [],
  });
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
    versions: {
      roster: number;
      estate: number;
      town: number;
      quests: number;
      upgrades: number;
    };
    roster: { totalHeroes: number; highStressHeroes: unknown[] };
    estate: { trinkets: { totalAmount: number } };
  };
  assert.deepEqual(output.versions, {
    roster: 513,
    estate: 34,
    town: 513,
    quests: 42,
    upgrades: 1,
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

test("CLI lists trinkets by location", () => {
  const result = runCli("trinkets", "--location", "equipped");

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout) as {
    total: number;
    trinkets: Array<{ equippedBy: unknown[] }>;
  };
  assert.equal(output.total, 9);
  assert.ok(output.trinkets.every((trinket) => trinket.equippedBy.length > 0));
});

test("CLI gets one trinket across all locations", () => {
  const result = runCli("trinket", "flag_5");

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout) as {
    trinket: {
      storageAmount: number;
      equippedBy: Array<{ heroId: string }>;
      storeAmount: number;
    };
  };
  assert.equal(output.trinket.storageAmount, 1);
  assert.deepEqual(
    output.trinket.equippedBy.map((assignment) => assignment.heroId),
    ["150"],
  );
  assert.equal(output.trinket.storeAmount, 0);
});

test("CLI requires a save directory for live state", () => {
  const result = runCli("live-state");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /live-state requires --save-dir/);
  assert.equal(result.stdout, "");
});
