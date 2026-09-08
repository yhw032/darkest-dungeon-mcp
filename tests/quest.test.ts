import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  loadQuestLocalization,
  localizeDungeon,
  localizeQuest,
  type QuestLocalization,
} from "../src/quests/localize-quest.js";

function questLocalization(): QuestLocalization {
  return new Map([
    [
      "english",
      new Map([
        ["dungeon_name_weald", "Weald"],
        ["town_quest_name_explore+2+weald+explore", "Scout the Weald"],
        [
          "town_quest_description_explore+2+weald+explore",
          "Explore the target area.",
        ],
        ["town_quest_length_2", "Medium"],
        ["str_inventory_title_gold", "Gold"],
      ]),
    ],
    [
      "koreana",
      new Map([
        ["dungeon_name_cove", "해안 만"],
        ["dungeon_name_crypts", "폐허"],
        ["dungeon_name_darkestdungeon", "가장 어두운 던전"],
        ["dungeon_name_warrens", "사육장"],
        ["dungeon_name_farm", "농장"],
        ["dungeon_name_courtyard", "안뜰"],
        ["dungeon_name_weald", "삼림지대"],
      ]),
    ],
  ]);
}

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
  assert.equal(listQuests(state, { dungeon: "WEALD" }).length, 1);
  assert.equal(listQuests(state, { isPlotQuest: true }).length, 0);
  assert.equal(getQuest(state, "generated_0")?.type, "explore");
  assert.equal(getQuest(state, "missing"), undefined);
});

test("selects one verified dungeon name for the requested language", () => {
  const quest = getQuest(parseQuestState(questDocument()), "generated_0");
  assert.ok(quest);
  const localization = questLocalization();
  assert.deepEqual(localizeQuest(quest, "ko", localization).dungeon, {
    id: "weald",
    name: "삼림지대",
  });
  assert.deepEqual(localizeDungeon("weald", "en", localization), {
    id: "weald",
    name: "Weald",
  });
  assert.deepEqual(localizeDungeon("modded_region", "ko", localization), {
    id: "modded_region",
    name: null,
  });
  const localizedQuest = localizeQuest(quest, "en", localization);
  assert.equal(localizedQuest.title, "Scout the Weald");
  assert.equal(localizedQuest.description, "Explore the target area.");
  assert.deepEqual(localizedQuest.length, { value: 2, name: "Medium" });
  assert.equal(localizedQuest.reward.items[0]?.name, "Gold");
});

test("covers every dungeon id in the checked-in quest sample", async () => {
  const samplePath = fileURLToPath(
    new URL("../samples/quest-decoded.json", import.meta.url),
  );
  const state = parseQuestStateJson(await readFile(samplePath, "utf8"));
  const localized = new Map(
    state.quests.map((quest) => [
      quest.dungeon,
      localizeDungeon(quest.dungeon, "ko", questLocalization()).name,
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

test("loads base and official DLC dungeon names from game localization", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dd-quest-localization-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const basePath = join(root, "localization", "miscellaneous.string_table.xml");
  const courtPath = join(
    root,
    "dlc",
    "580100_crimson_court",
    "localization",
    "CC.string_table.xml",
  );
  const farmPath = join(
    root,
    "dlc",
    "735730_color_of_madness",
    "localization",
    "CoM.string_table.xml",
  );
  await Promise.all([
    mkdir(join(root, "localization"), { recursive: true }),
    mkdir(join(root, "dlc", "580100_crimson_court", "localization"), {
      recursive: true,
    }),
    mkdir(join(root, "dlc", "735730_color_of_madness", "localization"), {
      recursive: true,
    }),
  ]);
  const table = (language: string, id: string, name: string) =>
    `<root><language id="${language}"><entry id="${id}"><![CDATA[${name}]]></entry></language></root>`;
  await Promise.all([
    writeFile(basePath, table("koreana", "dungeon_name_crypts", "폐허")),
    writeFile(courtPath, table("koreana", "dungeon_name_courtyard", "안뜰")),
    writeFile(farmPath, table("koreana", "dungeon_name_farm", "농장")),
  ]);

  const localization = await loadQuestLocalization(root);
  assert.equal(localizeDungeon("crypts", "ko", localization).name, "폐허");
  assert.equal(localizeDungeon("courtyard", "ko", localization).name, "안뜰");
  assert.equal(localizeDungeon("farm", "ko", localization).name, "농장");
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
