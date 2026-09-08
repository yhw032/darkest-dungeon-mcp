import type { TrinketBuffEffect, TrinketDefinition } from "../domain/trinket-definitions.js";
import type { TrinketGuidanceKnowledgeBase, TrinketTier } from "../domain/trinket-guidance.js";
import type { HeroProgressionRules } from "../domain/hero-progression.js";
import {
  getHeroAvailability,
  getResolveLevel,
} from "../progression/hero-progression.js";
import { isDeceasedHero } from "../roster/hero-roster-state.js";
import {
  localizeHeroClass,
  localizeTownBuilding,
  localizeTrinket,
  type GameLanguage,
  type GameLocalization,
} from "../localization/game-localization.js";
import {
  buildTrinketCatalog,
  type EquippedTrinketAssignment,
  type TrinketRecord,
  type TrinketSources,
  type TrinketStoreListing,
} from "./trinkets.js";
import { getHeroTownContext } from "./get-hero-town-context.js";

export type TrinketOwnershipStatus =
  | "in_storage"
  | "equipped_by_self"
  | "equipped_by_other"
  | "in_store"
  | "not_owned";

export interface RecommendedTrinketItem {
  trinketId: string;
  trinketName: string | null;
  tier: TrinketTier;
  rarity?: string | null;
  heroClassRequirements?: string[];
  heroClassRequirementNames?: Array<{ id: string; name: string | null }>;
  effects?: TrinketBuffEffect[];
  ownership: {
    isOwned: boolean;
    isAvailableForPurchase: boolean;
    status: TrinketOwnershipStatus;
    storageAmount: number;
    equippedBy: EquippedTrinketAssignment[];
    storeListings: TrinketStoreListing[];
  };
  recommendedRoles: string[];
  synergies: string[];
  cautions: string[];
  playstyleAdvice: string;
  matchReason: string;
}

export interface CandidateHeroRecommendation {
  heroId: string;
  heroName: string;
  heroClass: string;
  heroClassName: string | null;
  resolveLevel: number | null;
  stress: number;
  availability: ReturnType<typeof getHeroAvailability>;
  isCurrentlyEquipped: boolean;
  suitabilityReason: string;
}

export interface RecommendTrinketsResult {
  heroContext?: {
    heroId: string;
    heroName: string;
    heroClass: string;
    heroClassName: string | null;
    equippedTrinkets: Array<{ id: string; name: string | null }>;
  } | null;
  trinketContext?: {
    trinketId: string;
    trinketName: string | null;
    tier: TrinketTier;
    recommendedRoles: string[];
    recommendedClasses: string[];
    synergies: string[];
    cautions: string[];
    playstyleAdvice: string;
  } | null;
  recommendations: RecommendedTrinketItem[];
  candidateHeroes?: CandidateHeroRecommendation[];
}

export interface RecommendTrinketsOptions {
  heroId?: string | undefined;
  heroClass?: string | undefined;
  trinketId?: string | undefined;
  onlyOwned?: boolean | undefined;
  language?: GameLanguage | undefined;
}

const tierOrder: Record<TrinketTier, number> = {
  S: 1,
  A: 2,
  B: 3,
  situational: 4,
  trap: 5,
};

const ownershipOrder: Record<TrinketOwnershipStatus, number> = {
  in_storage: 1,
  equipped_by_self: 2,
  equipped_by_other: 3,
  in_store: 4,
  not_owned: 5,
};

