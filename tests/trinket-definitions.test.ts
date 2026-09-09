import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  loadTrinketDefinitions,
  parseBuffs,
  parseRawTrinkets,
} from "../src/trinkets/load-trinket-definitions.js";

test("parses raw trinket entries with class requirements and buff ids", () => {
  const parsed = parseRawTrinkets(
    {
      entries: [
        {
          id: "sacred_scroll",
          buffs: ["BUFF_HEAL", "BUFF_STRESS"],
          hero_class_requirements: ["vestal"],
          rarity: "very_rare",
          price: 25000,
          limit: 0,
          origin_dungeon: "",
        },
        {
          id: "focus_ring",
          buffs: ["BUFF_ACC"],
          hero_class_requirements: [],
          rarity: "rare",
          price: 15000,
          limit: 1,
          origin_dungeon: "cove",
        },
      ],
    },
    "test.trinkets.json",
  );

  assert.equal(parsed.length, 2);
  assert.deepEqual(parsed[0], {
    id: "sacred_scroll",
    buffIds: ["BUFF_HEAL", "BUFF_STRESS"],
    heroClassRequirements: ["vestal"],
    rarity: "very_rare",
    price: 25000,
    shardPrice: null,
    limit: 0,
    originDungeon: null,
  });
  assert.deepEqual(parsed[1], {
    id: "focus_ring",
    buffIds: ["BUFF_ACC"],
    heroClassRequirements: [],
    rarity: "rare",
    price: 15000,
    shardPrice: null,
    limit: 1,
    originDungeon: "cove",
  });
});

test("parses Color of Madness shard costs without inventing a gold price", () => {
  const parsed = parseRawTrinkets(
    {
      entries: [
        {
          id: "com_lens_of_comet",
          buffs: [],
          hero_class_requirements: [],
          rarity: "comet",
          shard: 25,
          limit: 1,
          origin_dungeon: "",
        },
      ],
    },
    "com.entries.trinkets.json",
  );

  assert.equal(parsed[0]?.price, null);
  assert.equal(parsed[0]?.shardPrice, 25);
});

test("rejects ambiguous or missing trinket cost fields", () => {
  const entry = {
    id: "broken",
    buffs: [],
    hero_class_requirements: [],
    rarity: "common",
    limit: 1,
  };

  assert.throws(
    () =>
      parseRawTrinkets(
        { entries: [{ ...entry, price: 1000, shard: 10 }] },
        "both.json",
      ),
    /both\.json\.entries\[0\].*exactly one/,
  );
  assert.throws(
    () => parseRawTrinkets({ entries: [entry] }, "missing.json"),
    /missing\.json\.entries\[0\].*exactly one/,
  );
});

test("reports the source path of an invalid trinket field", () => {
  assert.throws(
    () =>
      parseRawTrinkets(
        {
          entries: [
            {
              id: "broken",
              buffs: ["OK"],
              hero_class_requirements: [],
              rarity: "common",
              price: "not-a-number",
              limit: 0,
            },
          ],
        },
        "sample.json",
      ),
    /sample\.json\.entries\[0\]\.price/,
  );
});

test("parses buff entries with stats and rules", () => {
  const parsed = parseBuffs(
    {
      buffs: [
        {
          id: "BUFF_HEAL",
          stat_type: "hp_heal_percent",
          stat_sub_type: "",
          amount: 0.33,
          rule_type: "always",
          is_false_rule: false,
        },
        {
          id: "BUFF_OPTIONAL",
          stat_type: "stress_dmg_received_percent",
          stat_sub_type: "",
          amount: -0.1,
          rule_type: "always",
        },
      ],
    },
    "sample.buffs.json",
  );

  assert.equal(parsed.length, 2);
  assert.equal(parsed[0]?.buffId, "BUFF_HEAL");
  assert.equal(parsed[0]?.amount, 0.33);
  assert.equal(parsed[0]?.isFalseRule, false);
  assert.equal(parsed[1]?.buffId, "BUFF_OPTIONAL");
  assert.equal(parsed[1]?.isFalseRule, false);
});

