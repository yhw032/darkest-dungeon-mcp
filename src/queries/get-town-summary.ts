import type { Town } from "../domain/town.js";

export interface TownSummary {
  version: number;
  buildings: number;
  activitySlots: number;
  occupiedActivitySlots: number;
  storeItemAmount: number;
  stagecoachRecruitCount: number;
  districts: number;
  builtDistricts: string[];
}

export function getTownSummary(town: Town): TownSummary {
  const activities = town.buildings.flatMap((building) => building.activities);
  const slots = activities.flatMap((activity) => activity.slots);
  const stores = town.buildings.flatMap((building) => building.stores);

  return {
    version: town.version,
    buildings: town.buildings.length,
    activitySlots: slots.length,
    occupiedActivitySlots: slots.filter((slot) => slot.heroId !== 0).length,
    storeItemAmount: stores
      .flatMap((store) => store.items)
      .reduce((total, item) => total + item.amount, 0),
    stagecoachRecruitCount: stores.reduce(
      (total, store) => total + store.recruits.length,
      0,
    ),
    districts: town.districts.length,
    builtDistricts: town.districts
      .filter((district) => district.built)
      .map((district) => district.id),
  };
}
