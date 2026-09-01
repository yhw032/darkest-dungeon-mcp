import assert from "node:assert/strict";
import test from "node:test";

import type { Quest } from "../src/domain/quest.js";
import {
  getQuestEligibility,
  parseQuestRestrictionRules,
} from "../src/quests/quest-eligibility.js";

const rules = parseQuestRestrictionRules(
  {
    restriction: {
      difficulty: {
        resolve_level_threshold_table: [2, 2, 3, 4, 5, 99, 99],
      },
    },
  },
  "fixture.json",
);

function quest(difficulty: number): Quest {
  return {
    saveKey: "generated_1",
    id: "generated_1",
    mapName: "crypts",
    isPlotQuest: false,
    isFromTownEvent: false,
    type: "explore",
    dungeon: "crypts",
    difficulty,
    length: 1,
    goalIds: [],
    reward: { resolveXp: 2, items: [] },
  };
}

test("applies the verified maximum resolve level for quest difficulty", () => {
  assert.deepEqual(getQuestEligibility(quest(1), 2, rules), {
    questId: "generated_1",
    questDifficulty: 1,
    status: "eligible",
    isEligible: true,
    maximumResolveLevel: 2,
    reason: null,
  });
  assert.deepEqual(getQuestEligibility(quest(1), 3, rules), {
    questId: "generated_1",
    questDifficulty: 1,
    status: "ineligible",
    isEligible: false,
    maximumResolveLevel: 2,
    reason: "resolve_level_too_high",
  });
});

test("treats the game's 99 sentinel as unrestricted", () => {
  const result = getQuestEligibility(quest(5), 6, rules);
  assert.equal(result.status, "eligible");
  assert.equal(result.maximumResolveLevel, null);
});

test("keeps missing levels and undefined difficulties unknown", () => {
  assert.equal(
    getQuestEligibility(quest(1), null, rules).reason,
    "resolve_level_unavailable",
  );
  assert.equal(
    getQuestEligibility(quest(9), 1, rules).reason,
    "quest_difficulty_undefined",
  );
  assert.equal(
    getQuestEligibility(quest(1), 1).reason,
    "restriction_rules_unavailable",
  );
});

test("rejects malformed restriction tables", () => {
  assert.throws(
    () =>
      parseQuestRestrictionRules(
        {
          restriction: {
            difficulty: { resolve_level_threshold_table: [2, -1] },
          },
        },
        "fixture.json",
      ),
    /non-negative integer/,
  );
});
