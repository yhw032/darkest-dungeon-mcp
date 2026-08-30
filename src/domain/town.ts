import type { InventoryItem } from "./estate.js";

export interface TownActivitySlot {
  id: string;
  heroId: number;
  visitsRemaining: number;
  residentOccupied: number;
  isSideEffectResult: boolean;
}

export interface TownActivity {
  id: string;
  slots: TownActivitySlot[];
}

export interface RecruitCandidate {
  id: string;
  name: string;
  heroClass: string;
  resolveXp: number;
  stress: number;
}

export interface TownStore {
  id: string;
  items: InventoryItem[];
  recruits: RecruitCandidate[];
}

export interface TownBuilding {
  id: string;
  activities: TownActivity[];
  stores: TownStore[];
}

export interface District {
  id: string;
  built: boolean;
}

export interface Town {
  version: number;
  buildings: TownBuilding[];
  districts: District[];
}
