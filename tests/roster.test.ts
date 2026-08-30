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
                "roster.building_name": "",
                actor: { name: "레날드", current_hp: 24 },
                heroClass: "crusader",
                resolveXp: 6,
                m_Stress: 12,
                weapon_rank: 1,
                armour_rank: 2,
                affliction_type_id: "",
                affliction_severity: 0,
                virtue_type_id: "focused",
                visited_deaths_door: false,
                has_had_heart_attack: false,
                is_death_heart_attack_completed: false,
                quirks: {
                  warrior_of_light: {
                    is_new: true,
                    is_locked: false,
                    evolution_duration_remaining: 0,
                  },
                },
                trinkets: {
                  items: {
                    "0": { id: "defenders_seal", type: "trinket", amount: 1 },
                  },
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
    buildingName: null,
    currentHp: 24,
    weaponRank: 1,
    armourRank: 2,
    afflictionId: null,
    afflictionSeverity: 0,
    virtueId: "focused",
    visitedDeathsDoor: false,
    hasHadHeartAttack: false,
    deathHeartAttackCompleted: false,
    quirks: [
      {
        id: "warrior_of_light",
        isLocked: false,
        isNew: true,
        evolutionDurationRemaining: 0,
      },
    ],
    equippedTrinkets: [
      { id: "defenders_seal", type: "trinket", amount: 1 },
    ],
    combatSkills: ["smite", "stunning_blow"],
    campingSkills: ["zealous_speech"],
    combatSkillSelections: [
      { id: "smite", value: 0 },
      { id: "stunning_blow", value: 1 },
    ],
    campingSkillSelections: [{ id: "zealous_speech", value: 0 }],
  });
});

test("uses empty collections for optional quirks and skills", () => {
  const roster = parseRoster(heroDocument({ quirks: undefined, skills: undefined }));
  const hero = roster.heroes[0];

  assert.ok(hero);
  assert.deepEqual(hero.quirks, []);
  assert.deepEqual(hero.combatSkills, []);
  assert.deepEqual(hero.campingSkills, []);
  assert.deepEqual(hero.combatSkillSelections, []);
  assert.deepEqual(hero.campingSkillSelections, []);
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
  const hellion = roster.heroes.find((hero) => hero.id === "18");
  assert.equal(hellion?.weaponRank, 2);
  assert.equal(hellion?.armourRank, 2);
  assert.deepEqual(
    hellion?.equippedTrinkets.map((trinket) => trinket.id),
    ["heavens_hairpin", "collector_1"],
  );
  assert.equal(hellion?.afflictionId, null);

  const afflictedHero = roster.heroes.find((hero) => hero.id === "7");
  assert.equal(afflictedHero?.afflictionId, "depressed");
  assert.equal(afflictedHero?.buildingName, null);
});
