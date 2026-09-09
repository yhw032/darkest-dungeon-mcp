import { z } from "zod";

const finiteNumber = z.number().finite();
const count = z.number().int().nonnegative();
const nullableString = z.string().nullable();

const classKnowledgeSourceSchema = z.object({
  title: z.string(),
  url: z.string(),
  verifiedAt: z.string(),
});
export const classKnowledgeSchema = z.object({
  id: z.string(),
  name: nullableString,
  dlcs: z.array(z.string()),
  summary: z.string(),
  roles: z.array(z.string()),
  strengths: z.array(z.string()),
  limitations: z.array(z.string()),
  positionGuidance: z.array(
    z.object({
      positions: z.array(z.number().int().min(1).max(4)),
      recommendation: z.enum([
        "preferred",
        "viable",
        "situational",
        "avoid",
      ]),
      reason: z.string(),
    }),
  ),
  mechanics: z.array(z.object({ id: z.string(), description: z.string() })),
  skillGuidance: z.array(
    z.object({
      skillId: z.string(),
      name: nullableString,
      useCases: z.array(z.string()),
      synergies: z.array(z.string()),
      cautions: z.array(z.string()),
    }),
  ),
  partySynergies: z.array(
    z.object({
      heroClassId: z.string(),
      heroClassName: nullableString,
      reasons: z.array(z.string()),
    }),
  ),
  sources: z.array(classKnowledgeSourceSchema),
});
export const questEligibilitySchema = z.object({
  questId: z.string(),
  questDifficulty: z.number().int().nonnegative(),
  status: z.enum(["eligible", "ineligible", "unknown"]),
  isEligible: z.boolean().nullable(),
  maximumResolveLevel: z.number().int().nonnegative().nullable(),
  reason: z
    .enum([
      "resolve_level_too_high",
      "resolve_level_unavailable",
      "restriction_rules_unavailable",
      "quest_difficulty_undefined",
    ])
    .nullable(),
});

export const heroSummarySchema = z.object({
  id: z.string().describe("Stable hero identifier used by get_hero."),
  name: z.string().describe("Hero's displayed name."),
  heroClass: z.string().describe("Internal Darkest Dungeon 1 class id."),
  heroClassName: nullableString
    .describe(
      "Official class name in the requested language; null without game localization.",
    )
    .optional(),
  resolveXp: finiteNumber.describe(
    "Raw resolve experience points. This is not the hero's resolve level.",
  ),
  stress: finiteNumber.describe("Current stress value."),
  rosterStatus: z
    .number()
    .int()
    .describe("Raw save roster status code; do not infer availability from this field alone."),
  rosterState: z
    .enum(["active", "deceased", "unknown"])
    .describe("Verified lifecycle classification. Deceased heroes are excluded from list_heroes by default."),
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
  questEligibility: questEligibilitySchema
    .nullable()
    .describe("Eligibility for the requested quest; null when no questId was supplied."),
});

export const heroAvailabilitySchema = heroSummarySchema.shape.availability;

const questRewardItemSchema = z.object({
  id: z.string(),
  type: z.string(),
  amount: finiteNumber,
  name: nullableString.describe(
    "Official reward name in the requested language; null when unavailable.",
  ),
});

const questRewardSchema = z.object({
  resolveXp: finiteNumber,
  items: z.array(questRewardItemSchema),
});

export const questSummarySchema = z.object({
  id: z.string(),
  title: nullableString.describe(
    "Official quest title in the requested language.",
  ),
  description: nullableString.describe(
    "Official quest objective description in the requested language.",
  ),
  isPlotQuest: z.boolean(),
  type: z.string(),
  dungeon: z.object({
    id: z.string().describe("Stable dungeon id from the save."),
    name: z.string().nullable().describe(
      "Dungeon display name in the requested language; null when no verified mapping exists.",
    ),
  }),
  difficulty: z.number().int().nonnegative(),
  length: z.object({
    value: z.number().int().nonnegative().describe("Raw quest length value."),
    name: nullableString.describe(
      "Official quest length label in the requested language.",
    ),
  }),
  goalIds: z.array(z.string()).describe(
    "Stable internal goal identifiers; use title and description for display.",
  ),
  reward: questRewardSchema,
});

export const questSchema = questSummarySchema.extend({
  saveKey: z.string(),
  mapName: z.string(),
  isFromTownEvent: z.boolean(),
});

