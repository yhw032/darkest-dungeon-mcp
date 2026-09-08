import assert from "node:assert/strict";
import test from "node:test";

import {
  gameLanguageCodes,
  gameLocalizationIdByLanguage,
  getGameLocalizationId,
  supportedGameLocalizationIds,
} from "../src/localization/languages.js";
import {
  localizeHeroClass,
  type GameLocalization,
} from "../src/localization/game-localization.js";

test("maps every verified public language code to one game localization id", () => {
  assert.equal(gameLanguageCodes.length, 12);
  assert.equal(supportedGameLocalizationIds.size, gameLanguageCodes.length);
  assert.equal(getGameLocalizationId("pt-BR"), "brazilian");
  assert.equal(getGameLocalizationId("zh-CN"), "schinese");
  assert.equal(gameLocalizationIdByLanguage.ja, "japanese");
});

test("localizes game strings through additional language mappings", () => {
  const localization: GameLocalization = new Map([
    ["french", new Map([["hero_class_name_leper", "Lépreux"]])],
    ["japanese", new Map([["hero_class_name_leper", "没落者"]])],
  ]);

  assert.equal(localizeHeroClass("leper", "fr", localization), "Lépreux");
  assert.equal(localizeHeroClass("leper", "ja", localization), "没落者");
  assert.equal(localizeHeroClass("leper", "de", localization), null);
});
