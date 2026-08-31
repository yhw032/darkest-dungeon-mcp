export interface UpgradeCurrencyCost {
  type: string;
  amount: number;
}

export interface BuildingUpgradeRequirement {
  code: string;
  currencyCost: UpgradeCurrencyCost[];
}

export interface BuildingUpgradeTree {
  id: string;
  hash: number;
  buildingId: string;
  requirements: BuildingUpgradeRequirement[];
}

export interface BuildingUpgradeProgress {
  treeId: string;
  buildingId: string;
  purchasedCodes: string[];
  purchasedCount: number;
  totalCount: number;
  highestPurchasedCode: string | null;
  nextRequirement: BuildingUpgradeRequirement | null;
  isComplete: boolean;
}
