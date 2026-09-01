import type { Hero, Roster } from "../domain/hero.js";
import type { HeroProgressionRules } from "../domain/hero-progression.js";
import type { Town } from "../domain/town.js";
import type { QuestEligibility } from "../domain/quest-restrictions.js";
import {
  getHeroAvailability,
  getResolveLevel,
} from "../progression/hero-progression.js";
import { getHeroTownContext } from "./get-hero-town-context.js";

type RawHeroSummary = Pick<
  Hero,
  | "id"
  | "name"
  | "heroClass"
  | "resolveXp"
  | "stress"
  | "rosterStatus"
  | "currentHp"
>;

export interface HeroSummary extends RawHeroSummary {
  resolveLevel: number | null;
  availability: {
    isAvailableForPartySelection: boolean;
    reasons: Array<
      | "already_selected_for_raid"
      | "assigned_to_town_activity"
      | "roster_status_unavailable"
    >;
  };
  questEligibility: QuestEligibility | null;
}

export interface HeroFilters {
  heroClass?: string;
  rosterStatus?: number;
  maxStress?: number;
  availableOnly?: boolean;
}

export function toHeroSummary(
  hero: Hero,
  town?: Town,
  progressionRules?: HeroProgressionRules,
): HeroSummary {
  const {
    id,
    name,
    heroClass,
    resolveXp,
    stress,
    rosterStatus,
    currentHp,
  } = hero;

  const townContext = town === undefined
    ? { buildingName: hero.buildingName, activityAssignments: [] }
    : getHeroTownContext({ version: 0, nextGuid: 0, heroes: [hero] }, town, hero.id)!;
  return {
    id,
    name,
    heroClass,
    resolveXp,
    stress,
    rosterStatus,
    currentHp,
    resolveLevel: getResolveLevel(resolveXp, progressionRules),
    availability: getHeroAvailability(hero, townContext),
    questEligibility: null,
  };
}

export function listHeroes(
  roster: Roster,
  filters: HeroFilters = {},
  town?: Town,
  progressionRules?: HeroProgressionRules,
): HeroSummary[] {
  return roster.heroes
    .filter(
      (hero) =>
        (filters.heroClass === undefined ||
          hero.heroClass === filters.heroClass) &&
        (filters.rosterStatus === undefined ||
          hero.rosterStatus === filters.rosterStatus) &&
        (filters.maxStress === undefined || hero.stress <= filters.maxStress) &&
        (filters.availableOnly !== true ||
          toHeroSummary(hero, town, progressionRules).availability
            .isAvailableForPartySelection),
    )
    .map((hero) => toHeroSummary(hero, town, progressionRules));
}
