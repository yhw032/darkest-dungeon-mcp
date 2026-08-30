export interface EstateResource {
  type: string;
  amount: number;
}

export interface InventoryItem {
  id: string;
  type: string;
  amount: number;
}

export interface Estate {
  version: number;
  resources: EstateResource[];
  trinkets: InventoryItem[];
  estateItems: InventoryItem[];
}
