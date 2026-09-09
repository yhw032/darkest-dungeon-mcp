import type { Roster } from "../domain/hero.js";
import type {
  QuirkBuffEffect,
  QuirkDefinition,
} from "../domain/quirk-definitions.js";
import type {
  PositiveQuirkApplicability,
  PositiveQuirkValueFactor,
  QuirkTreatmentSource,
  QuirkTreatmentKnowledgeBase,
  QuirkTreatmentPriority,
} from "../domain/quirk-treatment-knowledge.js";
import type { GameLanguage } from "../localization/game-localization.js";
import { isDeceasedHero } from "../roster/hero-roster-state.js";
import {
  analyzeRiskyQuirks,
  type RiskyQuirkAnalysis,
} from "./analyze-risky-quirks.js";

export const maximumLockedPositiveQuirks = 3;

export type PositiveQuirkManagementAction =
  | "lock_positive"
  | "keep_locked"
  | "do_not_prioritize"
  | "unrated";

export interface PositiveQuirkManagementAnalysis {
  id: string;
  name: string | null;
  description: string | null;
  recommendedAction: PositiveQuirkManagementAction;
  priority: QuirkTreatmentPriority | null;
  factors: PositiveQuirkValueFactor[];
  applicability: PositiveQuirkApplicability | null;
  heroClasses: string[];
  heroClassMatches: boolean | null;
  reasons: string[];
  notes: string[];
  cautions: string[];
  sources: QuirkTreatmentSource[];
  isLocked: boolean;
  isNew: boolean;
  evolutionDurationRemaining: number;
  canBeReplacedByNewQuirk: boolean | null;
  effects: QuirkBuffEffect[];
  definitionFound: boolean;
}

export interface QuirkManagementHeroAnalysis {
  heroId: string;
  heroName: string;
  heroClass: string;
  resolveXp: number;
  stress: number;
  overallPriority: QuirkTreatmentPriority | null;
  positiveLockSlots: {
    used: number;
    maximum: number;
    remaining: number;
    definitionCoverageComplete: boolean;
  };
  negativeRemovals: RiskyQuirkAnalysis[];
  positiveQuirks: PositiveQuirkManagementAnalysis[];
}

export interface QuirkManagementFilters {
  minimumNegativePriority?: QuirkTreatmentPriority;
  minimumPositivePriority?: QuirkTreatmentPriority;
  includeUnrated?: boolean;
  heroId?: string;
  limit?: number;
  language?: GameLanguage;
}

const priorityRank: Record<QuirkTreatmentPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function positiveAction(
  priority: QuirkTreatmentPriority | null,
  isLocked: boolean,
  canBeReplacedByNewQuirk: boolean | null,
  heroClassMatches: boolean | null,
): PositiveQuirkManagementAction {
  if (priority === null) return "unrated";
  if (priority === "low") return "do_not_prioritize";
  if (heroClassMatches === false) return "do_not_prioritize";
  if (isLocked) return "keep_locked";
  if (canBeReplacedByNewQuirk !== true) return "do_not_prioritize";
  return priority === "critical" || priority === "high"
    ? "lock_positive"
    : "do_not_prioritize";
}

function comparePositiveQuirks(
  left: PositiveQuirkManagementAnalysis,
  right: PositiveQuirkManagementAnalysis,
): number {
  return (
    (right.priority === null ? 0 : priorityRank[right.priority]) -
      (left.priority === null ? 0 : priorityRank[left.priority]) ||
    Number(right.isLocked) - Number(left.isLocked) ||
    left.id.localeCompare(right.id)
  );
}

