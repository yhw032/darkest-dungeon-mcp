import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  parseUpgradeState,
  parseUpgradeStateJson,
} from "../src/parser/parse-upgrades.js";
import { SaveValidationError } from "../src/parser/roster-schema.js";

function upgradeDocument(): unknown {
  return {
    base_root: {
      version: 1,
      purchases: {
        "0": {
          instance_number: 18,
          tree_id: 69443669,
          requirement_code: "2",
          is_purchased: true,
        },
        "1": {
          instance_number: 0,
          tree_id: 32447680,
          requirement_code: "a",
          is_purchased: false,
        },
      },
    },
  };
}

test("normalizes upgrade purchases without interpreting numeric ids", () => {
  const upgrades = parseUpgradeState(upgradeDocument());

  assert.equal(upgrades.version, 1);
  assert.deepEqual(upgrades.purchases, [
    {
      id: "0",
      instanceNumber: 18,
      treeId: 69443669,
      requirementCode: "2",
      isPurchased: true,
    },
    {
      id: "1",
      instanceNumber: 0,
      treeId: 32447680,
      requirementCode: "a",
      isPurchased: false,
    },
  ]);
});

test("reports an invalid purchase value with its source path", () => {
  const document = upgradeDocument() as {
    base_root: {
      purchases: { "0": Record<string, unknown> };
    };
  };
  document.base_root.purchases["0"].is_purchased = 1;

  assert.throws(
    () => parseUpgradeState(document),
    (error) =>
      error instanceof SaveValidationError &&
      error.path === "$.base_root.purchases.0.is_purchased",
  );
});

test("reports malformed upgrade JSON", () => {
  assert.throws(
    () => parseUpgradeStateJson("{"),
    (error) => error instanceof SaveValidationError && error.path === "$",
  );
});

test("parses the checked-in upgrade sample", async () => {
  const samplePath = new URL(
    "../samples/upgrades-decoded.json",
    import.meta.url,
  );
  const upgrades = parseUpgradeStateJson(await readFile(samplePath, "utf8"));

  assert.equal(upgrades.version, 1);
  assert.equal(upgrades.purchases.length, 713);
  assert.equal(
    upgrades.purchases.filter(({ isPurchased }) => isPurchased).length,
    713,
  );
  assert.equal(new Set(upgrades.purchases.map(({ treeId }) => treeId)).size, 245);
  assert.equal(
    new Set(upgrades.purchases.map(({ instanceNumber }) => instanceNumber)).size,
    35,
  );
});
