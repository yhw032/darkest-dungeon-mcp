import { z } from "zod";

const finiteNumber = z.number().finite();
const count = z.number().int().nonnegative();
const nullableString = z.string().nullable();

export const heroSummarySchema = z.object({
  id: z.string().describe("Stable hero identifier used by get_hero."),
  name: z.string().describe("Hero's displayed name."),
  heroClass: z.string().describe("Internal Darkest Dungeon 1 class id."),
  resolveXp: finiteNumber.describe(
    "Raw resolve experience points. This is not the hero's resolve level.",
  ),
  stress: finiteNumber.describe("Current stress value."),
  rosterStatus: z
    .number()
    .int()
    .describe("Raw save roster status code; do not infer availability from this field alone."),
  currentHp: finiteNumber
    .nullable()
    .describe("Raw current_hp save value; null when absent. Do not assume its display unit."),
  resolveLevel: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .describe("Verified resolve level derived from game thresholds; null without game definitions."),
  availability: z.object({
    isAvailableForPartySelection: z.boolean(),
    reasons: z.array(
      z.enum([
        "already_selected_for_raid",
        "assigned_to_town_activity",
        "roster_status_unavailable",
      ]),
    ),
  }),
});

const questRewardItemSchema = z.object({
  id: z.string(),
  type: z.string(),
  amount: finiteNumber,
});

const questRewardSchema = z.object({
  resolveXp: finiteNumber,
  items: z.array(questRewardItemSchema),
});

export const questSummarySchema = z.object({
  id: z.string(),
  isPlotQuest: z.boolean(),
  type: z.string(),
  dungeon: z.string(),
  difficulty: z.number().int().nonnegative(),
  length: z.number().int().nonnegative(),
  reward: questRewardSchema,
});

export const questSchema = questSummarySchema.extend({
  saveKey: z.string(),
  mapName: z.string(),
  isFromTownEvent: z.boolean(),
  goalIds: z.array(z.string()),
});

const estateResourceSchema = z.object({
  type: z.string(),
  amount: finiteNumber,
});

const itemTotalsSchema = z.object({ stacks: count, totalAmount: finiteNumber });

export const gameStateSummarySchema = z.object({
  versions: z.object({
    roster: z.number().int(),
    estate: z.number().int(),
    town: z.number().int(),
    quests: z.number().int(),
    upgrades: z.number().int(),
  }),
  roster: z.object({
    totalHeroes: count,
    byClass: z.record(z.string(), count),
    byStatus: z.record(z.string(), count),
    stressThreshold: finiteNumber,
    highStressHeroes: z.array(heroSummarySchema),
  }),
  estate: z.object({
    resources: z.array(estateResourceSchema),
    trinkets: itemTotalsSchema,
    estateItems: itemTotalsSchema,
  }),
  town: z.object({
    buildings: count,
    activitySlots: count,
    occupiedActivitySlots: count,
    storeItemAmount: finiteNumber,
    availableRecruits: count,
    districts: count,
    builtDistricts: z.array(z.string()),
  }),
  quests: z.object({
    totalQuests: count,
    plotQuests: count,
    generatedQuests: count,
    byDungeon: z.record(z.string(), count),
  }),
  upgrades: z.object({ totalPurchases: count, purchased: count }),
});

const currencyCostSchema = z.object({ type: z.string(), amount: finiteNumber });
const upgradeRequirementSchema = z.object({
  code: z.string(),
  currencyCost: z.array(currencyCostSchema),
});

export const buildingUpgradeProgressSchema = z.object({
  treeId: z.string(),
  buildingId: z.string(),
  purchasedCodes: z.array(z.string()),
  purchasedCount: count,
  totalCount: count,
  highestPurchasedCode: nullableString,
  nextRequirement: upgradeRequirementSchema.nullable(),
  isComplete: z.boolean(),
});

const quirkEffectSchema = z.object({
  buffId: z.string(),
  statType: z.string(),
  statSubType: z.string(),
  amount: finiteNumber,
  ruleType: z.string(),
  isFalseRule: z.boolean(),
});
const localizedTextSchema = z.object({ english: nullableString, korean: nullableString });
const prioritySchema = z.enum(["critical", "high", "medium", "low"]);
const riskFactorSchema = z.enum([
  "forced_curio_interaction",
  "loot_loss",
  "resource_loss",
  "combat_penalty",
  "stress_penalty",
  "disease",
  "other",
]);

export const riskyHeroSchema = z.object({
  heroId: z.string(),
  heroName: z.string(),
  heroClass: z.string(),
  resolveXp: finiteNumber.describe("Raw resolve experience, not resolve level."),
  stress: finiteNumber,
  overallPriority: prioritySchema,
  riskyQuirks: z.array(
    z.object({
      id: z.string(),
      name: localizedTextSchema,
      description: localizedTextSchema,
      priority: prioritySchema,
      factors: z.array(riskFactorSchema),
      reasons: z.array(z.string()),
      notes: z.array(z.string()),
      isLocked: z.boolean(),
      isNew: z.boolean(),
      evolutionDurationRemaining: finiteNumber,
      effects: z.array(quirkEffectSchema),
      curioInteraction: z
        .object({ tag: z.string(), chance: finiteNumber, keepsLoot: z.boolean() })
        .nullable(),
      definitionFound: z.boolean(),
    }),
  ),
});

