import type { Roster } from "../domain/hero.js";
import { type HeroSummary, toHeroSummary } from "./list-heroes.js";

export interface RosterSummary {
  totalHeroes: number;
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
): RosterSummary {
  const byClass: Record<string, number> = {};
  const byStatus: Record<string, number> = {};

  for (const hero of roster.heroes) {
    increment(byClass, hero.heroClass);
    increment(byStatus, String(hero.rosterStatus));
  }

  const highStressHeroes = roster.heroes
    .filter((hero) => hero.stress >= stressThreshold)
    .sort((left, right) => right.stress - left.stress)
    .map(toHeroSummary);

  return {
    totalHeroes: roster.heroes.length,
    byClass,
    byStatus,
    stressThreshold,
    highStressHeroes,
  };
}
