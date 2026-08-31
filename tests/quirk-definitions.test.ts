import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { SaveValidationError } from "../src/parser/roster-schema.js";
import {
  loadQuirkDefinitions,
  parseQuirkLocalizationXml,
} from "../src/quirks/load-quirk-definitions.js";

function quirkDocument(): unknown {
  return {
    quirks: [
      {
        id: "fragile",
        is_positive: false,
        is_disease: false,
        classification: "physical",
        incompatible_quirks: ["tough"],
        curio_tag: "",
        curio_tag_chance: 0,
        keep_loot: false,
        buffs: ["MAXHP-10", "UNKNOWN_MOD_BUFF"],
        can_modify_in_activity: true,
        can_be_replaced_by_new_quirk: true,
      },
      {
        id: "kleptomaniac",
        is_positive: false,
        is_disease: false,
        classification: "mental",
        incompatible_quirks: [],
        curio_tag: "Treasure",
        curio_tag_chance: 0.35,
        keep_loot: true,
        buffs: [],
        can_modify_in_activity: true,
        can_be_replaced_by_new_quirk: true,
      },
    ],
  };
}

const localization = `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <language id="english">
    <entry id="str_quirk_name_fragile"><![CDATA[Fragile]]></entry>
    <entry id="str_quirk_description_fragile"><![CDATA[-10% MAX HP]]></entry>
    <entry id="str_quirk_name_kleptomaniac"><![CDATA[Kleptomaniac]]></entry>
  </language>
  <language id="koreana">
    <entry id="str_quirk_name_fragile"><![CDATA[약골]]></entry>
    <entry id="str_quirk_description_fragile"><![CDATA[최대 체력 -10%]]></entry>
    <entry id="str_quirk_name_kleptomaniac"><![CDATA[도벽]]></entry>
  </language>
</root>`;

async function writeFixture(root: string): Promise<void> {
  await Promise.all([
    mkdir(join(root, "shared", "quirk"), { recursive: true }),
    mkdir(join(root, "shared", "buffs"), { recursive: true }),
    mkdir(join(root, "localization"), { recursive: true }),
    mkdir(join(root, "dlc", "1117860_arena_mp", "shared", "quirk"), {
      recursive: true,
    }),
  ]);
  await Promise.all([
    writeFile(
      join(root, "shared", "quirk", "quirk_library.json"),
      JSON.stringify(quirkDocument()),
      "utf8",
    ),
    writeFile(
      join(root, "shared", "buffs", "base.buffs.json"),
      JSON.stringify({
        buffs: [
          {
            id: "MAXHP-10",
            stat_type: "combat_stat_multiply",
            stat_sub_type: "max_hp",
            amount: -0.1,
            rule_type: "always",
            is_false_rule: false,
          },
        ],
      }),
      "utf8",
    ),
    writeFile(
      join(root, "localization", "miscellaneous.string_table.xml"),
      localization,
      "utf8",
    ),
    writeFile(
      join(
        root,
        "dlc",
        "1117860_arena_mp",
        "shared",
        "quirk",
        "arena.quirk_library.json",
      ),
      JSON.stringify({ quirks: [{ id: "arena_only" }] }),
      "utf8",
    ),
  ]);
}

test("parses English and Korean quirk localization", () => {
  const parsed = parseQuirkLocalizationXml(localization);

  assert.equal(parsed.get("english")?.get("str_quirk_name_fragile"), "Fragile");
  assert.equal(parsed.get("koreana")?.get("str_quirk_name_fragile"), "약골");
});

test("loads normalized quirks, buff effects, and localization", async () => {
  const root = await mkdtemp(join(tmpdir(), "ddmcp-quirks-"));
  try {
    await writeFixture(root);
    const quirks = await loadQuirkDefinitions(root);

    assert.equal(quirks.length, 2);
    assert.deepEqual(quirks[0], {
      id: "fragile",
      isPositive: false,
      isDisease: false,
      classification: "physical",
      incompatibleQuirks: ["tough"],
      curioTag: null,
      curioTagChance: 0,
      keepsLoot: false,
      canModifyInActivity: true,
      canBeReplacedByNewQuirk: true,
      effects: [
        {
          buffId: "MAXHP-10",
          statType: "combat_stat_multiply",
          statSubType: "max_hp",
          amount: -0.1,
          ruleType: "always",
          isFalseRule: false,
        },
      ],
      unresolvedBuffIds: ["UNKNOWN_MOD_BUFF"],
      localization: {
        english: { name: "Fragile", description: "-10% MAX HP" },
        korean: { name: "약골", description: "최대 체력 -10%" },
      },
    });
    assert.equal(quirks.some((quirk) => quirk.id === "arena_only"), false);
    assert.deepEqual(quirks[1]?.localization.english, {
      name: "Kleptomaniac",
      description: null,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("reports the source path of an invalid quirk field", async () => {
  const root = await mkdtemp(join(tmpdir(), "ddmcp-quirks-invalid-"));
  try {
    await writeFixture(root);
    const document = quirkDocument() as {
      quirks: Array<Record<string, unknown>>;
    };
    document.quirks[0]!.is_positive = "false";
    await writeFile(
      join(root, "shared", "quirk", "quirk_library.json"),
      JSON.stringify(document),
      "utf8",
    );

    await assert.rejects(
      loadQuirkDefinitions(root),
      (error) =>
        error instanceof SaveValidationError &&
        error.path.includes("quirk_library.json.quirks[0].is_positive"),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
