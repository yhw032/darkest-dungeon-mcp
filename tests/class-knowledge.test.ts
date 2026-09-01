import assert from "node:assert/strict";
import test from "node:test";

import {
  ClassKnowledgeValidationError,
  parseClassKnowledge,
  parseClassKnowledgeJson,
} from "../src/knowledge/class-knowledge-schema.js";
import { loadClassKnowledge } from "../src/knowledge/load-class-knowledge.js";
import {
  findClassSkillGuidanceMismatches,
  validateClassSkillGuidance,
} from "../src/knowledge/validate-class-skill-guidance.js";
import type { HeroCombatSkillPositionDefinition } from "../src/domain/hero-skills.js";

const expectedSkillIds: Record<string, string[]> = {
  abomination: ["transform", "manacles", "vomit", "absolution", "rake", "rage", "slam"],
  antiquarian: ["kris_stab", "festering_vapours", "cower", "flashpowder", "fortifying_vapours", "invigorating_vapours", "protect_me"],
  arbalest: ["sniper_shot", "suppressing_fire", "sniper_mark", "bola", "blindfire", "battlefield_bandage", "flare"],
  bounty_hunter: ["collect_bounty", "target_tag", "come_hither", "uppercut", "flashbang", "finish_him", "hook_and_slice"],
  crusader: ["smite", "zealous_accusation", "stunning_blow", "bulwark_of_faith", "battle_heal", "holy_lance", "inspiring_cry"],
  flagellant: ["punish", "rain_of_sorrows", "exsanguinate", "reclaim", "redeem", "endure", "suffer"],
  grave_robber: ["pick", "lunge", "flashing_daggers", "shadow_fade", "thrown_dagger", "poison_dart", "toxin_trickery"],
  hellion: ["wicked_hack", "iron_swan", "barbaric_yawp", "if_it_bleeds", "breakthru", "adrenaline_rush", "bleed_out"],
  highwayman: ["wicked_slice", "pistol_shot", "point_blank_shot", "grape_shot_blast", "take_aim", "duelist_advance", "opened_vein"],
  houndmaster: ["hounds_rush", "hounds_harry", "whistle", "howl", "guard_dog", "lick_wounds", "blackjack"],
  jester: ["dirk_stab", "harvest", "heroic_end", "solo", "slice_off", "battle_ballad", "inspiring_tune"],
  leper: ["chop", "hew", "focus", "revenge", "withstand", "solemnity", "intimidate"],
  man_at_arms: ["crush", "rampart", "bellow", "defender", "retribution", "command", "bolster"],
  musketeer: ["aimed_shot", "smokescreen", "call_the_shot", "buckshot", "sidearm", "patch_up", "skeet_shot"],
  occultist: ["bloodlet", "abyssal_artillery", "weakening_curse", "wyrd_reconstruction", "disruptive_curse", "hands_from_abyss", "daemons_pull"],
  plague_doctor: ["noxious_blast", "plague_grenade", "blinding_gas", "incision", "battlefield_medicine", "emboldening_vapours", "disorienting_blast"],
  shieldbreaker: ["pierce", "break_guard", "adders_kiss", "spearing", "expose", "single_out", "serpents_sway"],
  vestal: ["mace_bash", "judgement", "dazzling_light", "divine_grace", "gods_comfort", "gods_illumination", "gods_hand"],
};

function positionDefinitions(): HeroCombatSkillPositionDefinition[] {
  return Object.entries(expectedSkillIds).flatMap(([heroClass, skillIds]) =>
    skillIds.map((skillId) => ({
      heroClass,
      skillId,
      usableFromPartyPositions: [1],
      target: { side: "enemy" as const, mode: "single" as const, positions: [1] },
      movement: { backward: 0, forward: 0 },
    })),
  );
}

function validKnowledge(): unknown {
  return {
    schemaVersion: 1,
    classes: [
      {
        id: "plague_doctor",
        names: { en: "Plague Doctor", ko: "역병 의사" },
        aliases: [],
        dlcs: [],
        summary: "A backline controller specializing in blight and stuns.",
        roles: ["control", "blight"],
        strengths: ["Can affect both enemy back ranks with one skill."],
        limitations: ["Direct damage is initially low."],
        positionGuidance: [
          {
            positions: [3, 4],
            recommendation: "preferred",
            reason: "Most ranged skills remain available.",
          },
        ],
        mechanics: [
          { id: "blight", description: "Applies damage over time." },
        ],
        skillGuidance: [
          {
            skillId: "plague_grenade",
            useCases: ["Pressure two backline enemies."],
            synergies: ["Benefits from blight resistance reduction."],
            cautions: ["Cannot target the front ranks."],
          },
        ],
        partySynergies: [
          {
            heroClassId: "abomination",
            reasons: ["Can contribute additional blight damage."],
          },
        ],
        sources: [
          {
            title: "Test source",
            url: "https://example.com/plague-doctor",
            verifiedAt: "2026-09-01",
          },
        ],
      },
    ],
  };
}

