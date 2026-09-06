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
import type { GameLanguage, GameLocalization } from "../localization/game-localization.js";
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

function getLocalized(
  localization: GameLocalization | undefined,
  language: GameLanguage,
  key: string,
): string | null {
  if (!localization) return null;
  const langKey = language === "ko" ? "koreana" : "english";
  return localization.get(langKey)?.get(key) ?? null;
}

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
    name: getLocalized(localization, language, `str_inventory_title_estate_currency${res.type}`) ?? res.type,
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
    let totalMissingPoints = 0;
    const missingItems: Array<{ type: string; missing: number }> = [];
    const requiredTypes = new Set<string>();

    for (const cost of progress.nextRequirement.currencyCost) {
      requiredTypes.add(cost.type);
      const current = resourceMap.get(cost.type) ?? 0;
      const required = cost.amount;
      const missing = Math.max(0, required - current);
      if (missing > 0) {
        isAffordable = false;
        const rate = heirloomExchangeRates[cost.type] ?? 1.0;
        totalMissingPoints += missing * rate;
        missingItems.push({ type: cost.type, missing });
      }

      costs.push({
        type: cost.type,
        typeName:
          getLocalized(localization, language, `str_inventory_title_estate_currency${cost.type}`) ??
          cost.type,
        current,
        required,
        missing,
      });
    }

    // Exchange simulation
    const recommendedExchanges: HeirloomExchangeOpportunity[] = [];
    let canAffordViaExchange = false;

    if (!isAffordable && totalMissingPoints > 0) {
      // Find surplus heirlooms among currencies not required or exceeding requirement
      let availableSurplusPoints = 0;
      const surplusSources: Array<{ type: string; amount: number; rate: number }> = [];

      for (const [type, amount] of resourceMap.entries()) {
        if (!heirloomExchangeRates[type]) continue;
        const reqCost = progress.nextRequirement.currencyCost.find((c) => c.type === type);
        const reqAmount = reqCost ? reqCost.amount : 0;
        const surplus = Math.max(0, amount - reqAmount);
        if (surplus > 0) {
          const rate = heirloomExchangeRates[type]!;
          availableSurplusPoints += surplus * rate;
          surplusSources.push({ type, amount: surplus, rate });
        }
      }

      if (availableSurplusPoints >= totalMissingPoints) {
        canAffordViaExchange = true;
        surplusSources.sort((a, b) => b.rate - a.rate);

        // Propose trade path for first missing item
        let neededPoints = totalMissingPoints;
        for (const src of surplusSources) {
          if (neededPoints <= 0) break;
          const target = missingItems[0];
          if (!target) break;
          const targetRate = heirloomExchangeRates[target.type] ?? 1.0;
          const srcPointsTotal = src.amount * src.rate;

          if (srcPointsTotal >= neededPoints) {
            const srcTradeAmount = Math.ceil(neededPoints / src.rate);
            const targetTradeAmount = Math.floor((srcTradeAmount * src.rate) / targetRate);
            recommendedExchanges.push({
              sourceType: src.type,
              sourceTypeName:
                getLocalized(localization, language, `str_inventory_title_estate_currency${src.type}`) ??
                src.type,
              sourceAmountToTrade: srcTradeAmount,
              targetType: target.type,
              targetTypeName:
                getLocalized(localization, language, `str_inventory_title_estate_currency${target.type}`) ??
                target.type,
              targetAmountReceived: targetTradeAmount,
            });
            neededPoints = 0;
          } else {
            const srcTradeAmount = src.amount;
            const targetTradeAmount = Math.floor((srcTradeAmount * src.rate) / targetRate);
            recommendedExchanges.push({
              sourceType: src.type,
              sourceTypeName:
                getLocalized(localization, language, `str_inventory_title_estate_currency${src.type}`) ??
                src.type,
              sourceAmountToTrade: srcTradeAmount,
              targetType: target.type,
              targetTypeName:
                getLocalized(localization, language, `str_inventory_title_estate_currency${target.type}`) ??
                target.type,
              targetAmountReceived: targetTradeAmount,
            });
            neededPoints -= srcPointsTotal;
          }
        }
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
    const buildingName =
      getLocalized(localization, language, `town_building_name_${buildingId}`) ??
      buildingId;
    const treeName =
      getLocalized(localization, language, `upgrade_tree_name_${buildingId}_${treeId}`) ??
      getLocalized(localization, language, `upgrade_tree_name_${treeId}`) ??
      treeId;

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