export function recommendQuirkManagement(
  roster: Roster,
  definitions: QuirkDefinition[],
  knowledge: QuirkTreatmentKnowledgeBase,
  filters: QuirkManagementFilters = {},
): QuirkManagementHeroAnalysis[] {
  const language = filters.language ?? "en";
  const minimumPositiveRank =
    priorityRank[filters.minimumPositivePriority ?? "low"];
  const definitionById = new Map(
    definitions.map((definition) => [definition.id, definition]),
  );
  const positiveRuleById = new Map(
    knowledge.rules.flatMap((rule) =>
      rule.action === "lock_positive" ? [[rule.quirkId, rule] as const] : [],
    ),
  );
  const negativeByHeroId = new Map(
    analyzeRiskyQuirks(roster, definitions, knowledge, {
      minimumPriority: filters.minimumNegativePriority ?? "low",
      ...(filters.heroId === undefined ? {} : { heroId: filters.heroId }),
      language,
    }).map((hero) => [hero.heroId, hero.riskyQuirks]),
  );

  const heroes = roster.heroes.flatMap((hero): QuirkManagementHeroAnalysis[] => {
    if (isDeceasedHero(hero.rosterStatus)) return [];
    if (filters.heroId !== undefined && hero.id !== filters.heroId) return [];

    let definitionCoverageComplete = true;
    let usedPositiveSlots = 0;
    for (const quirk of hero.quirks.filter((candidate) => candidate.isLocked)) {
      const definition = definitionById.get(quirk.id);
      const positiveRule = positiveRuleById.get(quirk.id);
      if (definition === undefined) definitionCoverageComplete = false;
      if (definition?.isPositive === true || positiveRule !== undefined) {
        usedPositiveSlots += 1;
      }
    }

    const remainingPositiveSlots = Math.max(
      0,
      maximumLockedPositiveQuirks - usedPositiveSlots,
    );
    const positiveQuirks = hero.quirks
      .flatMap((quirk): PositiveQuirkManagementAnalysis[] => {
        const definition = definitionById.get(quirk.id);
        const rule = positiveRuleById.get(quirk.id);
        if (rule === undefined && definition?.isPositive !== true) return [];
        if (rule === undefined && filters.includeUnrated !== true) return [];
        if (
          rule !== undefined &&
          priorityRank[rule.priority] < minimumPositiveRank
        ) {
          return [];
        }

        const localized = definition?.localization[language];
        const cautions = rule === undefined ? [] : [...rule.cautions];
        const heroClassMatches =
          rule === undefined || rule.heroClasses.length === 0
            ? null
            : rule.heroClasses.includes(hero.heroClass);
        const recommendedAction = positiveAction(
          rule?.priority ?? null,
          quirk.isLocked,
          definition?.canBeReplacedByNewQuirk ?? null,
          heroClassMatches,
        );
        if (
          recommendedAction === "lock_positive" &&
          remainingPositiveSlots === 0
        ) {
          cautions.push(
            "No verified positive lock slot remains; reassess existing locks before spending gold.",
          );
        }
        if (rule !== undefined && definition === undefined) {
          cautions.push(
            "The installed game definition is unavailable, so lock eligibility cannot be verified.",
          );
        }
        if (heroClassMatches === false) {
          cautions.push(
            `This rule is not curated for hero class ${hero.heroClass}.`,
          );
        }

        return [
          {
            id: quirk.id,
            name: localized?.name ?? null,
            description: localized?.description ?? null,
            recommendedAction,
            priority: rule?.priority ?? null,
            factors: rule === undefined ? [] : [...rule.factors],
            applicability: rule?.applicability ?? null,
            heroClasses: rule === undefined ? [] : [...rule.heroClasses],
            heroClassMatches,
            reasons: rule === undefined ? [] : [...rule.reasons],
            notes: rule === undefined ? [] : [...rule.notes],
            cautions,
            sources:
              rule === undefined
                ? []
                : rule.sources.map((source) => ({ ...source })),
            isLocked: quirk.isLocked,
            isNew: quirk.isNew,
            evolutionDurationRemaining: quirk.evolutionDurationRemaining,
            canBeReplacedByNewQuirk:
              definition?.canBeReplacedByNewQuirk ?? null,
            effects:
              definition?.effects.map((effect) => ({ ...effect })) ?? [],
            definitionFound: definition !== undefined,
          },
        ];
      })
      .sort(comparePositiveQuirks);
    const negativeRemovals = negativeByHeroId.get(hero.id) ?? [];
    const priorities = [
      ...negativeRemovals.map((quirk) => quirk.priority),
      ...positiveQuirks.flatMap((quirk) =>
        quirk.priority === null ? [] : [quirk.priority],
      ),
    ].sort((left, right) => priorityRank[right] - priorityRank[left]);
    const overallPriority = priorities[0] ?? null;

    if (negativeRemovals.length === 0 && positiveQuirks.length === 0) return [];
    return [
      {
        heroId: hero.id,
        heroName: hero.name,
        heroClass: hero.heroClass,
        resolveXp: hero.resolveXp,
        stress: hero.stress,
        overallPriority,
        positiveLockSlots: {
          used: usedPositiveSlots,
          maximum: maximumLockedPositiveQuirks,
          remaining: remainingPositiveSlots,
          definitionCoverageComplete,
        },
        negativeRemovals,
        positiveQuirks,
      },
    ];
  });

  heroes.sort(
    (left, right) =>
      (right.overallPriority === null
        ? 0
        : priorityRank[right.overallPriority]) -
        (left.overallPriority === null ? 0 : priorityRank[left.overallPriority]) ||
      left.heroName.localeCompare(right.heroName) ||
      left.heroId.localeCompare(right.heroId),
  );
  const limit =
    filters.limit === undefined
      ? heroes.length
      : Math.max(0, Math.floor(filters.limit));
  return heroes.slice(0, limit);
}
