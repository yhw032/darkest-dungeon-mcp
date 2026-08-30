import type { Roster } from "../domain/hero.js";
import type { Town } from "../domain/town.js";

export interface HeroActivityAssignment {
  buildingId: string;
  activityId: string;
  slotId: string;
  visitsRemaining: number;
  residentOccupied: number;
  isSideEffectResult: boolean;
}

export interface HeroTownContext {
  buildingName: string | null;
  activityAssignments: HeroActivityAssignment[];
}

export function getHeroTownContext(
  roster: Roster,
  town: Town,
  heroId: string,
): HeroTownContext | undefined {
  const hero = roster.heroes.find((candidate) => candidate.id === heroId);
  if (hero === undefined) return undefined;

  const numericHeroId = Number(heroId);
  const activityAssignments = Number.isFinite(numericHeroId)
    ? town.buildings.flatMap((building) =>
        building.activities.flatMap((activity) =>
          activity.slots
            .filter((slot) => slot.heroId === numericHeroId)
            .map((slot) => ({
              buildingId: building.id,
              activityId: activity.id,
              slotId: slot.id,
              visitsRemaining: slot.visitsRemaining,
              residentOccupied: slot.residentOccupied,
              isSideEffectResult: slot.isSideEffectResult,
            })),
        ),
      )
    : [];

  return { buildingName: hero.buildingName, activityAssignments };
}
