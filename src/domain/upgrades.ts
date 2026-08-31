export interface UpgradePurchase {
  id: string;
  instanceNumber: number;
  treeId: number;
  requirementCode: string;
  isPurchased: boolean;
}

export interface UpgradeState {
  version: number;
  purchases: UpgradePurchase[];
}
