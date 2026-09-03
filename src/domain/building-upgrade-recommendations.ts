export type UpgradePriorityTier = "S" | "A" | "B" | "C";

export interface HeirloomCostStatus {
  type: string;
  typeName: string | null;
  current: number;
  required: number;
  missing: number;
}

export interface HeirloomExchangeOpportunity {
  sourceType: string;
  sourceTypeName: string | null;
  sourceAmountToTrade: number;
  targetType: string;
  targetTypeName: string | null;
  targetAmountReceived: number;
}

export interface BuildingUpgradeRecommendation {
  buildingId: string;
  buildingName: string | null;
  treeId: string;
  treeName: string | null;
  nextCode: string;
  nextLevel: number;
  priorityTier: UpgradePriorityTier;
  strategicImportance: string;
  isAffordable: boolean;
  costs: HeirloomCostStatus[];
  exchangePossibility: {
    canAffordViaExchange: boolean;
    recommendedExchanges: HeirloomExchangeOpportunity[];
  };
  recommendedFarmingRegions: string[];
}

export interface BuildingUpgradePlanResult {
  estateResources: Array<{ type: string; name: string | null; amount: number }>;
  topPriorities: BuildingUpgradeRecommendation[];
  immediateAffordableOptions: BuildingUpgradeRecommendation[];
  strategicGuidance: string[];
}

export interface TreePriorityConfig {
  buildingId: string;
  treeId: string;
  priorityTier: UpgradePriorityTier;
  strategicImportance: string;
}

export interface BuildingUpgradePriorityKnowledge {
  schemaVersion: 1;
  farmingRegionsByHeirloom: Record<string, string[]>;
  treePriorities: TreePriorityConfig[];
}
