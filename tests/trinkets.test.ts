import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parseEstateJson } from "../src/parser/parse-estate.js";
import { parseRosterJson } from "../src/parser/parse-roster.js";
import { parseTownJson } from "../src/parser/parse-town.js";
import {
  getTrinket,
  listTrinkets,
  type TrinketSources,
} from "../src/queries/trinkets.js";

const localization = new Map([
  [
    "english",
    new Map([["str_inventory_title_trinketflag_5", "Quickdraw Charm"]]),
  ],
  [
    "koreana",
    new Map([["str_inventory_title_trinketflag_5", "선제 공격의 부적"]]),
  ],
]);

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

test("combines storage and equipped amounts without merging store stock", async () => {
  const sources = await loadSources();
  const flag = getTrinket(sources, "flag_5");

  assert.ok(flag);
  assert.equal(flag.storageAmount, 1);
  assert.deepEqual(flag.equippedBy, [
    { heroId: "150", heroName: "부아셀", amount: 1 },
  ]);
  assert.equal(flag.storeAmount, 0);
});

test("aggregates duplicate storage stacks", async () => {
  const trinket = getTrinket(await loadSources(), "gamblers_charm");

  assert.equal(trinket?.storageAmount, 2);
  assert.deepEqual(trinket?.equippedBy, []);
});

test("identifies store-only trinkets and their listings", async () => {
  const trinket = getTrinket(await loadSources(), "knights_crest");

  assert.equal(trinket?.storageAmount, 0);
  assert.equal(trinket?.storeAmount, 1);
  assert.deepEqual(trinket?.storeListings, [
    { buildingId: "nomad_wagon", storeId: "trinket_supply", amount: 1 },
  ]);
});

test("filters the catalog by id and location", async () => {
  const sources = await loadSources();

  assert.equal(listTrinkets(sources, { location: "equipped" }).length, 9);
  assert.deepEqual(
    listTrinkets(sources, { id: "flag_5", location: "storage" }).map(
      (trinket) => trinket.id,
    ),
    ["flag_5"],
  );
  assert.deepEqual(
    listTrinkets(sources, { id: "flag_5", location: "store" }),
    [],
  );
});

test("searches and displays localized trinket names", async () => {
  const sources = await loadSources();
  const results = listTrinkets(
    sources,
    { query: "  선제 공격 ", language: "ko" },
    localization,
  );

  assert.deepEqual(results.map(({ id }) => id), ["flag_5"]);
  assert.equal(results[0]?.name, "선제 공격의 부적");
  assert.equal(
    listTrinkets(sources, { query: "quickdraw", language: "en" }, localization)[0]
      ?.name,
    "Quickdraw Charm",
  );
});

test("excludes trinkets attached only to deceased hero records", async () => {
  const sources = await loadSources();
  const sourceHero = sources.roster.heroes[0];
  assert.ok(sourceHero);
  sources.roster.heroes.push({
    ...sourceHero,
    id: "deceased",
    name: "Deceased",
    rosterStatus: 3,
    equippedTrinkets: [{ id: "historical_trinket", type: "trinket", amount: 1 }],
  });

  assert.equal(getTrinket(sources, "historical_trinket"), undefined);
});
