import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  parseQuestState,
  parseQuestStateJson,
} from "../src/parser/parse-quest.js";
import { SaveValidationError } from "../src/parser/roster-schema.js";
import { getQuest } from "../src/queries/get-quest.js";
import { getQuestStateSummary } from "../src/queries/get-quest-state-summary.js";
import { listQuests } from "../src/queries/list-quests.js";
import {
  localizeDungeon,
  localizeQuest,
} from "../src/quests/localize-quest.js";

function questDocument(): unknown {
  return {
    base_root: {
      version: 42,
      plot_quest_total: 10,
      quests: {
        "0": {
          id: "generated_0",
          map_name: "",
          is_plot_quest: false,
          is_from_town_event: false,
          type: "explore",
          dungeon: "weald",
          difficulty: 1,
          length: 2,
          goal_ids: ["explore"],
          completion_reward: {
            resolve_xp: 3,
            items_definition: {
              items: {
                "0": { id: "", type: "gold", amount: 4500 },
                "1": { id: "deed", type: "heirloom", amount: 5 },
              },
            },
          },
        },
      },
    },
  };
}

test("normalizes quest metadata and rewards", () => {
  const state = parseQuestState(questDocument());
  const quest = state.quests[0];

  assert.equal(quest?.saveKey, "0");
  assert.equal(quest?.dungeon, "weald");
  assert.equal(quest?.reward.resolveXp, 3);
  assert.deepEqual(quest?.reward.items, [
    { id: "", type: "gold", amount: 4500 },
    { id: "deed", type: "heirloom", amount: 5 },
  ]);
});

test("reports an invalid goal id with its path", () => {
  const document = questDocument() as {
    base_root: { quests: { "0": Record<string, unknown> } };
  };
  document.base_root.quests["0"].goal_ids = [1];

  assert.throws(
    () => parseQuestState(document),
    (error) =>
      error instanceof SaveValidationError &&
      error.path === "$.base_root.quests.0.goal_ids.0",
  );
});

test("filters and retrieves quests", () => {
  const state = parseQuestState(questDocument());

  assert.equal(listQuests(state, { dungeon: "weald" }).length, 1);
  assert.equal(listQuests(state, { isPlotQuest: true }).length, 0);
  assert.equal(getQuest(state, "generated_0")?.type, "explore");
  assert.equal(getQuest(state, "missing"), undefined);
});

test("selects one verified dungeon name for the requested language", () => {
  const quest = getQuest(parseQuestState(questDocument()), "generated_0");
  assert.ok(quest);
  assert.deepEqual(localizeQuest(quest, "ko").dungeon, {
    id: "weald",
    name: "삼림지대",
  });
  assert.deepEqual(localizeDungeon("weald", "en"), {
    id: "weald",
    name: "Weald",
  });
  assert.deepEqual(localizeDungeon("modded_region", "ko"), {
    id: "modded_region",
    name: null,
  });
});

test("covers every dungeon id in the checked-in quest sample", async () => {
  const samplePath = fileURLToPath(
    new URL("../samples/quest-decoded.json", import.meta.url),
  );
  const state = parseQuestStateJson(await readFile(samplePath, "utf8"));
  const localized = new Map(
    state.quests.map((quest) => [
      quest.dungeon,
      localizeDungeon(quest.dungeon, "ko").name,
    ]),
  );

  assert.deepEqual(Object.fromEntries(localized), {
    cove: "해안 만",
    crypts: "폐허",
    darkestdungeon: "가장 어두운 던전",
    warrens: "사육장",
    farm: "농장",
    courtyard: "안뜰",
    weald: "삼림지대",
  });
});

test("parses and summarizes the checked-in quest sample", async () => {
  const samplePath = fileURLToPath(
    new URL("../samples/quest-decoded.json", import.meta.url),
  );
  const state = parseQuestStateJson(await readFile(samplePath, "utf8"));
  const summary = getQuestStateSummary(state);

  assert.equal(state.quests.length, 11);
  assert.equal(summary.plotQuests, 6);
  assert.equal(summary.generatedQuests, 5);
  assert.deepEqual(summary.byDungeon, {
    cove: 2,
    crypts: 2,
    darkestdungeon: 1,
    warrens: 2,
    farm: 1,
    courtyard: 1,
    weald: 2,
  });
});
