export type HeroRosterState = "active" | "deceased" | "unknown";

export function getHeroRosterState(rosterStatus: number): HeroRosterState {
  if (rosterStatus === 0 || rosterStatus === 1) return "active";
  if (rosterStatus === 3) return "deceased";
  return "unknown";
}

export function isDeceasedHero(rosterStatus: number): boolean {
  return getHeroRosterState(rosterStatus) === "deceased";
}
