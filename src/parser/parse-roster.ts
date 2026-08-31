import type {
  EquippedTrinket,
  Hero,
  Quirk,
  Roster,
  SkillSelection,
} from "../domain/hero.js";
import {
  SaveValidationError,
  expectBoolean,
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
      evolutionDurationRemaining: expectNumber(
        quirk.evolution_duration_remaining,
        `${quirkPath}.evolution_duration_remaining`,
      ),
    };
  });
}

function parseTrinkets(value: unknown, path: string): EquippedTrinket[] {
  if (value === undefined) return [];
  const trinkets = expectRecord(value, path);
  if (trinkets.items === undefined) return [];
  const items = expectRecord(trinkets.items, `${path}.items`);

  return Object.entries(items).map(([key, rawItem]) => {
    const itemPath = `${path}.items.${key}`;
    const item = expectRecord(rawItem, itemPath);
    return {
      id: expectString(item.id, `${itemPath}.id`),
      type: expectString(item.type, `${itemPath}.type`),
      amount: expectNumber(item.amount, `${itemPath}.amount`),
    };
  });
}

function parseSkillSelections(
  value: unknown,
  path: string,
): SkillSelection[] {
  if (value === undefined) return [];
  const selections = expectRecord(value, path);
  return Object.entries(selections).map(([id, rawValue]) => ({
    id,
    rawSelectionValue: expectNumber(rawValue, `${path}.${id}`),
  }));
}

function nullableId(value: unknown, path: string): string | null {
  const id = expectString(value, path);
  return id === "" ? null : id;
}

function nullableBuildingName(value: unknown, path: string): string | null {
  return nullableId(value, path);
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
    buildingName: nullableBuildingName(
      hero["roster.building_name"],
      `${heroPath}.roster.building_name`,
    ),
    currentHp: typeof currentHp === "number" ? currentHp : null,
    weaponRank: expectNumber(hero.weapon_rank, `${heroPath}.weapon_rank`),
    armourRank: expectNumber(hero.armour_rank, `${heroPath}.armour_rank`),
    afflictionId: nullableId(
      hero.affliction_type_id,
      `${heroPath}.affliction_type_id`,
    ),
    afflictionSeverity: expectNumber(
      hero.affliction_severity,
      `${heroPath}.affliction_severity`,
    ),
    virtueId: nullableId(hero.virtue_type_id, `${heroPath}.virtue_type_id`),
    visitedDeathsDoor: expectBoolean(
      hero.visited_deaths_door,
      `${heroPath}.visited_deaths_door`,
    ),
    hasHadHeartAttack: expectBoolean(
      hero.has_had_heart_attack,
      `${heroPath}.has_had_heart_attack`,
    ),
    deathHeartAttackCompleted: expectBoolean(
      hero.is_death_heart_attack_completed,
      `${heroPath}.is_death_heart_attack_completed`,
    ),
    quirks: parseQuirks(hero.quirks, `${heroPath}.quirks`),
    equippedTrinkets: parseTrinkets(hero.trinkets, `${heroPath}.trinkets`),
    combatSkills: objectKeys(
      skills.selected_combat_skills,
      `${heroPath}.skills.selected_combat_skills`,
    ),
    campingSkills: objectKeys(
      skills.selected_camping_skills,
      `${heroPath}.skills.selected_camping_skills`,
    ),
    combatSkillSelections: parseSkillSelections(
      skills.selected_combat_skills,
      `${heroPath}.skills.selected_combat_skills`,
    ),
    campingSkillSelections: parseSkillSelections(
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
