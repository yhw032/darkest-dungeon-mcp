import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  loadGameLocalization,
  localizeAffliction,
  localizeBuildingUpgradeTree,
  localizeCombatSkill,
  localizeCurio,
  localizeDistrict,
  localizeEstateResource,
  localizeHeroClass,
  localizeQuirk,
  localizeTownActivity,
  localizeTownBuilding,
  localizeTrinket,
  localizeVirtue,
} from "../src/localization/game-localization.js";

function table(language: string, entries: Array<[string, string]>): string {
  return `<root><language id="${language}">${entries
    .map(([id, value]) => `<entry id="${id}"><![CDATA[${value}]]></entry>`)
    .join("")}</language></root>`;
}

test("loads official hero class and combat skill names", async (t) => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "dd-localization-"));
  t.after(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
  });
  const localizationDirectory = join(temporaryDirectory, "localization");
  await mkdir(localizationDirectory, { recursive: true });
  await writeFile(
    join(localizationDirectory, "miscellaneous.string_table.xml"),
    table("koreana", [
      ["dungeon_name_crypts", "폐허"],
      ["town_name_abbey", "수도원"],
      ["town_activity_name_meditation", "명상실"],
      ["str_bank_title", "은행"],
      ["upgrade_tree_name_abbey.meditation", "명상실"],
      ["str_affliction_name_depressed", "절망"],
      ["str_quirk_name_nervous_bleeder", "출혈 긴장증"],
      ["str_inventory_title_gold", "골드"],
      ["str_inventory_title_heirloombust", "흉상"],
      ["str_inventory_title_shard", "혜성의 파편"],
    ]),
    "utf8",
  );
  await writeFile(
    join(localizationDirectory, "heroes.string_table.xml"),
    table("koreana", [
      ["hero_class_name_leper", "나병환자"],
      ["combat_skill_name_leper_chop", "토막치기"],
    ]),
    "utf8",
  );
  await writeFile(
    join(localizationDirectory, "backertrinkets.string_table.xml"),
    table("koreana", [
      ["str_inventory_title_trinketaurora_pendant", "오로라 펜던트"],
    ]),
    "utf8",
  );
  await writeFile(
    join(localizationDirectory, "curios.string_table.xml"),
    table("koreana", [
      ["str_curio_title_eldritch_altar", "괴이한 제단"],
    ]),
    "utf8",
  );
  await writeFile(
    join(localizationDirectory, "dialogue.string_table.xml"),
    table("koreana", [
      ["str_virtue_name_focused", "정신 집중"],
    ]),
    "utf8",
  );

  const localization = await loadGameLocalization(temporaryDirectory);

  assert.equal(localizeHeroClass("leper", "ko", localization), "나병환자");
  assert.equal(
    localizeCombatSkill("leper", "chop", "ko", localization),
    "토막치기",
  );
  assert.equal(localizeCombatSkill("leper", "missing", "ko", localization), null);
  assert.equal(
    localizeTrinket("aurora_pendant", "ko", localization),
    "오로라 펜던트",
  );
  assert.equal(
    localizeCurio("eldritch_altar", "ko", localization),
    "괴이한 제단",
  );
  assert.equal(
    localizeCurio("str_curio_title_eldritch_altar", "ko", localization),
    "괴이한 제단",
  );
  assert.equal(localizeCurio("missing", "ko", localization), null);
  assert.equal(localizeTownBuilding("abbey", "ko", localization), "수도원");
  assert.equal(
    localizeTownActivity("meditation", "ko", localization),
    "명상실",
  );
  assert.equal(localizeDistrict("bank", "ko", localization), "은행");
  assert.equal(
    localizeBuildingUpgradeTree("abbey.meditation", "ko", localization),
    "명상실",
  );
  assert.equal(
    localizeQuirk("nervous_bleeder", "ko", localization),
    "출혈 긴장증",
  );
  assert.equal(localizeQuirk("missing", "ko", localization), null);
  assert.equal(localizeAffliction("depressed", "ko", localization), "절망");
  assert.equal(localizeAffliction(null, "ko", localization), null);
  assert.equal(localizeAffliction("missing", "ko", localization), null);
  assert.equal(localizeVirtue("focused", "ko", localization), "정신 집중");
  assert.equal(localizeVirtue(null, "ko", localization), null);
  assert.equal(localizeVirtue("missing", "ko", localization), null);
  assert.equal(localizeEstateResource("gold", "ko", localization), "골드");
  assert.equal(localizeEstateResource("bust", "ko", localization), "흉상");
  assert.equal(localizeEstateResource("shard", "ko", localization), "혜성의 파편");
  assert.equal(localizeEstateResource("missing", "ko", localization), null);
});
