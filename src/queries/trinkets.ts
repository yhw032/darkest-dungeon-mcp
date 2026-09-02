import type { Estate } from "../domain/estate.js";
import type { Roster } from "../domain/hero.js";
import type { Town } from "../domain/town.js";
import { isDeceasedHero } from "../roster/hero-roster-state.js";
import {
  localizeTrinket,
  type GameLanguage,
  type GameLocalization,
} from "../localization/game-localization.js";
import { normalizeKnowledgeTerm } from "./search-curios.js";

export type TrinketLocation = "storage" | "equipped" | "store";

export interface EquippedTrinketAssignment {
  heroId: string;
  heroName: string;
  amount: number;
}

export interface TrinketStoreListing {
  buildingId: string;
  storeId: string;
  amount: number;
}

export interface TrinketRecord {
  id: string;
  name: string | null;
  storageAmount: number;
  equippedBy: EquippedTrinketAssignment[];
  storeListings: TrinketStoreListing[];
  storeAmount: number;
}

export interface TrinketSources {
  roster: Roster;
  estate: Estate;
  town: Town;
}

export interface TrinketFilters {
  id?: string;
  query?: string;
  location?: TrinketLocation;
  language?: GameLanguage;
}

function getOrCreate(
  catalog: Map<string, TrinketRecord>,
  id: string,
): TrinketRecord {
  const existing = catalog.get(id);
  if (existing !== undefined) return existing;

  const created: TrinketRecord = {
    id,
    name: null,
    storageAmount: 0,
    equippedBy: [],
    storeListings: [],
    storeAmount: 0,
  };
  catalog.set(id, created);
  return created;
}

export function buildTrinketCatalog(sources: TrinketSources): TrinketRecord[] {
  const catalog = new Map<string, TrinketRecord>();

  for (const trinket of sources.estate.trinkets) {
    getOrCreate(catalog, trinket.id).storageAmount += trinket.amount;
  }

  for (const hero of sources.roster.heroes) {
    if (isDeceasedHero(hero.rosterStatus)) continue;
    for (const trinket of hero.equippedTrinkets) {
      getOrCreate(catalog, trinket.id).equippedBy.push({
        heroId: hero.id,
        heroName: hero.name,
        amount: trinket.amount,
      });
    }
  }

  for (const building of sources.town.buildings) {
    for (const store of building.stores) {
      for (const item of store.items) {
        if (item.type !== "trinket") continue;
        const record = getOrCreate(catalog, item.id);
        record.storeAmount += item.amount;
        record.storeListings.push({
          buildingId: building.id,
          storeId: store.id,
          amount: item.amount,
        });
      }
    }
  }

  return [...catalog.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
}

function existsAt(record: TrinketRecord, location: TrinketLocation): boolean {
  switch (location) {
    case "storage":
      return record.storageAmount > 0;
    case "equipped":
      return record.equippedBy.length > 0;
    case "store":
      return record.storeAmount > 0;
  }
}

export function listTrinkets(
  sources: TrinketSources,
  filters: TrinketFilters = {},
  localization?: GameLocalization,
): TrinketRecord[] {
  const query =
    filters.query === undefined
      ? undefined
      : normalizeKnowledgeTerm(filters.query);
  const language = filters.language ?? "en";
  return buildTrinketCatalog(sources)
    .filter((record) => {
      const searchableNames = [
        record.id,
        ...[...(localization?.values() ?? [])]
          .map((strings) => strings.get(`str_inventory_title_trinket${record.id}`))
          .filter((name): name is string => name !== undefined),
      ].map(normalizeKnowledgeTerm);
      return (
        (filters.id === undefined || record.id === filters.id) &&
        (query === undefined ||
          searchableNames.some((name) => name.includes(query))) &&
        (filters.location === undefined || existsAt(record, filters.location))
      );
    })
    .map((record) => ({
      ...record,
      name: localizeTrinket(record.id, language, localization),
    }));
}

export function getTrinket(
  sources: TrinketSources,
  trinketId: string,
): TrinketRecord | undefined {
  return buildTrinketCatalog(sources).find(
    (record) => record.id === trinketId,
  );
}
