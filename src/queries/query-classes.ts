import type {
  ClassKnowledge,
  ClassKnowledgeBase,
} from "../domain/class-knowledge.js";
import { normalizeKnowledgeTerm } from "./search-curios.js";

export interface ClassQueryFilters {
  id?: string;
  query?: string;
  role?: string;
  isDlc?: boolean;
  dlc?: string;
  limit?: number;
}

function searchableNames(knowledge: ClassKnowledge): string[] {
  return [
    knowledge.id,
    knowledge.names.en,
    ...(knowledge.names.ko === undefined ? [] : [knowledge.names.ko]),
    ...knowledge.aliases,
  ].map(normalizeKnowledgeTerm);
}

function matchScore(
  knowledge: ClassKnowledge,
  query: string,
): number | undefined {
  const names = searchableNames(knowledge);
  if (names.some((name) => name === query)) return 0;
  if (names.some((name) => name.startsWith(query))) return 1;
  if (names.some((name) => name.includes(query))) return 2;
  return undefined;
}

function hasNormalizedValue(values: string[], expected: string): boolean {
  return values.some(
    (value) => normalizeKnowledgeTerm(value) === expected,
  );
}

export function queryClasses(
  knowledgeBase: ClassKnowledgeBase,
  filters: ClassQueryFilters = {},
): ClassKnowledge[] {
  const id =
    filters.id === undefined
      ? undefined
      : normalizeKnowledgeTerm(filters.id);
  const query = normalizeKnowledgeTerm(filters.query ?? "");
  const role =
    filters.role === undefined
      ? undefined
      : normalizeKnowledgeTerm(filters.role);
  const dlc =
    filters.dlc === undefined
      ? undefined
      : normalizeKnowledgeTerm(filters.dlc);

  const matches = knowledgeBase.classes.flatMap((knowledge) => {
    if (
      id !== undefined &&
      normalizeKnowledgeTerm(knowledge.id) !== id
    ) {
      return [];
    }
    if (role !== undefined && !hasNormalizedValue(knowledge.roles, role)) {
      return [];
    }
    if (dlc !== undefined && !hasNormalizedValue(knowledge.dlcs, dlc)) {
      return [];
    }
    if (
      filters.isDlc !== undefined &&
      (knowledge.dlcs.length > 0) !== filters.isDlc
    ) {
      return [];
    }

    const score = query === "" ? 0 : matchScore(knowledge, query);
    return score === undefined ? [] : [{ knowledge, score }];
  });

  matches.sort(
    (left, right) =>
      left.score - right.score ||
      left.knowledge.names.en.localeCompare(right.knowledge.names.en),
  );

  const limit =
    filters.limit === undefined
      ? matches.length
      : Math.max(0, Math.floor(filters.limit));
  return matches.slice(0, limit).map(({ knowledge }) => knowledge);
}
