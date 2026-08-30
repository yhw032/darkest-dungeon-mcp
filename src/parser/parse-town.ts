import type { InventoryItem } from "../domain/estate.js";
import type {
  District,
  RecruitCandidate,
  Town,
  TownActivity,
  TownActivitySlot,
  TownBuilding,
  TownStore,
} from "../domain/town.js";
import {
  SaveValidationError,
  expectBoolean,
  expectNumber,
  expectRecord,
  expectString,
} from "./roster-schema.js";

function parseActivitySlot(
  id: string,
  value: unknown,
  path: string,
): TownActivitySlot | undefined {
  const slot = expectRecord(value, path);
  if (!("hero" in slot)) {
    return undefined;
  }

  return {
    id,
    heroId: expectNumber(slot.hero, `${path}.hero`),
    visitsRemaining: expectNumber(
      slot.visitsRemaining,
      `${path}.visitsRemaining`,
    ),
    residentOccupied: expectNumber(
      slot.resident_occupied,
      `${path}.resident_occupied`,
    ),
    isSideEffectResult: expectBoolean(
      slot.is_side_effect_result,
      `${path}.is_side_effect_result`,
    ),
  };
}

function parseActivities(value: unknown, path: string): TownActivity[] {
  if (value === undefined) return [];
  const activities = expectRecord(value, path);

  return Object.entries(activities).map(([id, rawActivity]) => {
    const activityPath = `${path}.${id}`;
    const activity = expectRecord(rawActivity, activityPath);
    const slots = Object.entries(activity).flatMap(([slotId, rawSlot]) => {
      const slot = parseActivitySlot(
        slotId,
        rawSlot,
        `${activityPath}.${slotId}`,
      );
      return slot === undefined ? [] : [slot];
    });

    return { id, slots };
  });
}

function parseStoreItems(value: unknown, path: string): InventoryItem[] {
  if (value === undefined) return [];
  const inventory = expectRecord(value, path);
  if (inventory.items === undefined) return [];
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

function parseRecruits(value: unknown, path: string): RecruitCandidate[] {
  if (value === undefined) return [];
  const generated = expectRecord(value, path);

  return Object.entries(generated).map(([id, rawRecruit]) => {
    const recruitPath = `${path}.${id}`;
    const recruit = expectRecord(rawRecruit, recruitPath);
    const actor = expectRecord(recruit.actor, `${recruitPath}.actor`);
    return {
      id,
      name: expectString(actor.name, `${recruitPath}.actor.name`),
      heroClass: expectString(recruit.heroClass, `${recruitPath}.heroClass`),
      resolveXp: expectNumber(recruit.resolveXp, `${recruitPath}.resolveXp`),
      stress: expectNumber(recruit.m_Stress, `${recruitPath}.m_Stress`),
    };
  });
}

function parseStores(value: unknown, path: string): TownStore[] {
  if (value === undefined) return [];
  const stores = expectRecord(value, path);

  return Object.entries(stores).map(([id, rawStore]) => {
    const storePath = `${path}.${id}`;
    const store = expectRecord(rawStore, storePath);
    return {
      id,
      items: parseStoreItems(store.inventory, `${storePath}.inventory`),
      recruits: parseRecruits(store.generated, `${storePath}.generated`),
    };
  });
}

function parseBuildings(value: unknown, path: string): TownBuilding[] {
  const buildings = expectRecord(value, path);

  return Object.entries(buildings).map(([id, rawBuilding]) => {
    const buildingPath = `${path}.${id}`;
    const building = expectRecord(rawBuilding, buildingPath);
    return {
      id,
      activities: parseActivities(
        building.activities,
        `${buildingPath}.activities`,
      ),
      stores: parseStores(building.store, `${buildingPath}.store`),
    };
  });
}

function parseDistricts(value: unknown, path: string): District[] {
  if (value === undefined) return [];
  const districts = expectRecord(value, path);
  if (districts.buildings === undefined) return [];
  const buildings = expectRecord(districts.buildings, `${path}.buildings`);

  return Object.entries(buildings).map(([id, rawDistrict]) => {
    const districtPath = `${path}.buildings.${id}`;
    const district = expectRecord(rawDistrict, districtPath);
    return {
      id,
      built: expectBoolean(district.built, `${districtPath}.built`),
    };
  });
}

export function parseTown(value: unknown): Town {
  const document = expectRecord(value, "$");
  const root = expectRecord(document.base_root, "$.base_root");

  return {
    version: expectNumber(root.version, "$.base_root.version"),
    buildings: parseBuildings(root.buildings, "$.base_root.buildings"),
    districts: parseDistricts(root.districts, "$.base_root.districts"),
  };
}

export function parseTownJson(text: string): Town {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new SaveValidationError(`invalid JSON (${detail})`, "$");
  }
  return parseTown(value);
}
