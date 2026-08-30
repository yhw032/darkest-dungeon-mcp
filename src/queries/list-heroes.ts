import type { Hero, Roster } from "../domain/hero.js";

export type HeroSummary = Pick<
  Hero,
  | "id"
  | "name"
  | "heroClass"
  | "resolveXp"
  | "stress"
  | "rosterStatus"
  | "currentHp"
>;

export interface HeroFilters {
  heroClass?: string;
  rosterStatus?: number;
  maxStress?: number;
}

export function toHeroSummary(hero: Hero): HeroSummary {
  const {
    id,
    name,
    heroClass,
    resolveXp,
    stress,
    rosterStatus,
    currentHp,
  } = hero;

  return {
    id,
    name,
    heroClass,
    resolveXp,
    stress,
    rosterStatus,
    currentHp,
  };
}

export function listHeroes(
  roster: Roster,
  filters: HeroFilters = {},
): HeroSummary[] {
  return roster.heroes
    .filter(
      (hero) =>
        (filters.heroClass === undefined ||
          hero.heroClass === filters.heroClass) &&
        (filters.rosterStatus === undefined ||
          hero.rosterStatus === filters.rosterStatus) &&
        (filters.maxStress === undefined || hero.stress <= filters.maxStress),
    )
    .map(toHeroSummary);
}
