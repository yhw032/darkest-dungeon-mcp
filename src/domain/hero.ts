export interface Quirk {
  id: string;
  isLocked: boolean;
  isNew: boolean;
}

export interface Hero {
  id: string;
  name: string;
  heroClass: string;
  resolveXp: number;
  stress: number;
  rosterStatus: number;
  currentHp: number | null;
  quirks: Quirk[];
  combatSkills: string[];
  campingSkills: string[];
}

export interface Roster {
  version: number;
  nextGuid: number;
  heroes: Hero[];
}
