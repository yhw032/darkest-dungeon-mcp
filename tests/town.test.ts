import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parseTown, parseTownJson } from "../src/parser/parse-town.js";
import { SaveValidationError } from "../src/parser/roster-schema.js";
import { getTownSummary } from "../src/queries/get-town-summary.js";

function townDocument(): unknown {
  return {
    base_root: {
      version: 513,
      buildings: {
        abbey: {
          activities: {
            meditation: {
              "0": {
                hero: 42,
                visitsRemaining: 1,
                resident_occupied: 0,
                is_side_effect_result: false,
              },
            },
          },
          store: {},
        },
        stage_coach: {
          store: {
            hero_recruit: {
              generated: {
                "100": {
                  actor: { name: "레날드" },
                  heroClass: "crusader",
                  resolveXp: 2,
                  m_Stress: 0,
                },
              },
            },
          },
        },
      },
      districts: {
        buildings: {
          bank: { built: true },
          granary: { built: false },
        },
      },
    },
  };
}

test("normalizes town activities, recruits, and districts", () => {
  const town = parseTown(townDocument());
  const abbey = town.buildings.find((building) => building.id === "abbey");
  const stageCoach = town.buildings.find(
    (building) => building.id === "stage_coach",
  );

  assert.equal(abbey?.activities[0]?.slots[0]?.heroId, 42);
  assert.equal(stageCoach?.stores[0]?.recruits[0]?.name, "레날드");
  assert.deepEqual(town.districts, [
    { id: "bank", built: true },
    { id: "granary", built: false },
  ]);
});

test("reports an invalid district built value with its path", () => {
  const document = townDocument() as {
    base_root: {
      districts: { buildings: { bank: Record<string, unknown> } };
    };
  };
  document.base_root.districts.buildings.bank.built = 1;

  assert.throws(
    () => parseTown(document),
    (error) =>
      error instanceof SaveValidationError &&
      error.path === "$.base_root.districts.buildings.bank.built",
  );
});

test("parses and summarizes the checked-in town sample", async () => {
  const samplePath = fileURLToPath(
    new URL("../samples/town-decoded.json", import.meta.url),
  );
  const town = parseTownJson(await readFile(samplePath, "utf8"));
  const summary = getTownSummary(town);

  assert.equal(town.buildings.length, 11);
  assert.equal(summary.activitySlots, 24);
  assert.equal(summary.occupiedActivitySlots, 0);
  assert.equal(summary.availableRecruits, 9);
  assert.equal(summary.districts, 16);
});
