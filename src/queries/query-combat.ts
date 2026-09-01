import type {
  CombatKnowledgeBase,
  CombatRegionId,
  CombatThreatType,
  EnemyCombatKnowledge,
  EnemyPriority,
  RegionCombatKnowledge,
} from "../domain/combat-knowledge.js";
import type {
  QuestLanguage,
  QuestLocalization,
} from "../quests/localize-quest.js";
import { localizeDungeon } from "../quests/localize-quest.js";
import { normalizeKnowledgeTerm } from "./search-curios.js";

export type CombatQueryScope = "all" | "regions" | "enemies";

export interface CombatQueryFilters {
  query?: string;
  region?: CombatRegionId;
  threat?: CombatThreatType;
  priority?: EnemyPriority;
  scope?: CombatQueryScope;
  limit?: number;
  language?: QuestLanguage;
}

export type LocalizedRegionCombatKnowledge = RegionCombatKnowledge & {
  name: string | null;
};

export interface CombatQueryResult {
  regions: LocalizedRegionCombatKnowledge[];
  enemies: EnemyCombatKnowledge[];
}

const dungeonIdByCombatRegion: Record<CombatRegionId, string> = {
  ruins: "crypts",
  warrens: "warrens",
  weald: "weald",
  cove: "cove",
  courtyard: "courtyard",
  farmstead: "farm",
  darkest_dungeon: "darkestdungeon",
};

function matchScore(values: string[], query: string): number | undefined {
  const normalized = values.map(normalizeKnowledgeTerm);
  if (normalized.some((value) => value === query)) return 0;
  if (normalized.some((value) => value.startsWith(query))) return 1;
  if (normalized.some((value) => value.includes(query))) return 2;
  return undefined;
}

function localizedNames(
  id: string,
  names: { en: string; ko?: string },
  aliases: string[] = [],
): string[] {
  return [
    id,
    names.en,
    ...(names.ko === undefined ? [] : [names.ko]),
    ...aliases,
  ];
}

export function queryCombatKnowledge(
  knowledgeBase: CombatKnowledgeBase,
  filters: CombatQueryFilters = {},
  localization?: QuestLocalization,
): CombatQueryResult {
  const query = normalizeKnowledgeTerm(filters.query ?? "");
  const scope = filters.scope ?? "all";
  const limit =
    filters.limit === undefined
      ? Number.POSITIVE_INFINITY
      : Math.max(0, Math.floor(filters.limit));

  const regions =
    scope === "enemies" || filters.priority !== undefined
      ? []
      : knowledgeBase.regions
          .flatMap((region) => {
            if (filters.region !== undefined && region.id !== filters.region) {
              return [];
            }
            if (
              filters.threat !== undefined &&
              !region.commonThreats.some(
                ({ type }) => type === filters.threat,
              )
            ) {
              return [];
            }
            const dungeonId = dungeonIdByCombatRegion[region.id];
            const localizedRegionNames = [...(localization?.values() ?? [])]
              .map((strings) => strings.get(`dungeon_name_${dungeonId}`))
              .filter((name): name is string => name !== undefined);
            const score =
              query === ""
                ? 0
                : matchScore(
                    [region.id, dungeonId, ...localizedRegionNames],
                    query,
                  );
            return score === undefined ? [] : [{ knowledge: region, score }];
          })
          .sort(
            (left, right) =>
              left.score - right.score ||
              left.knowledge.id.localeCompare(right.knowledge.id),
          )
          .slice(0, limit)
          .map(({ knowledge }) => ({
            ...knowledge,
            name: localizeDungeon(
              dungeonIdByCombatRegion[knowledge.id],
              filters.language ?? "en",
              localization,
            ).name,
          }));

  const enemies =
    scope === "regions"
      ? []
      : knowledgeBase.enemies
          .flatMap((enemy) => {
            if (
              filters.region !== undefined &&
              !enemy.regions.includes(filters.region)
            ) {
              return [];
            }
            if (
              filters.threat !== undefined &&
              !enemy.dangerousActions.some(({ threats }) =>
                threats.includes(filters.threat!),
              )
            ) {
              return [];
            }
            if (
              filters.priority !== undefined &&
              enemy.priority !== filters.priority
            ) {
              return [];
            }
            const score =
              query === ""
                ? 0
                : matchScore(
                    localizedNames(enemy.id, enemy.names, enemy.aliases),
                    query,
                  );
            return score === undefined ? [] : [{ knowledge: enemy, score }];
          })
          .sort(
            (left, right) =>
              left.score - right.score ||
              left.knowledge.names.en.localeCompare(right.knowledge.names.en),
          )
          .slice(0, limit)
          .map(({ knowledge }) => knowledge);

  return { regions, enemies };
}
