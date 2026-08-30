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

test("loads roster and estate into one game state", async () => {
  const gameState = await loadGameState({ rosterPath, estatePath });

  assert.equal(gameState.roster.heroes.length, 24);
  assert.equal(
    gameState.estate.resources.find((resource) => resource.type === "gold")
      ?.amount,
    30790,
  );
});

test("builds a combined game-state summary", async () => {
  const gameState = await loadGameState({ rosterPath, estatePath });
  const summary = getGameStateSummary(gameState, 150);

  assert.deepEqual(summary.versions, { roster: 513, estate: 34 });
  assert.equal(summary.roster.totalHeroes, 24);
  assert.deepEqual(
    summary.roster.highStressHeroes.map((hero) => hero.stress),
    [200, 179],
  );
  assert.equal(
    summary.estate.resources.find((resource) => resource.type === "gold")
      ?.amount,
    30790,
  );
  assert.equal(summary.estate.trinkets.totalAmount, 19);
});

test("identifies the component and path when loading fails", async () => {
  const missingEstatePath = fileURLToPath(
    new URL("../samples/missing-estate.json", import.meta.url),
  );

  await assert.rejects(
    loadGameState({ rosterPath, estatePath: missingEstatePath }),
    (error) =>
      error instanceof GameStateLoadError &&
      error.component === "estate" &&
      error.filePath === missingEstatePath &&
      error.message.includes("Failed to load estate"),
  );
});