const estateResourceSchema = z.object({
  type: z.string(),
  name: nullableString
    .describe(
      "Official resource name in the requested language; null without game localization.",
    )
    .optional(),
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
    activeHeroes: count.describe("Current barracks heroes; excludes deceased records."),
    deceasedHeroes: count.describe("Historical hero records verified as deceased."),
    unknownStateHeroes: count.describe("Records whose raw roster status is not yet classified."),
    totalHeroRecords: count.describe("All save records, including deceased and unknown-state records."),
    byClass: z.record(z.string(), count).describe("Class counts for active heroes only."),
    byClassDetails: z
      .array(
        z.object({
          id: z.string(),
          name: nullableString,
          count: count,
        }),
      )
      .optional()
      .describe("Class counts with official localized class names."),
    byStatus: z.record(z.string(), count).describe("Counts of all records by raw roster status."),
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
    stagecoachRecruitCount: count.describe(
      "Number of generated Stage Coach recruit candidates; does not account for barracks capacity.",
    ),
    districts: count,
    builtDistricts: z.array(z.string()),
    builtDistrictDetails: z.array(
      z.object({ id: z.string(), name: nullableString }),
    ),
  }),
  quests: z.object({
    totalQuests: count,
    plotQuests: count,
    generatedQuests: count,
    byDungeon: z.record(z.string(), count),
    byDungeonDetails: z
      .array(
        z.object({
          id: z.string(),
          name: nullableString,
          count: count,
        }),
      )
      .optional()
      .describe("Quest counts by dungeon with official localized dungeon names."),
  }),
  upgrades: z.object({ totalPurchases: count, purchased: count }),
});

const currencyCostSchema = z.object({
  type: z.string(),
  name: nullableString,
  amount: finiteNumber,
});
const upgradeRequirementSchema = z.object({
  code: z.string(),
  currencyCost: z.array(currencyCostSchema),
});

