import assert from "node:assert/strict";
import test from "node:test";

import type { GameState } from "../src/domain/game-state.js";
import { CachedGameStateDataSource } from "../src/mcp/data-source.js";

function gameState(version: number): GameState {
  return {
    roster: { version, nextGuid: 0, heroes: [] },
    estate: {
      version,
      resources: [],
      trinkets: [],
      estateItems: [],
    },
    town: { version, buildings: [], districts: [] },
    quests: { version, plotQuestTotal: 0, quests: [] },
    upgrades: { version, purchases: [] },
  };
}

test("reuses one snapshot within the TTL and coalesces concurrent loads", async () => {
  let now = 1_000;
  let loads = 0;
  const source = new CachedGameStateDataSource(
    async () => gameState(++loads),
    { source: "live", ttlMs: 100, now: () => now },
  );

  const [first, concurrent] = await Promise.all([source.load(), source.load()]);
  const firstSnapshot = source.getSnapshotInfo();
  assert.equal(loads, 1);
  assert.strictEqual(first, concurrent);
  assert.equal(firstSnapshot?.source, "live");

  now = 1_099;
  assert.strictEqual(await source.load(), first);
  assert.equal(loads, 1);

  now = 1_100;
  const expired = await source.load();
  assert.equal(loads, 2);
  assert.notStrictEqual(expired, first);
  assert.notEqual(source.getSnapshotInfo()?.snapshotId, firstSnapshot?.snapshotId);
});

test("refresh replaces a valid snapshot immediately", async () => {
  let loads = 0;
  const source = new CachedGameStateDataSource(
    async () => gameState(++loads),
    { source: "live", ttlMs: 10_000, now: () => 1_000 },
  );

  await source.load();
  const firstId = source.getSnapshotInfo()?.snapshotId;
  const refreshed = await source.refresh();

  assert.equal(loads, 2);
  assert.notEqual(refreshed.snapshotId, firstId);
  assert.equal((await source.load()).roster.version, 2);
});

test("an older in-flight load cannot replace a refreshed snapshot", async () => {
  const resolvers: Array<(state: GameState) => void> = [];
  const source = new CachedGameStateDataSource(
    () =>
      new Promise<GameState>((resolve) => {
        resolvers.push(resolve);
      }),
    { source: "live", ttlMs: 10_000, now: () => 1_000 },
  );

  const initialLoad = source.load();
  await Promise.resolve();
  const refresh = source.refresh();
  await Promise.resolve();
  assert.equal(resolvers.length, 2);

  resolvers[1]?.(gameState(2));
  await refresh;
  resolvers[0]?.(gameState(1));
  await initialLoad;

  assert.equal((await source.load()).roster.version, 2);
});

test("retries after a snapshot load fails", async () => {
  let attempts = 0;
  const source = new CachedGameStateDataSource(
    async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("decode failed");
      return gameState(2);
    },
    { source: "live", ttlMs: 100, now: () => 1_000 },
  );

  await assert.rejects(source.load(), /decode failed/);
  assert.equal(source.getSnapshotInfo(), null);
  assert.equal((await source.load()).roster.version, 2);
  assert.equal(attempts, 2);
});
