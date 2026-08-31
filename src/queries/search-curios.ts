import type {
  CurioKnowledge,
  CurioKnowledgeBase,
  CurioRegion,
} from "../domain/curio-knowledge.js";

export type CurioSummary = Pick<
  CurioKnowledge,
  "id" | "names" | "aliases" | "regions" | "dlcs" | "availability"
>;

export interface CurioSearchFilters {
  query?: string;
  region?: CurioRegion;
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

function searchableNames(curio: CurioKnowledge): string[] {
  return [
    curio.id,
    curio.names.en,
    ...(curio.names.ko === undefined ? [] : [curio.names.ko]),
    ...curio.aliases,
  ].map(normalizeKnowledgeTerm);
}

function matchScore(curio: CurioKnowledge, query: string): number | undefined {
  const names = searchableNames(curio);
  if (names.some((name) => name === query)) return 0;
  if (names.some((name) => name.startsWith(query))) return 1;
  if (names.some((name) => name.includes(query))) return 2;
  return undefined;
}

export function toCurioSummary(curio: CurioKnowledge): CurioSummary {
  const { id, names, aliases, regions, dlcs, availability } = curio;
  return { id, names, aliases, regions, dlcs, availability };
}

export function searchCurios(
  knowledge: CurioKnowledgeBase,
  filters: CurioSearchFilters = {},
): CurioSummary[] {
  const query = normalizeKnowledgeTerm(filters.query ?? "");
  const matches = knowledge.curios.flatMap((curio) => {
    if (
      filters.region !== undefined &&
      !curio.regions.includes(filters.region)
    ) {
      return [];
    }

    const score = query === "" ? 0 : matchScore(curio, query);
    return score === undefined ? [] : [{ curio, score }];
  });

  matches.sort(
    (left, right) =>
      left.score - right.score ||
      left.curio.names.en.localeCompare(right.curio.names.en),
  );

  const limit =
    filters.limit === undefined
      ? matches.length
      : Math.max(0, Math.floor(filters.limit));
  return matches.slice(0, limit).map(({ curio }) => toCurioSummary(curio));
}
