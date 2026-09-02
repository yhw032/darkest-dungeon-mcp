import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  loadGameLocalization,
  localizeCombatSkill,
  localizeHeroClass,
  localizeTrinket,
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
    table("koreana", [["dungeon_name_crypts", "폐허"]]),
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
});
