import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  GameStateLoadError,
  loadGameState,
} from "../src/loaders/load-game-state.js";
import { getGameStateSummary } from "../src/queries/get-game-state-summary.js";

const rosterPath = fileURLToPath(
  new URL("../samples/roster-decoded.json", import.meta.url),
);
const estatePath = fileURLToPath(
  new URL("../samples/estate-decoded.json", import.meta.url),
);
const townPath = fileURLToPath(
  new URL("../samples/town-decoded.json", import.meta.url),
);
const questPath = fileURLToPath(
  new URL("../samples/quest-decoded.json", import.meta.url),
);
const upgradesPath = fileURLToPath(
  new URL("../samples/upgrades-decoded.json", import.meta.url),
);

test("loads all save components into one game state", async () => {
  const gameState = await loadGameState({
    rosterPath,
    estatePath,
    townPath,
    questPath,
    upgradesPath,
  });

  assert.equal(gameState.roster.heroes.length, 24);
  assert.equal(
    gameState.estate.resources.find((resource) => resource.type === "gold")
      ?.amount,
    30790,
  );
  assert.equal(gameState.town.buildings.length, 11);
  assert.equal(gameState.quests.quests.length, 11);
  assert.equal(gameState.upgrades.purchases.length, 713);
});

test("builds a combined game-state summary", async () => {
  const gameState = await loadGameState({
    rosterPath,
    estatePath,
    townPath,
    questPath,
    upgradesPath,
  });
  const summary = getGameStateSummary(gameState, 150);

  assert.deepEqual(summary.versions, {
    roster: 513,
    estate: 34,
    town: 513,
    quests: 42,
    upgrades: 1,
  });
  assert.equal(summary.roster.activeHeroes, 18);
  assert.equal(summary.roster.deceasedHeroes, 6);
  assert.equal(summary.roster.unknownStateHeroes, 0);
  assert.equal(summary.roster.totalHeroRecords, 24);
  assert.deepEqual(
    summary.roster.highStressHeroes.map((hero) => hero.stress),
    [],
  );
  assert.equal(
    summary.estate.resources.find((resource) => resource.type === "gold")
      ?.amount,
    30790,
  );
  assert.equal(summary.estate.trinkets.totalAmount, 19);
  assert.equal(summary.town.stagecoachRecruitCount, 9);
  assert.equal(summary.quests.totalQuests, 11);
  assert.deepEqual(summary.upgrades, {
    totalPurchases: 713,
    purchased: 713,
  });
});

test("identifies the component and path when loading fails", async () => {
  const missingEstatePath = fileURLToPath(
    new URL("../samples/missing-estate.json", import.meta.url),
  );

  await assert.rejects(
    loadGameState({
      rosterPath,
      estatePath: missingEstatePath,
      townPath,
      questPath,
      upgradesPath,
    }),
    (error) =>
      error instanceof GameStateLoadError &&
      error.component === "estate" &&
      error.filePath === missingEstatePath &&
      error.message.includes("Failed to load estate"),
  );
});
