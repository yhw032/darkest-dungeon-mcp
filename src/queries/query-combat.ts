import type {
  CombatKnowledgeBase,
  CombatRegionId,
  CombatThreatType,
  EnemyActionKnowledge,
  EnemyCombatKnowledge,
  EnemyPriority,
  RegionCombatKnowledge,
} from "../domain/combat-knowledge.js";
import {
  localizeGameString,
  localizeGameStrings,
  type GameLanguage,
  type GameLocalization,
} from "../localization/game-localization.js";
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
  language?: GameLanguage;
}

export type LocalizedRegionCombatKnowledge = RegionCombatKnowledge & {
  name: string | null;
};

export type LocalizedEnemyActionKnowledge = Omit<
  EnemyActionKnowledge,
  "localizationIds"
> & { name: string | null };

export type LocalizedEnemyCombatKnowledge = Omit<
  EnemyCombatKnowledge,
  "localizationId" | "aliases" | "dangerousActions"
> & {
  name: string | null;
  dangerousActions: LocalizedEnemyActionKnowledge[];
};

export interface CombatQueryResult {
  regions: LocalizedRegionCombatKnowledge[];
  enemies: LocalizedEnemyCombatKnowledge[];
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

function namesInAllLanguages(
  localizationId: string,
  localization?: GameLocalization,
): string[] {
  return [...(localization?.values() ?? [])]
    .map((strings) => strings.get(localizationId))
    .filter((name): name is string => name !== undefined);
}

export function queryCombatKnowledge(
  knowledgeBase: CombatKnowledgeBase,
  filters: CombatQueryFilters = {},
  localization?: GameLocalization,
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
                    [
                      enemy.id,
                      ...enemy.aliases,
                      ...namesInAllLanguages(enemy.localizationId, localization),
                    ],
                    query,
                  );
            return score === undefined ? [] : [{ knowledge: enemy, score }];
          })
          .sort(
            (left, right) =>
              left.score - right.score ||
              left.knowledge.id.localeCompare(right.knowledge.id),
          )
          .slice(0, limit)
          .map(({ knowledge }) => {
            const {
              localizationId,
              aliases: _aliases,
              dangerousActions,
              ...enemy
            } = knowledge;
            return {
              ...enemy,
              name: localizeGameString(
                localizationId,
                filters.language ?? "en",
                localization,
              ),
              dangerousActions: dangerousActions.map((action) => {
                const { localizationIds, ...details } = action;
                return {
                  ...details,
                  name: localizeGameStrings(
                    localizationIds,
                    filters.language ?? "en",
                    localization,
                  ),
                };
              }),
            };
          });

  return { regions, enemies };
}
