import type { Estate } from "./estate.js";
import type { Roster } from "./hero.js";

export interface GameState {
  roster: Roster;
  estate: Estate;
}
