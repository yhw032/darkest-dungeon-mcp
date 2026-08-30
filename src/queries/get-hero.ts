import type { Hero, Roster } from "../domain/hero.js";

export function getHero(roster: Roster, heroId: string): Hero | undefined {
  return roster.heroes.find((hero) => hero.id === heroId);
}
