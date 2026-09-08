import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parseEstateJson } from "../src/parser/parse-estate.js";
import { parseRosterJson } from "../src/parser/parse-roster.js";
import { parseTownJson } from "../src/parser/parse-town.js";
import { loadTrinketGuidance } from "../src/knowledge/load-trinket-guidance.js";
import { recommendTrinkets } from "../src/queries/recommend-trinkets.js";
import type { TrinketSources } from "../src/queries/trinkets.js";
import type { TrinketDefinition } from "../src/domain/trinket-definitions.js";

async function loadSources(): Promise<TrinketSources> {
  const [rosterText, estateText, townText] = await Promise.all([
    readFile(
      fileURLToPath(
        new URL("../samples/roster-decoded.json", import.meta.url),
      ),
      "utf8",
    ),
    readFile(
      fileURLToPath(
        new URL("../samples/estate-decoded.json", import.meta.url),
      ),
      "utf8",
    ),
    readFile(
      fileURLToPath(new URL("../samples/town-decoded.json", import.meta.url)),
      "utf8",
    ),
  ]);

  return {
    roster: parseRosterJson(rosterText),
    estate: parseEstateJson(estateText),
    town: parseTownJson(townText),
  };
}

const mockDefinitions: TrinketDefinition[] = [
  {
    id: "blasphemous_vial",
    rarity: "very_rare",
    price: 25000,
    limit: 0,
    heroClassRequirements: ["plague_doctor"],
    originDungeon: null,
    effects: [],
    unresolvedBuffIds: [],
  },
  {
    id: "focus_ring",
    rarity: "rare",
    price: 15000,
    limit: 1,
    heroClassRequirements: [],
    originDungeon: null,
    effects: [],
    unresolvedBuffIds: [],
  },
  {
    id: "flag_5",
    rarity: "very_rare",
    price: 25000,
    limit: 1,
    heroClassRequirements: [],
    originDungeon: null,
    effects: [],
    unresolvedBuffIds: [],
  },
  {
    id: "heavens_hairpin",
    rarity: "very_rare",
    price: 25000,
    limit: 0,
    heroClassRequirements: ["hellion"],
    originDungeon: null,
    effects: [],
    unresolvedBuffIds: [],
  },
];

test("recommends owned trinkets for a specific hero matching class and universal priorities", async () => {
  const sources = await loadSources();
  const guidance = await loadTrinketGuidance();

  // Find Plague Doctor in sample roster (id 14)
  const pd = sources.roster.heroes.find((h) => h.heroClass === "plague_doctor");
  assert.ok(pd);

  const result = recommendTrinkets(
    sources,
    guidance,
    { heroId: pd.id, onlyOwned: false, language: "en" },
    mockDefinitions,
  );

  assert.ok(result.heroContext);
  assert.equal(result.heroContext.heroId, pd.id);
  assert.equal(result.heroContext.heroClass, "plague_doctor");

  // Blasphemous vial should be at the very top for Plague Doctor
  assert.ok(result.recommendations.length > 0);
  const first = result.recommendations[0]!;
  assert.equal(first.trinketId, "blasphemous_vial");
  assert.equal(first.tier, "S");
  assert.match(first.matchReason, /Class-specific/);
});

test("respects onlyOwned flag when filtering recommendations", async () => {
  const sources = await loadSources();
  const guidance = await loadTrinketGuidance();

  // Hero 150 is equipped with flag_5 in sample
  const resultOwnedOnly = recommendTrinkets(
    sources,
    guidance,
    { heroId: "150", onlyOwned: true },
    mockDefinitions,
  );

  // In sample estate, flag_5 is present in storage and equipped
  assert.ok(resultOwnedOnly.recommendations.every((r) => r.ownership.isOwned));
  assert.ok(
    resultOwnedOnly.recommendations.some((r) => r.trinketId === "flag_5"),
  );

  const resultAll = recommendTrinkets(
    sources,
    guidance,
    { heroId: "150", onlyOwned: false },
    mockDefinitions,
  );

  // Should include unowned S/A tier items like focus_ring
  assert.ok(resultAll.recommendations.some((r) => !r.ownership.isOwned));
});

test("does not treat a store-only trinket as owned", async () => {
  const sources = await loadSources();
  const guidance = await loadTrinketGuidance();
  const withStoreListing: TrinketSources = {
    ...sources,
    town: {
      ...sources.town,
      buildings: [
        ...sources.town.buildings,
        {
          id: "nomad_wagon",
          activities: [],
          stores: [
            {
              id: "wagon",
              items: [{ id: "focus_ring", type: "trinket", amount: 1 }],
              recruits: [],
            },
          ],
        },
      ],
    },
  };

  const ownedOnly = recommendTrinkets(
    withStoreListing,
    guidance,
    { heroId: "150", onlyOwned: true },
    mockDefinitions,
  );
  assert.equal(
    ownedOnly.recommendations.some((item) => item.trinketId === "focus_ring"),
    false,
  );

  const includingUnowned = recommendTrinkets(
    withStoreListing,
    guidance,
    { heroId: "150", onlyOwned: false },
    mockDefinitions,
  );
  const focusRing = includingUnowned.recommendations.find(
    (item) => item.trinketId === "focus_ring",
  );
  assert.ok(focusRing);
  assert.equal(focusRing.ownership.isOwned, false);
  assert.equal(focusRing.ownership.isAvailableForPurchase, true);
  assert.equal(focusRing.ownership.status, "in_store");
});

test("recommends candidate heroes for a specific trinket id", async () => {
  const sources = await loadSources();
  const guidance = await loadTrinketGuidance();

  // heavens_hairpin is for Hellion
  const result = recommendTrinkets(
    sources,
    guidance,
    { trinketId: "heavens_hairpin" },
    mockDefinitions,
  );

  assert.ok(result.trinketContext);
  assert.equal(result.trinketContext.trinketId, "heavens_hairpin");
  assert.equal(result.trinketContext.tier, "S");
  assert.ok(result.candidateHeroes);
  assert.ok(result.candidateHeroes.length > 0);
  assert.ok(
    result.candidateHeroes.every(
      (candidate) =>
        typeof candidate.stress === "number" &&
        typeof candidate.availability.isAvailableForPartySelection === "boolean",
    ),
  );
  const firstUnavailable = result.candidateHeroes.findIndex(
    (candidate) => !candidate.availability.isAvailableForPartySelection,
  );
  if (firstUnavailable >= 0) {
    assert.ok(
      result.candidateHeroes
        .slice(0, firstUnavailable)
        .every((candidate) => candidate.availability.isAvailableForPartySelection),
    );
  }

  // Top candidate should be a Hellion
  assert.equal(result.candidateHeroes[0]?.heroClass, "hellion");
  assert.match(
    result.candidateHeroes[0]?.suitabilityReason ?? "",
    /Recommended core class/,
  );
});
