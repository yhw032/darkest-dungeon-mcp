import type {
  ClassSkillGuidance,
  ClassSynergyKnowledge,
  ClassKnowledge,
  ClassKnowledgeBase,
} from "../domain/class-knowledge.js";
import {
  localizeCombatSkill,
  localizeHeroClass,
  type GameLanguage,
  type GameLocalization,
} from "../localization/game-localization.js";
import { normalizeKnowledgeTerm } from "./search-curios.js";

export interface ClassQueryFilters {
  id?: string;
  query?: string;
  role?: string;
  isDlc?: boolean;
  dlc?: string;
  limit?: number;
  language?: GameLanguage;
}

export type LocalizedClassSkillGuidance = ClassSkillGuidance & {
  name: string | null;
};

export type LocalizedClassSynergyKnowledge = ClassSynergyKnowledge & {
  heroClassName: string | null;
};

export type LocalizedClassKnowledge = Omit<
  ClassKnowledge,
  "aliases" | "skillGuidance" | "partySynergies"
> & {
  name: string | null;
  skillGuidance: LocalizedClassSkillGuidance[];
  partySynergies: LocalizedClassSynergyKnowledge[];
};

function searchableNames(
  knowledge: ClassKnowledge,
  localization?: GameLocalization,
): string[] {
  return [
    knowledge.id,
    ...knowledge.aliases,
    ...[...(localization?.values() ?? [])]
      .map((strings) => strings.get(`hero_class_name_${knowledge.id}`))
      .filter((name): name is string => name !== undefined),
  ].map(normalizeKnowledgeTerm);
}

function matchScore(
  knowledge: ClassKnowledge,
  query: string,
  localization?: GameLocalization,
): number | undefined {
  const names = searchableNames(knowledge, localization);
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
  localization?: GameLocalization,
): LocalizedClassKnowledge[] {
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

    const score = query === "" ? 0 : matchScore(knowledge, query, localization);
    return score === undefined ? [] : [{ knowledge, score }];
  });

  matches.sort(
    (left, right) =>
      left.score - right.score ||
      left.knowledge.id.localeCompare(right.knowledge.id),
  );

  const limit =
    filters.limit === undefined
      ? matches.length
      : Math.max(0, Math.floor(filters.limit));
  return matches.slice(0, limit).map(({ knowledge }) => {
    const { aliases: _aliases, skillGuidance, partySynergies, ...details } =
      knowledge;
    const language = filters.language ?? "en";
    return {
      ...details,
      name: localizeHeroClass(knowledge.id, language, localization),
      skillGuidance: skillGuidance.map((skill) => ({
        ...skill,
        name: localizeCombatSkill(
          knowledge.id,
          skill.skillId,
          language,
          localization,
        ),
      })),
      partySynergies: partySynergies.map((synergy) => ({
        ...synergy,
        heroClassName: localizeHeroClass(
          synergy.heroClassId,
          language,
          localization,
        ),
      })),
    };
  });
}
