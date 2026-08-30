import type {
  Estate,
  EstateResource,
  InventoryItem,
} from "../domain/estate.js";
import {
  SaveValidationError,
  expectNumber,
  expectRecord,
  expectString,
} from "./roster-schema.js";

function parseResources(value: unknown, path: string): EstateResource[] {
  const wallet = expectRecord(value, path);

  return Object.entries(wallet).map(([key, rawResource]) => {
    const resourcePath = `${path}.${key}`;
    const resource = expectRecord(rawResource, resourcePath);

    return {
      type: expectString(resource.type, `${resourcePath}.type`),
      amount: expectNumber(resource.amount, `${resourcePath}.amount`),
    };
  });
}

function parseInventory(value: unknown, path: string): InventoryItem[] {
  if (value === undefined) {
    return [];
  }

  const inventory = expectRecord(value, path);
  if (inventory.items === undefined) {
    return [];
  }

  const items = expectRecord(inventory.items, `${path}.items`);

  return Object.entries(items).map(([key, rawItem]) => {
    const itemPath = `${path}.items.${key}`;
    const item = expectRecord(rawItem, itemPath);

    return {
      id: expectString(item.id, `${itemPath}.id`),
      type: expectString(item.type, `${itemPath}.type`),
      amount: expectNumber(item.amount, `${itemPath}.amount`),
    };
  });
}

export function parseEstate(value: unknown): Estate {
  const document = expectRecord(value, "$");
  const root = expectRecord(document.base_root, "$.base_root");

  return {
    version: expectNumber(root.version, "$.base_root.version"),
    resources: parseResources(root.wallet, "$.base_root.wallet"),
    trinkets: parseInventory(root.trinkets, "$.base_root.trinkets"),
    estateItems: parseInventory(root.estate_items, "$.base_root.estate_items"),
  };
}

export function parseEstateJson(text: string): Estate {
  let value: unknown;

  try {
    value = JSON.parse(text) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new SaveValidationError(`invalid JSON (${detail})`, "$");
  }

  return parseEstate(value);
}