test("loads normalized trinkets and resolves buff effects", async (t) => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "dd-trinkets-"));
  t.after(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  const trinketDirectory = join(temporaryDirectory, "trinkets");
  const buffDirectory = join(temporaryDirectory, "shared", "buffs");
  await mkdir(trinketDirectory, { recursive: true });
  await mkdir(buffDirectory, { recursive: true });

  await writeFile(
    join(trinketDirectory, "base.entries.trinkets.json"),
    JSON.stringify({
      entries: [
        {
          id: "holy_orders",
          buffs: ["BUFF_VIRTUE", "BUFF_MISSING"],
          hero_class_requirements: ["crusader"],
          rarity: "very_rare",
          price: 25000,
          limit: 0,
          origin_dungeon: "",
        },
      ],
    }),
    "utf8",
  );

  await writeFile(
    join(buffDirectory, "base.buffs.json"),
    JSON.stringify({
      buffs: [
        {
          id: "BUFF_VIRTUE",
          stat_type: "virtue_chance",
          stat_sub_type: "",
          amount: 0.15,
          rule_type: "always",
          is_false_rule: false,
        },
      ],
    }),
    "utf8",
  );

  const definitions = await loadTrinketDefinitions(temporaryDirectory);
  assert.equal(definitions.length, 1);
  const trinket = definitions[0];
  assert.ok(trinket);
  assert.equal(trinket.id, "holy_orders");
  assert.equal(trinket.rarity, "very_rare");
  assert.equal(trinket.price, 25000);
  assert.equal(trinket.shardPrice, null);
  assert.deepEqual(trinket.heroClassRequirements, ["crusader"]);
  assert.equal(trinket.originDungeon, null);
  assert.equal(trinket.effects.length, 1);
  assert.equal(trinket.effects[0]?.statType, "virtue_chance");
  assert.equal(trinket.effects[0]?.amount, 0.15);
  assert.deepEqual(trinket.unresolvedBuffIds, ["BUFF_MISSING"]);
});

test("rejects duplicate trinket ids", async (t) => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "dd-trinkets-"));
  t.after(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  const trinketDirectory = join(temporaryDirectory, "trinkets");
  const buffDirectory = join(temporaryDirectory, "shared", "buffs");
  await mkdir(trinketDirectory, { recursive: true });
  await mkdir(buffDirectory, { recursive: true });

  await writeFile(
    join(trinketDirectory, "base.entries.trinkets.json"),
    JSON.stringify({
      entries: [
        {
          id: "duplicate",
          buffs: [],
          hero_class_requirements: [],
          rarity: "common",
          price: 1000,
          limit: 0,
        },
        {
          id: "duplicate",
          buffs: [],
          hero_class_requirements: [],
          rarity: "common",
          price: 1000,
          limit: 0,
        },
      ],
    }),
    "utf8",
  );

  await writeFile(
    join(buffDirectory, "base.buffs.json"),
    JSON.stringify({ buffs: [] }),
    "utf8",
  );

  await assert.rejects(
    loadTrinketDefinitions(temporaryDirectory),
    /Duplicate trinket id: duplicate/,
  );
});

test("loads full trinket catalog and resolves all buffs when game directory is available", async () => {
  const gameDirectory =
    process.env.DD_GAME_DIR ??
    "D:\\SteamLibrary\\steamapps\\common\\DarkestDungeon";

  let definitions;
  try {
    definitions = await loadTrinketDefinitions(gameDirectory);
  } catch {
    return;
  }

  assert.ok(definitions.length >= 490);
  const sacredScroll = definitions.find(({ id }) => id === "sacred_scroll");
  assert.ok(sacredScroll);
  assert.deepEqual(sacredScroll.heroClassRequirements, ["vestal"]);
  assert.equal(sacredScroll.rarity, "very_rare");
  assert.equal(sacredScroll.effects.length, 5);
  assert.deepEqual(sacredScroll.unresolvedBuffIds, []);
  const cometLens = definitions.find(({ id }) => id === "com_lens_of_comet");
  assert.ok(cometLens);
  assert.equal(cometLens.price, null);
  assert.equal(cometLens.shardPrice, 25);
});