export const buildingUpgradeProgressSchema = z.object({
  treeId: z.string(),
  treeName: nullableString,
  buildingId: z.string(),
  buildingName: nullableString,
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
const positiveValueFactorSchema = z.enum([
  "accuracy",
  "critical",
  "damage",
  "durability",
  "healing",
  "resistance",
  "scouting",
  "speed",
  "stress_control",
  "town",
  "other",
]);
const quirkSourceSchema = z.object({
  kind: z.enum(["game", "wiki", "community"]),
  title: z.string(),
  reference: z.string(),
  verifiedAt: z.string(),
});

const riskyQuirkSchema = z.object({
  id: z.string(),
  name: nullableString,
  description: nullableString,
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
});

export const riskyHeroSchema = z.object({
  heroId: z.string(),
  heroName: z.string(),
  heroClass: z.string(),
  heroClassName: nullableString,
  resolveXp: finiteNumber.describe("Raw resolve experience, not resolve level."),
  stress: finiteNumber,
  overallPriority: prioritySchema,
  riskyQuirks: z.array(riskyQuirkSchema),
});

export const quirkManagementHeroSchema = z.object({
  heroId: z.string(),
  heroName: z.string(),
  heroClass: z.string(),
  heroClassName: nullableString,
  resolveXp: finiteNumber.describe("Raw resolve experience, not resolve level."),
  stress: finiteNumber,
  overallPriority: prioritySchema.nullable(),
  positiveLockSlots: z.object({
    used: count,
    maximum: count,
    remaining: count,
    definitionCoverageComplete: z.boolean(),
  }),
  negativeRemovals: z.array(riskyQuirkSchema),
  positiveQuirks: z.array(
    z.object({
      id: z.string(),
      name: nullableString,
      description: nullableString,
      recommendedAction: z.enum([
        "lock_positive",
        "keep_locked",
        "do_not_prioritize",
        "unrated",
      ]),
      priority: prioritySchema.nullable(),
      factors: z.array(positiveValueFactorSchema),
      applicability: z
        .enum(["universal", "hero_class", "build", "region", "conditional"])
        .nullable(),
      heroClasses: z.array(z.string()),
      reasons: z.array(z.string()),
      notes: z.array(z.string()),
      cautions: z.array(z.string()),
      sources: z.array(quirkSourceSchema),
      isLocked: z.boolean(),
      isNew: z.boolean(),
      evolutionDurationRemaining: finiteNumber,
      canBeReplacedByNewQuirk: z.boolean().nullable(),
      effects: z.array(quirkEffectSchema),
      definitionFound: z.boolean(),
    }),
  ),
});

const quirkSchema = z.object({
  id: z.string(),
  name: nullableString
    .describe(
      "Official quirk or disease name in the requested language; null without game localization.",
    )
    .optional(),
  isLocked: z.boolean(),
  isNew: z.boolean(),
  evolutionDurationRemaining: finiteNumber,
});

export const trinketEffectSchema = z.object({
  buffId: z.string(),
  statType: z.string(),
  statSubType: z.string(),
  amount: finiteNumber,
  ruleType: z.string(),
  isFalseRule: z.boolean(),
});

const trinketStackSchema = z.object({
  id: z.string(),
  type: z.string(),
  amount: finiteNumber,
  name: nullableString
    .describe(
      "Official trinket name in the requested language; null without game localization.",
    )
    .optional(),
  rarity: nullableString.optional(),
  heroClassRequirements: z
    .array(z.string())
    .optional()
    .describe("Hero classes allowed to equip this trinket; empty array means any class can equip."),
  isUsableByHeroClass: z
    .boolean()
    .optional()
    .describe("Whether the equipping hero class satisfies trinket class requirements; true if unrestricted."),
  effects: z.array(trinketEffectSchema).optional(),
});
const skillSelectionSchema = z.object({ id: z.string(), rawSelectionValue: finiteNumber });
export const combatSkillDetailSchema = z.object({
  id: z.string(),
  name: nullableString
    .describe(
      "Official combat skill name in the requested language; null without game localization.",
    )
    .optional(),
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
export const combatPositionAnalysisSchema = z.object({
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

export const campingSkillDetailSchema = z.object({
  id: z.string(),
  name: nullableString,
  cost: z.number(),
  preventsNightAmbush: z.boolean(),
  curesDisease: z.boolean(),
  primaryCategory: z.enum([
    "ambush_prevention",
    "buff",
    "stress_heal",
    "heal",
    "utility",
  ]),
});

export const heroDetailSchema = heroSummarySchema.extend({
  buildingId: nullableString,
  buildingName: nullableString,
  weaponRank: z.number().int(),
  armourRank: z.number().int(),
  afflictionId: nullableString,
  afflictionName: nullableString
    .describe(
      "Official affliction name in the requested language; null if not afflicted or without game localization.",
    )
    .optional(),
  afflictionSeverity: finiteNumber,
  virtueId: nullableString,
  virtueName: nullableString
    .describe(
      "Official virtue name in the requested language; null if not virtuous or without game localization.",
    )
    .optional(),
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
  campingSkillDetails: z.array(campingSkillDetailSchema).optional(),
  combatPositionAnalysis: combatPositionAnalysisSchema,
});

export const heroComparisonSchema = z.object({
  heroes: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      heroClass: z.string(),
      heroClassName: nullableString,
      rosterState: z
        .enum(["active", "deceased", "unknown"])
        .describe("Lifecycle state; only active heroes are included in comparison highlights."),
      resolveXp: finiteNumber.describe("Raw resolve experience, not resolve level."),
      resolveLevel: z.number().int().nonnegative().nullable(),
      stress: finiteNumber,
      availability: heroAvailabilitySchema,
      questEligibility: questEligibilitySchema.nullable(),
      equipment: z.object({
        weaponRank: z.number().int(),
        armourRank: z.number().int(),
      }),
      selectedCombatSkills: z.array(combatSkillDetailSchema),
      combatPositionAnalysis: combatPositionAnalysisSchema,
      quirkTreatmentAnalysis: z.object({
        status: z.enum(["available", "unavailable"]),
        risk: z
          .object({
            overallPriority: z.enum(["critical", "high", "medium", "low"]),
            riskyQuirkIds: z.array(z.string()),
            riskyQuirks: z.array(
              z.object({
                id: z.string(),
                name: nullableString.describe(
                  "Official quirk name in the requested language; null without game localization.",
                ),
              }),
            ),
          })
          .nullable()
          .describe("Curated treatment risk; null means no curated match only when status is available."),
      }),
    }),
  ),
  highlights: z.object({
    availableHeroIds: z.array(z.string()),
    questEligibleHeroIds: z.array(z.string()).nullable(),
    lowestStressHeroIds: z.array(z.string()),
    highestResolveLevelHeroIds: z.array(z.string()),
    highestWeaponRankHeroIds: z.array(z.string()),
    highestArmourRankHeroIds: z.array(z.string()),
  }),
});

export const heroTownContextSchema = z.object({
  buildingId: nullableString,
  buildingName: nullableString,
  activityAssignments: z.array(
    z.object({
      buildingId: z.string(),
      buildingName: nullableString,
      activityId: z.string(),
      activityName: nullableString,
      slotId: z.string(),
      visitsRemaining: finiteNumber,
      residentOccupied: finiteNumber,
      isSideEffectResult: z.boolean(),
    }),
  ),
});

export const trinketRecordSchema = z.object({
  id: z.string(),
  name: nullableString,
  rarity: nullableString
    .describe(
      "Official trinket rarity (e.g. common, rare, very_rare, ancestral); null when game definitions are unavailable.",
    )
    .optional(),
  price: finiteNumber.nullable().optional(),
  limit: finiteNumber.nullable().optional(),
  originDungeon: nullableString.optional(),
  heroClassRequirements: z
    .array(z.string())
    .optional()
    .describe(
      "Hero classes allowed to equip this trinket; empty array means unrestricted.",
    ),
  heroClassRequirementNames: z
    .array(
      z.object({
        id: z.string(),
        name: nullableString,
      }),
    )
    .optional()
    .describe("Localized class names for hero class requirements."),
  effects: z
    .array(trinketEffectSchema)
    .optional()
    .describe("Stat buff and debuff effects applied by this trinket."),
  storageAmount: finiteNumber,
  equippedBy: z.array(z.object({ heroId: z.string(), heroName: z.string(), amount: finiteNumber })),
  storeListings: z.array(z.object({
    buildingId: z.string(),
    buildingName: nullableString,
    storeId: z.string(),
    amount: finiteNumber,
  })),
  storeAmount: finiteNumber,
});

export const curioRegionSchema = z.enum([
  "ruins", "warrens", "weald", "cove", "courtyard", "farmstead",
  "darkest_dungeon", "old_road", "hamlet",
]);
export const combatRegionSchema = z.enum([
  "ruins", "warrens", "weald", "cove", "courtyard", "farmstead",
  "darkest_dungeon",
]);
export const combatThreatSchema = z.enum([
  "health_damage", "stress", "bleed", "blight", "disease", "stun",
  "mark", "debuff", "movement", "guard", "summon", "stealth",
  "healing", "other",
]);
export const enemyPrioritySchema = z.enum([
  "low", "medium", "high", "critical",
]);
const combatSourceSchema = z.object({
  title: z.string(),
  url: z.string(),
  verifiedAt: z.string(),
});
export const regionThreatSchema = z.object({
  id: z.string(),
  type: combatThreatSchema,
  description: z.string(),
  counters: z.array(z.string()),
});
export const regionResistanceSchema = z.object({
  effect: z.enum(["bleed", "blight", "stun", "debuff", "move"]),
  tendency: z.enum(["low", "mixed", "high"]),
  note: z.string(),
});
export const regionCombatKnowledgeSchema = z.object({
  id: combatRegionSchema,
  name: nullableString,
  dlcs: z.array(z.string()),
  overview: z.string(),
  commonThreats: z.array(regionThreatSchema),
  resistanceTendencies: z.array(regionResistanceSchema),
  recommendedCapabilities: z.array(z.string()),
  cautions: z.array(z.string()),
  sources: z.array(combatSourceSchema),
});
export const enemyCombatKnowledgeSchema = z.object({
  id: z.string(),
  enemyType: z.enum(["common", "elite", "miniboss", "boss"]),
  name: nullableString,
  regions: z.array(combatRegionSchema),
  dlcs: z.array(z.string()),
  priority: enemyPrioritySchema,
  priorityReasons: z.array(z.string()),
  traits: z.array(z.string()),
  dangerousActions: z.array(z.object({
    id: z.string(),
    name: nullableString,
    threats: z.array(combatThreatSchema),
    description: z.string(),
    counters: z.array(z.string()),
  })),
  effectiveResponses: z.array(z.string()),
  cautions: z.array(z.string()),
  sources: z.array(combatSourceSchema),
});
const availabilitySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("standard") }),
  z.object({ type: z.literal("quest"), questIds: z.array(z.string()) }),
]);
export const curioSummarySchema = z.object({
  id: z.string(),
  name: nullableString.describe(
    "Official curio name in the requested language; null when unavailable.",
  ),
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

export const trinketTierSchema = z.enum(["S", "A", "B", "situational", "trap"]);

export const trinketOwnershipStatusSchema = z.enum([
  "in_storage",
  "equipped_by_self",
  "equipped_by_other",
  "in_store",
  "not_owned",
]);

export const recommendedTrinketItemSchema = z.object({
  trinketId: z.string(),
  trinketName: nullableString,
  tier: trinketTierSchema,
  rarity: nullableString.optional(),
  heroClassRequirements: z.array(z.string()).optional(),
  heroClassRequirementNames: z
    .array(z.object({ id: z.string(), name: nullableString }))
    .optional(),
  effects: z.array(trinketEffectSchema).optional(),
  ownership: z.object({
    isOwned: z.boolean(),
    isAvailableForPurchase: z.boolean().describe(
      "Whether the trinket is currently listed in a town store; purchasing is not performed by this read-only server.",
    ),
    status: trinketOwnershipStatusSchema,
    storageAmount: finiteNumber,
    equippedBy: z.array(
      z.object({
        heroId: z.string(),
        heroName: z.string(),
        amount: finiteNumber,
      }),
    ),
    storeListings: z.array(
      z.object({
        buildingId: z.string(),
        buildingName: nullableString,
        storeId: z.string(),
        amount: finiteNumber,
      }),
    ),
  }),
  recommendedRoles: z.array(z.string()),
  synergies: z.array(z.string()),
  cautions: z.array(z.string()),
  playstyleAdvice: z.string(),
  matchReason: z.string(),
});

export const candidateHeroRecommendationSchema = z.object({
  heroId: z.string(),
  heroName: z.string(),
  heroClass: z.string(),
  heroClassName: nullableString,
  resolveLevel: finiteNumber.nullable(),
  stress: finiteNumber,
  availability: heroAvailabilitySchema,
  isCurrentlyEquipped: z.boolean(),
  suitabilityReason: z.string(),
});

export const recommendTrinketsOutputSchema = z.object({
  heroContext: z
    .object({
      heroId: z.string(),
      heroName: z.string(),
      heroClass: z.string(),
      heroClassName: nullableString,
      equippedTrinkets: z.array(
        z.object({
          id: z.string(),
          name: nullableString,
        }),
      ),
    })
    .nullable()
    .optional(),
  trinketContext: z
    .object({
      trinketId: z.string(),
      trinketName: nullableString,
      tier: trinketTierSchema,
      recommendedRoles: z.array(z.string()),
      recommendedClasses: z.array(z.string()),
      synergies: z.array(z.string()),
      cautions: z.array(z.string()),
      playstyleAdvice: z.string(),
    })
    .nullable()
    .optional(),
  recommendations: z.array(recommendedTrinketItemSchema),
  candidateHeroes: z.array(candidateHeroRecommendationSchema).optional(),
});

export const expeditionProvisionItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  amount: z.number(),
  costPerUnit: z.number(),
  totalCost: z.number(),
  purpose: z.string(),
});

