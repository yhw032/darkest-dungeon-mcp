import type { Estate, EstateResource } from "../domain/estate.js";

export interface EstateResourcesSummary {
  version: number;
  resources: EstateResource[];
  trinkets: {
    stacks: number;
    totalAmount: number;
  };
  estateItems: {
    stacks: number;
    totalAmount: number;
  };
}

function totalAmount(items: Array<{ amount: number }>): number {
  return items.reduce((total, item) => total + item.amount, 0);
}

export function getEstateResources(estate: Estate): EstateResourcesSummary {
  return {
    version: estate.version,
    resources: estate.resources.map((resource) => ({ ...resource })),
    trinkets: {
      stacks: estate.trinkets.length,
      totalAmount: totalAmount(estate.trinkets),
    },
    estateItems: {
      stacks: estate.estateItems.length,
      totalAmount: totalAmount(estate.estateItems),
    },
  };
}