const quirkSchema = z.object({
  id: z.string(),
  isLocked: z.boolean(),
  isNew: z.boolean(),
  evolutionDurationRemaining: finiteNumber,
});
const trinketStackSchema = z.object({ id: z.string(), type: z.string(), amount: finiteNumber });
const skillSelectionSchema = z.object({ id: z.string(), rawSelectionValue: finiteNumber });
const combatSkillDetailSchema = z.object({
  id: z.string(),
  level: z.number().int().positive().nullable().describe("Verified one-based skill level, or null when game definitions are unavailable."),
  isSelected: z.boolean(),
  rawSelectionValue: finiteNumber.nullable().describe("Raw selection flag/value; never use as a skill level."),
  usableFromPartyPositions: z
    .array(z.number().int().min(1).max(4))
    .nullable()
    .describe("Party positions where this skill can be used; 1 is frontmost and 4 is rearmost. Null without game definitions."),
  target: z
    .object({
      side: z.enum(["enemy", "ally", "self"]),
      mode: z.enum(["single", "group", "random"]),
      positions: z
        .array(z.number().int().min(1).max(4))
        .describe("Target positions; 1 is frontmost and 4 is rearmost."),
    })
    .nullable(),
  movement: z
    .object({ backward: count, forward: count })
    .nullable()
    .describe("Positions moved after use; zeroes mean no movement, null means definitions unavailable."),
});
const combatPositionAnalysisSchema = z.object({
  status: z
    .enum(["complete", "partial", "unavailable"])
    .describe("Whether position definitions cover all, some, or none of the selected skills."),
  selectedSkillCount: count,
  definedSkillCount: count,
  positionNumbering: z.object({
    front: z.literal(1),
    back: z.literal(4),
  }),
  positionCoverage: z.array(
    z.object({
      partyPosition: z.number().int().min(1).max(4),
      usableSkillIds: z.array(z.string()),
      unusableSkillIds: z.array(z.string()),
      unknownSkillIds: z.array(z.string()),
    }),
  ),
  fullyUsablePartyPositions: z
    .array(z.number().int().min(1).max(4))
    .describe("Party positions where every selected skill is usable; empty unless analysis is complete."),
  bestCoveragePartyPositions: z
    .array(z.number().int().min(1).max(4))
    .describe("Party positions enabling the largest number of selected skills; not an editorial recommendation."),
});

export const heroDetailSchema = heroSummarySchema.extend({
  buildingName: nullableString,
  weaponRank: z.number().int(),
  armourRank: z.number().int(),
  afflictionId: nullableString,
  afflictionSeverity: finiteNumber,
  virtueId: nullableString,
  visitedDeathsDoor: z.boolean(),
  hasHadHeartAttack: z.boolean(),
  deathHeartAttackCompleted: z.boolean(),
  quirks: z.array(quirkSchema),
  equippedTrinkets: z.array(trinketStackSchema),
  combatSkills: z.array(z.string()),
  campingSkills: z.array(z.string()),
  combatSkillSelections: z.array(skillSelectionSchema),
  campingSkillSelections: z.array(skillSelectionSchema),
  combatSkillDetails: z.array(combatSkillDetailSchema),
  combatPositionAnalysis: combatPositionAnalysisSchema,
});

export const heroTownContextSchema = z.object({
  buildingName: nullableString,
  activityAssignments: z.array(
    z.object({
      buildingId: z.string(),
      activityId: z.string(),
      slotId: z.string(),
      visitsRemaining: finiteNumber,
      residentOccupied: finiteNumber,
      isSideEffectResult: z.boolean(),
    }),
  ),
});

export const trinketRecordSchema = z.object({
  id: z.string(),
  storageAmount: finiteNumber,
  equippedBy: z.array(z.object({ heroId: z.string(), heroName: z.string(), amount: finiteNumber })),
  storeListings: z.array(z.object({ buildingId: z.string(), storeId: z.string(), amount: finiteNumber })),
  storeAmount: finiteNumber,
});

export const curioRegionSchema = z.enum([
  "ruins", "warrens", "weald", "cove", "courtyard", "farmstead",
  "darkest_dungeon", "old_road", "hamlet",
]);
const availabilitySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("standard") }),
  z.object({ type: z.literal("quest"), questIds: z.array(z.string()) }),
]);
export const curioSummarySchema = z.object({
  id: z.string(),
  names: z.object({ en: z.string(), ko: z.string().optional() }),
  aliases: z.array(z.string()),
  regions: z.array(curioRegionSchema),
  dlcs: z.array(z.string()),
  availability: availabilitySchema,
});
const outcomeSchema = z.object({
  type: z.enum(["loot", "stress", "health", "quirk", "disease", "status", "buff", "combat", "nothing", "other"]),
  polarity: z.enum(["positive", "negative", "neutral", "mixed"]),
  description: z.string(),
  chancePercent: finiteNumber.optional(),
});
const interactionSchema = z.object({
  item: nullableString,
  recommendation: z.enum(["recommended", "situational", "avoid"]),
  certainty: z.enum(["guaranteed", "possible"]),
  outcomes: z.array(outcomeSchema),
  note: z.string().optional(),
});
const curioSchema = curioSummarySchema.extend({
  interactions: z.array(interactionSchema),
  notes: z.array(z.string()),
  sources: z.array(z.object({ title: z.string(), url: z.string(), verifiedAt: z.string() })),
});
export const curioAdviceSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("found"),
    curio: curioSchema,
    usableInteractions: z.array(interactionSchema),
    recommendedInteraction: interactionSchema.nullable(),
    warnings: z.array(z.string()),
  }),
  z.object({ status: z.literal("ambiguous"), query: z.string(), candidates: z.array(curioSummarySchema) }),
]);