export const expeditionProvisionEstimateSchema = z.object({
  items: z.array(expeditionProvisionItemSchema),
  totalEstimatedCost: z.number(),
  notes: z.array(z.string()),
});

export const expeditionHeroCandidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  heroClass: z.string(),
  heroClassName: nullableString,
  resolveLevel: finiteNumber.nullable(),
  stress: z.number(),
  roleScore: z.number().describe(
    "Relative score within this role pool, derived from curated class roles, resolve level, stress, risky quirks, and user preference.",
  ),
  suitabilityReasons: z.array(z.string()).describe(
    "Curated class-role and position evidence supporting inclusion in this pool.",
  ),
  cautions: z.array(z.string()),
  recommendedTrinketIds: z.array(z.string()).describe(
    "Owned S/A-tier trinkets whose curated class recommendations and official equip restrictions match this hero.",
  ),
  isPreferred: z.boolean(),
});

export const expeditionRolePoolSchema = z.object({
  frontlineDps: z.array(expeditionHeroCandidateSchema),
  controlDisruptor: z.array(expeditionHeroCandidateSchema),
  supportStressHealer: z.array(expeditionHeroCandidateSchema),
  primaryHealer: z.array(expeditionHeroCandidateSchema),
});

export const ineligibleHeroSchema = z.object({
  id: z.string(),
  name: z.string(),
  heroClass: z.string(),
  heroClassName: nullableString,
  resolveLevel: finiteNumber.nullable(),
  stress: z.number(),
  reasons: z.array(z.string()),
});

