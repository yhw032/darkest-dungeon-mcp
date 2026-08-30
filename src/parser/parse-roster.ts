import type { Hero, Quirk, Roster } from "../domain/hero.js";
import {
  SaveValidationError,
  expectNumber,
  expectRecord,
  expectString,
  optionalBoolean,
} from "./roster-schema.js";

function objectKeys(value: unknown, path: string): string[] {
  if (value === undefined) {
    return [];
  }

  return Object.keys(expectRecord(value, path));
}

function parseQuirks(value: unknown, path: string): Quirk[] {
  if (value === undefined) {
    return [];
  }

  const rawQuirks = expectRecord(value, path);

  return Object.entries(rawQuirks).map(([id, rawQuirk]) => {
    const quirkPath = `${path}.${id}`;
    const quirk = expectRecord(rawQuirk, quirkPath);

    return {
      id,
      isLocked: optionalBoolean(quirk.is_locked, `${quirkPath}.is_locked`),
      isNew: optionalBoolean(quirk.is_new, `${quirkPath}.is_new`),
    };
  });
}

function parseHero(id: string, value: unknown, path: string): Hero {
  const heroEntry = expectRecord(value, path);
  const heroFileData = expectRecord(
    heroEntry.hero_file_data,
    `${path}.hero_file_data`,
  );
  const rawData = expectRecord(
    heroFileData.raw_data,
    `${path}.hero_file_data.raw_data`,
  );
  const hero = expectRecord(
    rawData.base_root,
    `${path}.hero_file_data.raw_data.base_root`,
  );
  const heroPath = `${path}.hero_file_data.raw_data.base_root`;
  const actor = expectRecord(hero.actor, `${heroPath}.actor`);
  const skills =
    hero.skills === undefined
      ? {}
      : expectRecord(hero.skills, `${heroPath}.skills`);

  const currentHp = actor.current_hp;
  if (currentHp !== undefined && currentHp !== null) {
    expectNumber(currentHp, `${heroPath}.actor.current_hp`);
  }

  return {
    id,
    name: expectString(actor.name, `${heroPath}.actor.name`),
    heroClass: expectString(hero.heroClass, `${heroPath}.heroClass`),
    resolveXp: expectNumber(hero.resolveXp, `${heroPath}.resolveXp`),
    stress: expectNumber(hero.m_Stress, `${heroPath}.m_Stress`),
    rosterStatus: expectNumber(
      hero["roster.status"],
      `${heroPath}.roster.status`,
    ),
    currentHp: typeof currentHp === "number" ? currentHp : null,
    quirks: parseQuirks(hero.quirks, `${heroPath}.quirks`),
    combatSkills: objectKeys(
      skills.selected_combat_skills,
      `${heroPath}.skills.selected_combat_skills`,
    ),
    campingSkills: objectKeys(
      skills.selected_camping_skills,
      `${heroPath}.skills.selected_camping_skills`,
    ),
  };
}

export function parseRoster(value: unknown): Roster {
  const document = expectRecord(value, "$");
  const root = expectRecord(document.base_root, "$.base_root");
  const rawHeroes = expectRecord(root.heroes, "$.base_root.heroes");

  return {
    version: expectNumber(root.version, "$.base_root.version"),
    nextGuid: expectNumber(root.nextGuid, "$.base_root.nextGuid"),
    heroes: Object.entries(rawHeroes).map(([id, hero]) =>
      parseHero(id, hero, `$.base_root.heroes.${id}`),
    ),
  };
}

export function parseRosterJson(text: string): Roster {
  let value: unknown;

  try {
    value = JSON.parse(text) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new SaveValidationError(`invalid JSON (${detail})`, "$");
  }

  return parseRoster(value);
}