export function recommendTrinkets(
  sources: TrinketSources,
  guidance: TrinketGuidanceKnowledgeBase,
  options: RecommendTrinketsOptions = {},
  definitions?: TrinketDefinition[],
  localization?: GameLocalization,
  progressionRules?: HeroProgressionRules,
): RecommendTrinketsResult {
  const language = options.language ?? "en";
  const onlyOwned = options.onlyOwned ?? true;

  const catalog = buildTrinketCatalog(sources);
  const catalogMap = new Map<string, TrinketRecord>(
    catalog.map((record) => [record.id, record]),
  );
  const definitionsMap = new Map<string, TrinketDefinition>(
    definitions?.map((def) => [def.id, def]),
  );
  const guidanceMap = new Map(
    guidance.trinkets.map((entry) => [entry.trinketId, entry]),
  );

  const hero =
    options.heroId === undefined
      ? undefined
      : sources.roster.heroes.find((h) => h.id === options.heroId);

  const targetClass = hero?.heroClass ?? options.heroClass;

  let heroContext: RecommendTrinketsResult["heroContext"] = null;
  if (hero !== undefined) {
    heroContext = {
      heroId: hero.id,
      heroName: hero.name,
      heroClass: hero.heroClass,
      heroClassName: localizeHeroClass(hero.heroClass, language, localization),
      equippedTrinkets: hero.equippedTrinkets.map((t) => ({
        id: t.id,
        name: localizeTrinket(t.id, language, localization),
      })),
    };
  }

  let trinketContext: RecommendTrinketsResult["trinketContext"] = null;
  let candidateHeroes: CandidateHeroRecommendation[] | undefined;

  if (options.trinketId !== undefined) {
    const entry = guidanceMap.get(options.trinketId);
    if (entry !== undefined) {
      trinketContext = {
        trinketId: entry.trinketId,
        trinketName: localizeTrinket(entry.trinketId, language, localization),
        tier: entry.tier,
        recommendedRoles: entry.recommendedRoles,
        recommendedClasses: entry.recommendedClasses,
        synergies: entry.synergies,
        cautions: entry.cautions,
        playstyleAdvice: entry.playstyleAdvice,
      };

      const def = definitionsMap.get(options.trinketId);
      candidateHeroes = sources.roster.heroes
        .filter((h) => !isDeceasedHero(h.rosterStatus))
        .filter((h) => {
          if (def === undefined) return true;
          return (
            def.heroClassRequirements.length === 0 ||
            def.heroClassRequirements.includes(h.heroClass)
          );
        })
        .map((h) => {
          const isOptimal = entry.recommendedClasses.includes(h.heroClass);
          const isCurrentlyEquipped = h.equippedTrinkets.some(
            (t) => t.id === options.trinketId,
          );
          const resolveLevel = getResolveLevel(h.resolveXp, progressionRules);
          const townContext = getHeroTownContext(
            sources.roster,
            sources.town,
            h.id,
          )!;
          const suitabilityReason = isOptimal
            ? `Recommended core class (${h.heroClass}) for this trinket.`
            : `Eligible hero class (${h.heroClass}) meeting equipment requirements.`;

          return {
            heroId: h.id,
            heroName: h.name,
            heroClass: h.heroClass,
            heroClassName: localizeHeroClass(h.heroClass, language, localization),
            resolveLevel,
            stress: h.stress,
            availability: getHeroAvailability(h, townContext),
            isCurrentlyEquipped,
            suitabilityReason,
          };
        })
        .sort((left, right) => {
          if (
            left.availability.isAvailableForPartySelection !==
            right.availability.isAvailableForPartySelection
          ) {
            return left.availability.isAvailableForPartySelection ? -1 : 1;
          }
          const leftOptimal = entry.recommendedClasses.includes(left.heroClass);
          const rightOptimal = entry.recommendedClasses.includes(right.heroClass);
          if (leftOptimal && !rightOptimal) return -1;
          if (!leftOptimal && rightOptimal) return 1;
          return (
            (right.resolveLevel ?? 0) - (left.resolveLevel ?? 0) ||
            left.heroName.localeCompare(right.heroName)
          );
        });
    }
  }

  // Generate recommendations
  const recommendationPool =
    options.trinketId !== undefined
      ? guidance.trinkets.filter((entry) => entry.trinketId === options.trinketId)
      : guidance.trinkets;

  const recommendations: RecommendedTrinketItem[] = [];

  for (const entry of recommendationPool) {
    const def = definitionsMap.get(entry.trinketId);
    const record = catalogMap.get(entry.trinketId);

    // Class compatibility check if targetClass is defined
    let matchReason = "";
    if (targetClass !== undefined) {
      if (entry.recommendedClasses.includes(targetClass)) {
        matchReason = `Class-specific core recommendation for ${targetClass}`;
      } else if (entry.recommendedClasses.length === 0) {
        // Universal item: verify that def doesn't restrict away from targetClass
        if (
          def !== undefined &&
          def.heroClassRequirements.length > 0 &&
          !def.heroClassRequirements.includes(targetClass)
        ) {
          continue; // Incompatible class
        }
        matchReason = `Universal ${entry.tier}-tier ${entry.recommendedRoles.join("/")} enhancement`;
      } else {
        // Specifically recommended for other classes
        continue;
      }
    } else {
      matchReason = `${entry.tier}-tier recommendation for ${entry.recommendedRoles.join("/")}`;
    }

    // Ownership status
    const isEquippedBySelf =
      hero !== undefined &&
      record?.equippedBy.some((e) => e.heroId === hero.id);
    const hasStorage = (record?.storageAmount ?? 0) > 0;
    const hasEquipped = (record?.equippedBy.length ?? 0) > 0;
    const hasStore = (record?.storeAmount ?? 0) > 0;
    const isOwned = hasStorage || hasEquipped;

    if (onlyOwned && !isOwned) {
      continue;
    }

    let status: TrinketOwnershipStatus = "not_owned";
    if (isEquippedBySelf) {
      status = "equipped_by_self";
    } else if (hasStorage) {
      status = "in_storage";
    } else if (hasEquipped) {
      status = "equipped_by_other";
    } else if (hasStore) {
      status = "in_store";
    }

    const heroClassRequirements = def?.heroClassRequirements;
    const heroClassRequirementNames =
      heroClassRequirements === undefined
        ? undefined
        : heroClassRequirements.map((id) => ({
            id,
            name: localizeHeroClass(id, language, localization),
          }));

    const storeListings: TrinketStoreListing[] =
      record?.storeListings.map((listing) => ({
        ...listing,
        buildingName: localizeTownBuilding(
          listing.buildingId,
          language,
          localization,
        ),
      })) ?? [];

    recommendations.push({
      trinketId: entry.trinketId,
      trinketName: localizeTrinket(entry.trinketId, language, localization),
      tier: entry.tier,
      ...(def === undefined
        ? {}
        : {
            rarity: def.rarity,
            heroClassRequirements: def.heroClassRequirements,
            ...(heroClassRequirementNames === undefined
              ? {}
              : { heroClassRequirementNames }),
            effects: def.effects,
          }),
      ownership: {
        isOwned,
        isAvailableForPurchase: hasStore,
        status,
        storageAmount: record?.storageAmount ?? 0,
        equippedBy: record?.equippedBy ?? [],
        storeListings,
      },
      recommendedRoles: entry.recommendedRoles,
      synergies: entry.synergies,
      cautions: entry.cautions,
      playstyleAdvice: entry.playstyleAdvice,
      matchReason,
    });
  }

  // Sort recommendations by tier, then by ownership status, then by class specificity, then by id
  recommendations.sort((left, right) => {
    const tierDiff = tierOrder[left.tier] - tierOrder[right.tier];
    if (tierDiff !== 0) return tierDiff;

    const leftSpecific =
      targetClass !== undefined &&
      (guidanceMap.get(left.trinketId)?.recommendedClasses.includes(targetClass) ?? false);
    const rightSpecific =
      targetClass !== undefined &&
      (guidanceMap.get(right.trinketId)?.recommendedClasses.includes(targetClass) ?? false);
    if (leftSpecific && !rightSpecific) return -1;
    if (!leftSpecific && rightSpecific) return 1;

    const ownDiff = ownershipOrder[left.ownership.status] - ownershipOrder[right.ownership.status];
    if (ownDiff !== 0) return ownDiff;

    return left.trinketId.localeCompare(right.trinketId);
  });

  return {
    heroContext,
    trinketContext,
    recommendations,
    ...(candidateHeroes === undefined ? {} : { candidateHeroes }),
  };
}
