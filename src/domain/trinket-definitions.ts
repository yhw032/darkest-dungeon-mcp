export interface TrinketBuffEffect {
  buffId: string;
  statType: string;
  statSubType: string;
  amount: number;
  ruleType: string;
  isFalseRule: boolean;
}

export interface TrinketDefinition {
  id: string;
  rarity: string;
  price: number | null;
  shardPrice: number | null;
  limit: number;
  heroClassRequirements: string[];
  originDungeon: string | null;
  effects: TrinketBuffEffect[];
  unresolvedBuffIds: string[];
}
