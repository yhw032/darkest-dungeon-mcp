import type { Roster } from "../domain/hero.js";
import type { HeroProgressionRules } from "../domain/hero-progression.js";
import type { Town } from "../domain/town.js";
import { getHeroRosterState } from "../roster/hero-roster-state.js";
import { type HeroSummary, toHeroSummary } from "./list-heroes.js";

export interface RosterSummary {
  activeHeroes: number;
  deceasedHeroes: number;
  unknownStateHeroes: number;
  totalHeroRecords: number;
  byClass: Record<string, number>;
  byStatus: Record<string, number>;
  stressThreshold: number;
  highStressHeroes: HeroSummary[];
}

function increment(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

export function summarizeRoster(
  roster: Roster,
  stressThreshold = 100,
  town?: Town,
  progressionRules?: HeroProgressionRules,
): RosterSummary {
  const byClass: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const activeHeroes = roster.heroes.filter(
    (hero) => getHeroRosterState(hero.rosterStatus) === "active",
  );
  const deceasedHeroes = roster.heroes.filter(
    (hero) => getHeroRosterState(hero.rosterStatus) === "deceased",
  ).length;
  const unknownStateHeroes = roster.heroes.filter(
    (hero) => getHeroRosterState(hero.rosterStatus) === "unknown",
  ).length;

  for (const hero of roster.heroes) {
    increment(byStatus, String(hero.rosterStatus));
  }
  for (const hero of activeHeroes) increment(byClass, hero.heroClass);

  const highStressHeroes = activeHeroes
    .filter((hero) => hero.stress >= stressThreshold)
    .sort((left, right) => right.stress - left.stress)
    .map((hero) => toHeroSummary(hero, town, progressionRules));

  return {
    activeHeroes: activeHeroes.length,
    deceasedHeroes,
    unknownStateHeroes,
    totalHeroRecords: roster.heroes.length,
    byClass,
    byStatus,
    stressThreshold,
    highStressHeroes,
  };
}
