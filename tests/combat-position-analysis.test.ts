import assert from "node:assert/strict";
import test from "node:test";

import type { HeroCombatSkillDetail } from "../src/domain/hero-skills.js";
import { analyzeHeroCombatPositions } from "../src/skills/analyze-combat-positions.js";

function skill(
  id: string,
  usableFromPartyPositions: number[] | null,
): HeroCombatSkillDetail {
  return {
    id,
    level: 1,
    isSelected: true,
    rawSelectionValue: 0,
    usableFromPartyPositions,
    target: null,
    movement: null,
  };
}

test("calculates complete position coverage without an editorial threshold", () => {
  const result = analyzeHeroCombatPositions([
    skill("pick", [1, 2, 3]),
    skill("lunge", [3, 4]),
    skill("thrown_dagger", [2, 3, 4]),
    skill("poison_dart", [2, 3, 4]),
  ]);

  assert.equal(result.status, "complete");
  assert.deepEqual(result.fullyUsablePartyPositions, [3]);
  assert.deepEqual(result.bestCoveragePartyPositions, [3]);
  assert.deepEqual(result.positionCoverage[1], {
    partyPosition: 2,
    usableSkillIds: ["pick", "thrown_dagger", "poison_dart"],
    unusableSkillIds: ["lunge"],
    unknownSkillIds: [],
  });
});

test("keeps unknown skill positions explicit in partial analysis", () => {
  const result = analyzeHeroCombatPositions([
    skill("known", [2, 3]),
    skill("unknown", null),
  ]);

  assert.equal(result.status, "partial");
  assert.deepEqual(result.fullyUsablePartyPositions, []);
  assert.deepEqual(result.bestCoveragePartyPositions, [2, 3]);
  assert.deepEqual(result.positionCoverage[1]?.unknownSkillIds, ["unknown"]);
});

test("returns unavailable analysis without selected position definitions", () => {
  const unselected = { ...skill("not_selected", [1]), isSelected: false };
  assert.deepEqual(analyzeHeroCombatPositions([unselected]), {
    status: "unavailable",
    selectedSkillCount: 0,
    definedSkillCount: 0,
    positionNumbering: { front: 1, back: 4 },
    positionCoverage: [1, 2, 3, 4].map((partyPosition) => ({
      partyPosition,
      usableSkillIds: [],
      unusableSkillIds: [],
      unknownSkillIds: [],
    })),
    fullyUsablePartyPositions: [],
    bestCoveragePartyPositions: [],
  });
});