export const expeditionQuestContextSchema = z.object({
  id: z.string(),
  dungeon: z.string(),
  dungeonName: nullableString,
  difficulty: z.number(),
  length: z.number(),
  questName: nullableString,
  questDescription: nullableString,
  isPlotQuest: z.boolean(),
  goalIds: z.array(z.string()),
  bossGuidance: enemyCombatKnowledgeSchema.nullable(),
  regionOverview: nullableString,
  regionCommonThreats: z.array(regionThreatSchema),
  regionResistanceTendencies: z.array(regionResistanceSchema),
  regionRecommendedCapabilities: z.array(z.string()),
  regionCautions: z.array(z.string()),
});

export const ambushPreventionProviderSchema = z.object({
  heroId: z.string(),
  heroName: z.string(),
  skillId: z.string(),
  skillName: nullableString,
  cost: z.number(),
});

export const keyCampingBuffProviderSchema = z.object({
  heroId: z.string(),
  heroName: z.string(),
  skillId: z.string(),
  skillName: nullableString,
  cost: z.number(),
  category: z.enum([
    "ambush_prevention",
    "buff",
    "stress_heal",
    "heal",
    "utility",
  ]),
});

export const expeditionCampingStrategySchema = z.object({
  hasCamping: z.boolean(),
  firewoodCount: z.number(),
  ambushPrevention: z.object({
    isAvailable: z.boolean(),
    providers: z.array(ambushPreventionProviderSchema),
    warning: nullableString,
  }),
  keyCampingSkills: z.array(keyCampingBuffProviderSchema),
  respitePointPlan: z.array(z.string()),
});