test("validates structured class and skill guidance", () => {
  const knowledge = parseClassKnowledge(validKnowledge());

  assert.equal(knowledge.classes[0]?.id, "plague_doctor");
  assert.deepEqual(knowledge.classes[0]?.positionGuidance[0]?.positions, [3, 4]);
  assert.equal(
    knowledge.classes[0]?.skillGuidance[0]?.skillId,
    "plague_grenade",
  );
});

test("rejects invalid party positions with a precise path", () => {
  const knowledge = validKnowledge() as {
    classes: Array<{
      positionGuidance: Array<{ positions: number[] }>;
    }>;
  };
  knowledge.classes[0]!.positionGuidance[0]!.positions = [0];

  assert.throws(
    () => parseClassKnowledge(knowledge),
    (error) =>
      error instanceof ClassKnowledgeValidationError &&
      error.path === "$.classes[0].positionGuidance[0].positions[0]",
  );
});

test("rejects duplicate class ids", () => {
  const knowledge = validKnowledge() as { classes: unknown[] };
  knowledge.classes.push(structuredClone(knowledge.classes[0]));

  assert.throws(
    () => parseClassKnowledge(knowledge),
    (error) =>
      error instanceof ClassKnowledgeValidationError &&
      error.path === "$.classes[1].id",
  );
});

test("rejects duplicate skill guidance", () => {
  const knowledge = validKnowledge() as {
    classes: Array<{ skillGuidance: unknown[] }>;
  };
  knowledge.classes[0]!.skillGuidance.push(
    structuredClone(knowledge.classes[0]!.skillGuidance[0]),
  );

  assert.throws(
    () => parseClassKnowledge(knowledge),
    (error) =>
      error instanceof ClassKnowledgeValidationError &&
      error.path === "$.classes[0].skillGuidance[1]",
  );
});

test("rejects malformed class knowledge JSON", () => {
  assert.throws(
    () => parseClassKnowledgeJson("{"),
    (error) =>
      error instanceof ClassKnowledgeValidationError && error.path === "$",
  );
});

test("loads the checked-in class knowledge base", async () => {
  const knowledge = await loadClassKnowledge();

  assert.equal(knowledge.schemaVersion, 1);
  assert.equal(knowledge.classes.length, 18);
  assert.deepEqual(
    knowledge.classes.map(({ id }) => id).sort(),
    [
      "abomination", "antiquarian", "arbalest", "bounty_hunter",
      "crusader", "flagellant", "grave_robber", "hellion", "highwayman",
      "houndmaster", "jester", "leper", "man_at_arms", "musketeer",
      "occultist", "plague_doctor", "shieldbreaker", "vestal"
    ],
  );
  assert.ok(
    knowledge.classes.every(
      ({ roles, strengths, positionGuidance, sources }) =>
        roles.length > 0 && strengths.length > 0 &&
        positionGuidance.length > 0 && sources.length > 0,
    ),
  );
  assert.deepEqual(
    knowledge.classes.filter(({ dlcs }) => dlcs.length > 0)
      .map(({ id }) => id).sort(),
    ["flagellant", "musketeer", "shieldbreaker"],
  );
  assert.equal(
    knowledge.classes.reduce(
      (total, classKnowledge) => total + classKnowledge.skillGuidance.length,
      0,
    ),
    126,
  );
  validateClassSkillGuidance(knowledge, positionDefinitions());
});

test("reports missing and unknown skill guidance against game definitions", async () => {
  const knowledge = structuredClone(await loadClassKnowledge());
  knowledge.classes.find(({ id }) => id === "plague_doctor")!
    .skillGuidance[0]!.skillId = "invented_skill";

  assert.deepEqual(
    findClassSkillGuidanceMismatches(knowledge, positionDefinitions()),
    [
      {
        heroClass: "plague_doctor",
        missingGuidanceSkillIds: ["noxious_blast"],
        unknownGuidanceSkillIds: ["invented_skill"],
      },
    ],
  );
});
