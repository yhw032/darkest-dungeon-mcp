import type {
  CurioKnowledge,
  CurioKnowledgeBase,
  CurioRegion,
} from "../domain/curio-knowledge.js";
import {
  localizeCurio,
  type GameLanguage,
  type GameLocalization,
} from "../localization/game-localization.js";

export type CurioSummary = Omit<
  CurioKnowledge,
  "interactions" | "notes" | "sources" | "localizationId"
> & {
  name: string | null;
};

export interface CurioSearchFilters {
  query?: string;
  region?: CurioRegion;
  language?: GameLanguage;
  limit?: number;
}

export function normalizeKnowledgeTerm(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[’']/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function searchableNames(
  curio: CurioKnowledge,
  localization?: GameLocalization,
): string[] {
  const locKey = curio.localizationId ?? curio.id;
  const localizedNames = [...(localization?.values() ?? [])]
    .map((strings) => strings.get(`str_curio_title_${locKey}`))
    .filter((name): name is string => name !== undefined);

  return [
    curio.id,
    ...curio.aliases,
    ...localizedNames,
  ].map(normalizeKnowledgeTerm);
}

function matchScore(
  curio: CurioKnowledge,
  query: string,
  localization?: GameLocalization,
): number | undefined {
  const names = searchableNames(curio, localization);
  if (names.some((name) => name === query)) return 0;
  if (names.some((name) => name.startsWith(query))) return 1;
  if (names.some((name) => name.includes(query))) return 2;
  return undefined;
}

export function toCurioSummary(
  curio: CurioKnowledge,
  language: GameLanguage = "en",
  localization?: GameLocalization,
): CurioSummary {
  const { id, aliases, regions, dlcs, availability } = curio;
  return {
    id,
    name: localizeCurio(curio.localizationId ?? curio.id, language, localization),
    aliases,
    regions,
    dlcs,
    availability,
  };
}

export function searchCurios(
  knowledge: CurioKnowledgeBase,
  filters: CurioSearchFilters = {},
  localization?: GameLocalization,
): CurioSummary[] {
  const query = normalizeKnowledgeTerm(filters.query ?? "");
  const language = filters.language ?? "en";
  const matches = knowledge.curios.flatMap((curio) => {
    if (
      filters.region !== undefined &&
      !curio.regions.includes(filters.region)
    ) {
      return [];
    }

    const score = query === "" ? 0 : matchScore(curio, query, localization);
    return score === undefined ? [] : [{ curio, score }];
  });

  matches.sort(
    (left, right) =>
      left.score - right.score ||
      left.curio.id.localeCompare(right.curio.id),
  );

  const limit =
    filters.limit === undefined
      ? matches.length
      : Math.max(0, Math.floor(filters.limit));
  return matches
    .slice(0, limit)
    .map(({ curio }) => toCurioSummary(curio, language, localization));
}