export const planExpeditionOutputSchema = z.object({
  quest: expeditionQuestContextSchema,
  rolePool: expeditionRolePoolSchema,
  ineligibleHeroes: z.array(ineligibleHeroSchema),
  unverifiedHeroes: z.array(ineligibleHeroSchema).describe(
    "Otherwise available heroes whose quest eligibility could not be verified; they are excluded from role pools.",
  ),
  provisions: expeditionProvisionEstimateSchema,
  campingStrategy: expeditionCampingStrategySchema,
  tacticalAdvice: z.array(z.string()),
});

export const heirloomCostStatusSchema = z.object({
  type: z.string(),
  typeName: nullableString,
  current: z.number(),
  required: z.number(),
  missing: z.number(),
});

export const heirloomExchangeOpportunitySchema = z.object({
  sourceType: z.string(),
  sourceTypeName: nullableString,
  sourceAmountToTrade: z.number(),
  targetType: z.string(),
  targetTypeName: nullableString,
  targetAmountReceived: z.number(),
});

export const buildingUpgradeRecommendationSchema = z.object({
  buildingId: z.string(),
  buildingName: nullableString,
  treeId: z.string(),
  treeName: nullableString,
  nextCode: z.string(),
  nextLevel: z.number(),
  priorityTier: z.enum(["S", "A", "B", "C"]),
  strategicImportance: z.string(),
  isAffordable: z.boolean(),
  costs: z.array(heirloomCostStatusSchema),
  exchangePossibility: z.object({
    canAffordViaExchange: z.boolean(),
    recommendedExchanges: z.array(heirloomExchangeOpportunitySchema),
  }),
  recommendedFarmingRegions: z.array(z.string()),
});

export const recommendBuildingUpgradesOutputSchema = z.object({
  estateResources: z.array(
    z.object({
      type: z.string(),
      name: nullableString,
      amount: z.number(),
    }),
  ),
  topPriorities: z.array(buildingUpgradeRecommendationSchema),
  immediateAffordableOptions: z.array(buildingUpgradeRecommendationSchema),
  strategicGuidance: z.array(z.string()),
});
