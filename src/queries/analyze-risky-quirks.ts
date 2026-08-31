import type { Roster } from "../domain/hero.js";
import type {
  QuirkBuffEffect,
  QuirkDefinition,
  QuirkLocalizedText,
} from "../domain/quirk-definitions.js";
import type {
  QuirkRiskFactor,
  QuirkTreatmentKnowledgeBase,
  QuirkTreatmentPriority,
} from "../domain/quirk-treatment-knowledge.js";

export interface RiskyQuirkAnalysis {
  id: string;
  name: {
    english: string | null;
    korean: string | null;
  };
  description: {
    english: string | null;
    korean: string | null;
  };
  priority: QuirkTreatmentPriority;
  factors: QuirkRiskFactor[];
  reasons: string[];
  notes: string[];
  isLocked: boolean;
  isNew: boolean;
  evolutionDurationRemaining: number;
  effects: QuirkBuffEffect[];
  curioInteraction: {
    tag: string;
    chance: number;
    keepsLoot: boolean;
  } | null;
  definitionFound: boolean;
}

export interface RiskyHeroAnalysis {
  heroId: string;
  heroName: string;
  heroClass: string;
  resolveXp: number;
  stress: number;
  overallPriority: QuirkTreatmentPriority;
  riskyQuirks: RiskyQuirkAnalysis[];
}

export interface RiskyQuirkFilters {
  minimumPriority?: QuirkTreatmentPriority;
  lockedOnly?: boolean;
  heroId?: string;
  limit?: number;
}

const priorityRank: Record<QuirkTreatmentPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function copyLocalizedText(
  localization: QuirkLocalizedText | undefined,
): QuirkLocalizedText {
  return localization === undefined
    ? { name: null, description: null }
    : { ...localization };
}

function compareQuirks(
  left: RiskyQuirkAnalysis,
  right: RiskyQuirkAnalysis,
): number {
  return (
    priorityRank[right.priority] - priorityRank[left.priority] ||
    Number(right.isLocked) - Number(left.isLocked) ||
    left.id.localeCompare(right.id)
  );
}

function compareHeroes(
  left: RiskyHeroAnalysis,
  right: RiskyHeroAnalysis,
): number {
  return (
    priorityRank[right.overallPriority] -
      priorityRank[left.overallPriority] ||
    Number(right.riskyQuirks.some((quirk) => quirk.isLocked)) -
      Number(left.riskyQuirks.some((quirk) => quirk.isLocked)) ||
    right.riskyQuirks.length - left.riskyQuirks.length ||
    left.heroName.localeCompare(right.heroName) ||
    left.heroId.localeCompare(right.heroId)
  );
}

export function analyzeRiskyQuirks(
  roster: Roster,
  definitions: QuirkDefinition[],
  knowledge: QuirkTreatmentKnowledgeBase,
  filters: RiskyQuirkFilters = {},
): RiskyHeroAnalysis[] {
  const minimumPriority = filters.minimumPriority ?? "low";
  const minimumRank = priorityRank[minimumPriority];
  const definitionById = new Map(
    definitions.map((definition) => [definition.id, definition]),
  );
  const ruleById = new Map(
    knowledge.rules.map((rule) => [rule.quirkId, rule]),
  );

  const heroes = roster.heroes.flatMap((hero): RiskyHeroAnalysis[] => {
    if (filters.heroId !== undefined && hero.id !== filters.heroId) return [];

    const riskyQuirks = hero.quirks
      .flatMap((quirk): RiskyQuirkAnalysis[] => {
        const rule = ruleById.get(quirk.id);
        if (rule === undefined || priorityRank[rule.priority] < minimumRank) {
          return [];
        }
        if (filters.lockedOnly === true && !quirk.isLocked) return [];

        const definition = definitionById.get(quirk.id);
        const english = copyLocalizedText(definition?.localization.english);
        const korean = copyLocalizedText(definition?.localization.korean);
        return [
          {
            id: quirk.id,
            name: { english: english.name, korean: korean.name },
            description: {
              english: english.description,
              korean: korean.description,
            },
            priority: rule.priority,
            factors: [...rule.factors],
            reasons: [...rule.reasons],
            notes: [...rule.notes],
            isLocked: quirk.isLocked,
            isNew: quirk.isNew,
            evolutionDurationRemaining: quirk.evolutionDurationRemaining,
            effects:
              definition?.effects.map((effect) => ({ ...effect })) ?? [],
            curioInteraction:
              definition?.curioTag === undefined ||
              definition.curioTag === null
                ? null
                : {
                    tag: definition.curioTag,
                    chance: definition.curioTagChance,
                    keepsLoot: definition.keepsLoot,
                  },
            definitionFound: definition !== undefined,
          },
        ];
      })
      .sort(compareQuirks);

    const highest = riskyQuirks[0];
    return highest === undefined
      ? []
      : [
          {
            heroId: hero.id,
            heroName: hero.name,
            heroClass: hero.heroClass,
            resolveXp: hero.resolveXp,
            stress: hero.stress,
            overallPriority: highest.priority,
            riskyQuirks,
          },
        ];
  });

  heroes.sort(compareHeroes);
  const limit =
    filters.limit === undefined
      ? heroes.length
      : Math.max(0, Math.floor(filters.limit));
  return heroes.slice(0, limit);
}
