import type { BuildingUpgradeTree } from "../domain/building-upgrades.js";
import type {
  BuildingUpgradePlanResult,
  BuildingUpgradePriorityKnowledge,
  BuildingUpgradeRecommendation,
  HeirloomCostStatus,
  HeirloomExchangeOpportunity,
  UpgradePriorityTier,
} from "../domain/building-upgrade-recommendations.js";
import type { GameState } from "../domain/game-state.js";
import {
  localizeBuildingUpgradeTree,
  localizeEstateResource,
  localizeTownBuilding,
  type GameLanguage,
  type GameLocalization,
} from "../localization/game-localization.js";
import { getBuildingUpgradeProgress } from "../upgrades/building-upgrades.js";

export interface RecommendBuildingUpgradesOptions {
  language?: GameLanguage;
}

export interface RecommendBuildingUpgradesDependencies {
  localization?: GameLocalization | undefined;
}

const heirloomExchangeRates: Record<string, number> = {
  crest: 1.0,
  bust: 3.0,
  deed: 3.0,
  portrait: 4.5,
};

const tierWeight: Record<UpgradePriorityTier, number> = {
  S: 4,
  A: 3,
  B: 2,
  C: 1,
};

export function recommendBuildingUpgrades(
  gameState: GameState,
  trees: BuildingUpgradeTree[],
  priorityKnowledge: BuildingUpgradePriorityKnowledge,
  options: RecommendBuildingUpgradesOptions = {},
  dependencies: RecommendBuildingUpgradesDependencies = {},
): BuildingUpgradePlanResult {
  const language = options.language ?? "en";
  const { localization } = dependencies;

  // 1. Current Estate Heirlooms & Resources
  const resourceMap = new Map<string, number>();
  for (const res of gameState.estate.resources) {
    resourceMap.set(res.type, res.amount);
  }

  const estateResources = gameState.estate.resources.map((res) => ({
    type: res.type,
    name: localizeEstateResource(res.type, language, localization),
    amount: res.amount,
  }));

  // 2. Current Progress Evaluation
  const progressList = getBuildingUpgradeProgress(gameState.upgrades, trees);

  const allRecommendations: BuildingUpgradeRecommendation[] = [];

  for (const progress of progressList) {
    if (progress.isComplete || !progress.nextRequirement) continue;

    const buildingId = progress.buildingId;
    const treeId = progress.treeId;
    const nextCode = progress.nextRequirement.code;
    const nextLevel = progress.purchasedCount + 1;

    // Find priority configuration
    const config = priorityKnowledge.treePriorities.find(
      (p) =>
        p.buildingId === buildingId &&
        (p.treeId === treeId ||
          p.treeId === `${buildingId}.${treeId}` ||
          p.treeId.endsWith(`.${treeId}`) ||
          treeId.endsWith(`.${p.treeId}`)),
    );
    const priorityTier: UpgradePriorityTier = config?.priorityTier ?? "C";
    const strategicImportance =
      config?.strategicImportance ?? "Secondary estate facility upgrade.";

    // Costs analysis
    const costs: HeirloomCostStatus[] = [];
    let isAffordable = true;
    const missingItems: Array<{ type: string; missing: number }> = [];

    for (const cost of progress.nextRequirement.currencyCost) {
      const current = resourceMap.get(cost.type) ?? 0;
      const required = cost.amount;
      const missing = Math.max(0, required - current);
      if (missing > 0) {
        isAffordable = false;
        missingItems.push({ type: cost.type, missing });
      }

      costs.push({
        type: cost.type,
        typeName: localizeEstateResource(cost.type, language, localization),
        current,
        required,
        missing,
      });
    }

    // Exchange simulation
    const recommendedExchanges: HeirloomExchangeOpportunity[] = [];
    let canAffordViaExchange = false;

    if (!isAffordable && missingItems.length > 0) {
      // Find surplus heirlooms among currencies not required or exceeding requirement
      const surplusSources: Array<{ type: string; amount: number; rate: number }> = [];

      for (const [type, amount] of resourceMap.entries()) {
        if (!heirloomExchangeRates[type]) continue;
        const reqCost = progress.nextRequirement.currencyCost.find((c) => c.type === type);
        const reqAmount = reqCost ? reqCost.amount : 0;
        const surplus = Math.max(0, amount - reqAmount);
        if (surplus > 0) {
          const rate = heirloomExchangeRates[type]!;
          surplusSources.push({ type, amount: surplus, rate });
        }
      }

      surplusSources.sort((a, b) => b.rate - a.rate);
      const proposedExchanges: HeirloomExchangeOpportunity[] = [];
      let allMissingItemsCovered = true;

      for (const target of missingItems) {
        const targetRate = heirloomExchangeRates[target.type] ?? 1.0;
        let remainingTargetAmount = target.missing;

        for (const src of surplusSources) {
          if (remainingTargetAmount <= 0) break;
          const maximumTargetAmount = Math.floor(
            (src.amount * src.rate) / targetRate,
          );
          if (maximumTargetAmount <= 0) continue;

          const requestedTargetAmount = Math.min(
            remainingTargetAmount,
            maximumTargetAmount,
          );
          const sourceAmountToTrade = Math.min(
            src.amount,
            Math.ceil((requestedTargetAmount * targetRate) / src.rate),
          );
          const targetAmountReceived = Math.floor(
            (sourceAmountToTrade * src.rate) / targetRate,
          );
          if (targetAmountReceived <= 0) continue;

          proposedExchanges.push({
            sourceType: src.type,
            sourceTypeName: localizeEstateResource(
              src.type,
              language,
              localization,
            ),
            sourceAmountToTrade,
            targetType: target.type,
            targetTypeName: localizeEstateResource(
              target.type,
              language,
              localization,
            ),
            targetAmountReceived,
          });
          src.amount -= sourceAmountToTrade;
          remainingTargetAmount = Math.max(
            0,
            remainingTargetAmount - targetAmountReceived,
          );
        }

        if (remainingTargetAmount > 0) {
          allMissingItemsCovered = false;
          break;
        }
      }

      if (allMissingItemsCovered) {
        canAffordViaExchange = true;
        recommendedExchanges.push(...proposedExchanges);
      }
    }

    // Farming regions
    const farmingRegionSet = new Set<string>();
    for (const item of missingItems) {
      const regions = priorityKnowledge.farmingRegionsByHeirloom[item.type] ?? [];
      for (const r of regions) farmingRegionSet.add(r);
    }
    const recommendedFarmingRegions = Array.from(farmingRegionSet);

    // Localized names
    const buildingName = localizeTownBuilding(
      buildingId,
      language,
      localization,
    );
    const treeName = localizeBuildingUpgradeTree(
      treeId,
      language,
      localization,
    );

    allRecommendations.push({
      buildingId,
      buildingName,
      treeId,
      treeName,
      nextCode,
      nextLevel,
      priorityTier,
      strategicImportance,
      isAffordable,
      costs,
      exchangePossibility: {
        canAffordViaExchange,
        recommendedExchanges,
      },
      recommendedFarmingRegions,
    });
  }

  // 3. Top Priorities (S & A Tiers)
  const topPriorities = allRecommendations
    .filter((r) => r.priorityTier === "S" || r.priorityTier === "A")
    .sort((a, b) => {
      const tierDiff = tierWeight[b.priorityTier] - tierWeight[a.priorityTier];
      if (tierDiff !== 0) return tierDiff;
      // Prefer affordable or closer to affordable
      if (a.isAffordable !== b.isAffordable) return a.isAffordable ? -1 : 1;
      return a.buildingId.localeCompare(b.buildingId);
    });

  // 4. Immediate Affordable Options (All tiers that can be purchased right now)
  const immediateAffordableOptions = allRecommendations
    .filter((r) => r.isAffordable)
    .sort((a, b) => {
      const tierDiff = tierWeight[b.priorityTier] - tierWeight[a.priorityTier];
      if (tierDiff !== 0) return tierDiff;
      return a.buildingId.localeCompare(b.buildingId);
    });

  // 5. Strategic Guidance
  const strategicGuidance = [
    "Prioritize Blacksmith (weapons/armor) and Guild (combat skills) as S-Tier to match hero level progression and prevent fatal party wipes.",
    "Upgrade Stage Coach network to at least 4 recruits weekly to maintain fresh roster depth.",
    "Avoid spending valuable heirlooms on Abbey/Tavern stress slots or Nomad Wagon in early-to-mid game.",
    "When key upgrades lack Deeds or Portraits, target their primary farming dungeons (Weald/Warrens) or utilize the Heirloom Exchange.",
  ];

  return {
    estateResources,
    topPriorities,
    immediateAffordableOptions,
    strategicGuidance,
  };
}
