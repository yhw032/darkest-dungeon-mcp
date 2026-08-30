import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  parseRoster,
  parseRosterJson,
} from "../src/parser/parse-roster.js";
import { SaveValidationError } from "../src/parser/roster-schema.js";

function heroDocument(overrides: Record<string, unknown> = {}): unknown {
  return {
    base_root: {
      version: 513,
      nextGuid: 2,
      heroes: {
        "1": {
          hero_file_data: {
            raw_data: {
              base_root: {
                "roster.status": 0,
                actor: { name: "레날드", current_hp: 24 },
                heroClass: "crusader",
                resolveXp: 6,
                m_Stress: 12,
                quirks: {
                  warrior_of_light: { is_new: true, is_locked: false },
                },
                skills: {
                  selected_combat_skills: { smite: 0, stunning_blow: 1 },
                  selected_camping_skills: { zealous_speech: 0 },
                },
                ...overrides,
              },
            },
          },
        },
      },
    },
  };
}

test("normalizes a decoded hero", () => {
  const roster = parseRoster(heroDocument());

  assert.equal(roster.version, 513);
  assert.deepEqual(roster.heroes[0], {
    id: "1",
    name: "레날드",
    heroClass: "crusader",
    resolveXp: 6,
    stress: 12,
    rosterStatus: 0,
    currentHp: 24,
    quirks: [{ id: "warrior_of_light", isLocked: false, isNew: true }],
    combatSkills: ["smite", "stunning_blow"],
    campingSkills: ["zealous_speech"],
  });
});

test("uses empty collections for optional quirks and skills", () => {
  const roster = parseRoster(heroDocument({ quirks: undefined, skills: undefined }));
  const hero = roster.heroes[0];

  assert.ok(hero);
  assert.deepEqual(hero.quirks, []);
  assert.deepEqual(hero.combatSkills, []);
  assert.deepEqual(hero.campingSkills, []);
});

test("reports the failing save path", () => {
  assert.throws(
    () => parseRoster(heroDocument({ m_Stress: "high" })),
    (error) =>
      error instanceof SaveValidationError &&
      error.path.endsWith(".m_Stress") &&
      error.message.includes("expected a finite number"),
  );
});

test("reports malformed JSON", () => {
  assert.throws(
    () => parseRosterJson("{not-json"),
    (error) =>
      error instanceof SaveValidationError && error.message.includes("invalid JSON"),
  );
});

test("parses the checked-in sample and preserves Korean names", async () => {
  const samplePath = fileURLToPath(
    new URL("../samples/roster-decoded.json", import.meta.url),
  );
  const roster = parseRosterJson(await readFile(samplePath, "utf8"));

  assert.equal(roster.heroes.length, 24);
  assert.ok(roster.heroes.some((hero) => hero.name === "프리보이"));
});
