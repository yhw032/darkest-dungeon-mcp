import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parseEstate, parseEstateJson } from "../src/parser/parse-estate.js";
import { SaveValidationError } from "../src/parser/roster-schema.js";
import { getEstateResources } from "../src/queries/get-estate-resources.js";

function estateDocument(): unknown {
  return {
    base_root: {
      version: 34,
      wallet: {
        "0": { type: "gold", amount: 1234 },
        "1": { type: "crest", amount: 12 },
      },
      trinkets: {
        items: {
          "0": { id: "dodge_stone", type: "trinket", amount: 1 },
          "1": { id: "gamblers_charm", type: "trinket", amount: 2 },
        },
      },
      estate_items: {
        items: {
          "0": { id: "the_blood", type: "estate", amount: 10 },
        },
      },
    },
  };
}

test("normalizes estate resources and inventories", () => {
  const estate = parseEstate(estateDocument());

  assert.equal(estate.version, 34);
  assert.deepEqual(estate.resources, [
    { type: "gold", amount: 1234 },
    { type: "crest", amount: 12 },
  ]);
  assert.deepEqual(estate.trinkets[1], {
    id: "gamblers_charm",
    type: "trinket",
    amount: 2,
  });
  assert.deepEqual(estate.estateItems, [
    { id: "the_blood", type: "estate", amount: 10 },
  ]);
});

test("allows missing optional inventories", () => {
  const document = estateDocument() as {
    base_root: Record<string, unknown>;
  };
  delete document.base_root.trinkets;
  delete document.base_root.estate_items;

  const estate = parseEstate(document);
  assert.deepEqual(estate.trinkets, []);
  assert.deepEqual(estate.estateItems, []);
});

test("reports an invalid resource amount with its path", () => {
  const document = estateDocument() as {
    base_root: { wallet: { "0": Record<string, unknown> } };
  };
  document.base_root.wallet["0"].amount = "many";

  assert.throws(
    () => parseEstate(document),
    (error) =>
      error instanceof SaveValidationError &&
      error.path === "$.base_root.wallet.0.amount",
  );
});

test("summarizes resource and inventory amounts", () => {
  const summary = getEstateResources(parseEstate(estateDocument()));

  assert.deepEqual(summary.trinkets, { stacks: 2, totalAmount: 3 });
  assert.deepEqual(summary.estateItems, { stacks: 1, totalAmount: 10 });
});

test("parses the checked-in estate sample", async () => {
  const samplePath = fileURLToPath(
    new URL("../samples/estate-decoded.json", import.meta.url),
  );
  const estate = parseEstateJson(await readFile(samplePath, "utf8"));

  assert.equal(estate.version, 34);
  assert.equal(estate.resources.find((item) => item.type === "gold")?.amount, 30790);
  assert.equal(estate.trinkets.length, 19);
  assert.equal(estate.estateItems.length, 2);
});
