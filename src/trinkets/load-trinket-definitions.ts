import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import type {
  TrinketBuffEffect,
  TrinketDefinition,
} from "../domain/trinket-definitions.js";
import {
  expectArray,
  expectNumber,
  expectRecord,
  expectString,
  optionalBoolean,
} from "../parser/roster-schema.js";

interface GameDataFile {
  path: readonly string[];
  optional: boolean;
}

interface RawTrinketEntry {
  id: string;
  buffIds: string[];
  heroClassRequirements: string[];
  rarity: string;
  price: number;
  limit: number;
  originDungeon: string | null;
}

const trinketFiles: readonly GameDataFile[] = [
  { path: ["trinkets", "base.entries.trinkets.json"], optional: false },
  {
    path: [
      "dlc",
      "445700_musketeer",
      "trinkets",
      "musketeer.entries.trinkets.json",
    ],
    optional: true,
  },
  {
    path: [
      "dlc",
      "580100_crimson_court",
      "features",
      "crimson_court",
      "trinkets",
      "crimson_court.entries.trinkets.json",
    ],
    optional: true,
  },
  {
    path: [
      "dlc",
      "580100_crimson_court",
      "features",
      "flagellant",
      "trinkets",
      "flagellant.entries.trinkets.json",
    ],
    optional: true,
  },
  {
    path: [
      "dlc",
      "702540_shieldbreaker",
      "trinkets",
      "shieldbreaker.entries.trinkets.json",
    ],
    optional: true,
  },
  {
    path: [
      "dlc",
      "735730_color_of_madness",
      "trinkets",
      "com.entries.trinkets.json",
    ],
    optional: true,
  },
  {
    path: [
      "dlc",
      "735730_color_of_madness",
      "trinkets",
      "special_com.entries.trinkets.json",
    ],
    optional: true,
  },
];

const buffFiles: readonly GameDataFile[] = [
  { path: ["shared", "buffs", "base.buffs.json"], optional: false },
  {
    path: [
      "dlc",
      "580100_crimson_court",
      "features",
      "crimson_court",
      "shared",
      "buffs",
      "crimson_court.buffs.json",
    ],
    optional: true,
  },
  {
    path: [
      "dlc",
      "580100_crimson_court",
      "features",
      "districts",
      "shared",
      "buffs",
      "districts.buffs.json",
    ],
    optional: true,
  },
  {
    path: [
      "dlc",
      "580100_crimson_court",
      "features",
      "flagellant",
      "shared",
      "buffs",
      "flagellant.buffs.json",
    ],
    optional: true,
  },
  {
    path: [
      "dlc",
      "702540_shieldbreaker",
      "shared",
      "buffs",
      "shieldbreaker.buffs.json",
    ],
    optional: true,
  },
  {
    path: [
      "dlc",
      "735730_color_of_madness",
      "shared",
      "buffs",
      "com.buffs.json",
    ],
    optional: true,
  },
];

function parseStringArray(value: unknown, path: string): string[] {
  return expectArray(value, path).map((item, index) =>
    expectString(item, `${path}[${String(index)}]`),
  );
}

export function parseRawTrinkets(
  value: unknown,
  source: string,
): RawTrinketEntry[] {
  const document = expectRecord(value, source);
  return expectArray(document.entries, `${source}.entries`).map(
    (item, index) => {
      const path = `${source}.entries[${String(index)}]`;
      const entry = expectRecord(item, path);
      const originDungeon =
        entry.origin_dungeon === undefined ||
        entry.origin_dungeon === null ||
        entry.origin_dungeon === ""
          ? null
          : expectString(entry.origin_dungeon, `${path}.origin_dungeon`);
      return {
        id: expectString(entry.id, `${path}.id`),
        buffIds: parseStringArray(entry.buffs ?? [], `${path}.buffs`),
        heroClassRequirements: parseStringArray(
          entry.hero_class_requirements ?? [],
          `${path}.hero_class_requirements`,
        ),
        rarity: expectString(entry.rarity, `${path}.rarity`),
        price: expectNumber(entry.price, `${path}.price`),
        limit: expectNumber(entry.limit, `${path}.limit`),
        originDungeon,
      };
    },
  );
}

export function parseBuffs(
  value: unknown,
  source: string,
): TrinketBuffEffect[] {
  const document = expectRecord(value, source);
  return expectArray(document.buffs, `${source}.buffs`).map((item, index) => {
    const path = `${source}.buffs[${String(index)}]`;
    const buff = expectRecord(item, path);
    return {
      buffId: expectString(buff.id, `${path}.id`),
      statType: expectString(buff.stat_type, `${path}.stat_type`),
      statSubType: expectString(buff.stat_sub_type, `${path}.stat_sub_type`),
      amount: expectNumber(buff.amount, `${path}.amount`),
      ruleType: expectString(buff.rule_type, `${path}.rule_type`),
      isFalseRule: optionalBoolean(buff.is_false_rule, `${path}.is_false_rule`),
    };
  });
}

async function readGameFiles(
  gameDirectory: string,
  files: readonly GameDataFile[],
): Promise<Array<{ source: string; text: string }>> {
  const loaded = await Promise.all(
    files.map(async (file) => {
      const source = join(...file.path);
      try {
        return {
          source,
          text: await readFile(resolve(gameDirectory, ...file.path), "utf8"),
        };
      } catch (error) {
        if (
          file.optional &&
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          return null;
        }
        throw error;
      }
    }),
  );
  return loaded.filter((file) => file !== null);
}

export async function loadTrinketDefinitions(
  gameDirectory: string,
): Promise<TrinketDefinition[]> {
  const [trinketDocuments, buffDocuments] = await Promise.all([
    readGameFiles(gameDirectory, trinketFiles),
    readGameFiles(gameDirectory, buffFiles),
  ]);

  const rawTrinkets = trinketDocuments.flatMap(({ source, text }) =>
    parseRawTrinkets(JSON.parse(text) as unknown, source),
  );
  const effects = new Map<string, TrinketBuffEffect>();
  for (const { source, text } of buffDocuments) {
    for (const effect of parseBuffs(JSON.parse(text) as unknown, source)) {
      effects.set(effect.buffId, effect);
    }
  }

  const seen = new Set<string>();
  return rawTrinkets.map((trinket) => {
    if (seen.has(trinket.id)) {
      throw new Error(`Duplicate trinket id: ${trinket.id}`);
    }
    seen.add(trinket.id);
    const resolvedEffects = trinket.buffIds.flatMap((id) => {
      const effect = effects.get(id);
      return effect === undefined ? [] : [effect];
    });
    return {
      id: trinket.id,
      rarity: trinket.rarity,
      price: trinket.price,
      limit: trinket.limit,
      heroClassRequirements: trinket.heroClassRequirements,
      originDungeon: trinket.originDungeon,
      effects: resolvedEffects,
      unresolvedBuffIds: trinket.buffIds.filter((id) => !effects.has(id)),
    };
  });
}
