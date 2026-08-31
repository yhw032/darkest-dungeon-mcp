import type {
  UpgradePurchase,
  UpgradeState,
} from "../domain/upgrades.js";
import {
  SaveValidationError,
  expectBoolean,
  expectNumber,
  expectRecord,
  expectString,
} from "./roster-schema.js";

function parsePurchase(
  id: string,
  value: unknown,
  path: string,
): UpgradePurchase {
  const purchase = expectRecord(value, path);

  return {
    id,
    instanceNumber: expectNumber(
      purchase.instance_number,
      `${path}.instance_number`,
    ),
    treeId: expectNumber(purchase.tree_id, `${path}.tree_id`),
    requirementCode: expectString(
      purchase.requirement_code,
      `${path}.requirement_code`,
    ),
    isPurchased: expectBoolean(
      purchase.is_purchased,
      `${path}.is_purchased`,
    ),
  };
}

export function parseUpgradeState(value: unknown): UpgradeState {
  const document = expectRecord(value, "$");
  const root = expectRecord(document.base_root, "$.base_root");
  const purchases = expectRecord(root.purchases, "$.base_root.purchases");

  return {
    version: expectNumber(root.version, "$.base_root.version"),
    purchases: Object.entries(purchases).map(([id, purchase]) =>
      parsePurchase(id, purchase, `$.base_root.purchases.${id}`),
    ),
  };
}

export function parseUpgradeStateJson(text: string): UpgradeState {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new SaveValidationError(`invalid JSON (${detail})`, "$");
  }

  return parseUpgradeState(value);
}
