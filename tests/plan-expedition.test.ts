import assert from "node:assert/strict";
import test from "node:test";

import type { CombatKnowledgeBase } from "../src/domain/combat-knowledge.js";
import type { ClassKnowledgeBase } from "../src/domain/class-knowledge.js";
import type { GameState } from "../src/domain/game-state.js";
import type { Hero } from "../src/domain/hero.js";
import type { HeroProgressionRules } from "../src/domain/hero-progression.js";
import type { Quest } from "../src/domain/quest.js";
import type { QuestRestrictionRules } from "../src/domain/quest-restrictions.js";
import type { TrinketGuidanceKnowledgeBase } from "../src/domain/trinket-guidance.js";
import { planExpedition } from "../src/queries/plan-expedition.js";

function makeHero(
  id: string,
  name: string,
  heroClass: string,
  resolveXp: number,
  stress = 0,
  buildingName: string | null = null,
): Hero {
  return {
    id,
    name,
    heroClass,
    resolveXp,
    stress,
    rosterStatus: 0,
    buildingName,
    currentHp: 30,
    weaponRank: 1,
    armourRank: 1,
    afflictionId: null,
    afflictionSeverity: 0,
    virtueId: null,
    visitedDeathsDoor: false,
    hasHadHeartAttack: false,
    deathHeartAttackCompleted: false,
    quirks: [],
    equippedTrinkets: [],
    combatSkills: [],
    campingSkills: [],
    combatSkillSelections: [],
    campingSkillSelections: [],
  };
}

function makeQuest(
  id: string,
  dungeon: string,
  difficulty: number,
  length: number,
  goalIds: string[] = [],
): Quest {
  return {
    saveKey: id,
    id,
    mapName: dungeon,
    isPlotQuest: goalIds.length > 0,
    isFromTownEvent: false,
    type: "explore",
    dungeon,
    difficulty,
    length,
    goalIds,
    reward: { resolveXp: 2, items: [] },
  };
}

const mockCombatKnowledge: CombatKnowledgeBase = {
  schemaVersion: 2,
  regions: [
    {
      id: "ruins",
      dlcs: [],
      overview: "Ruins dominated by Unholy skeletons.",
      commonThreats: [
        {
          id: "backline_stress",
          type: "stress",
          description: "Courtiers apply high stress.",
          counters: ["Stun", "Backline reach"],
        },
      ],
      resistanceTendencies: [
        { effect: "bleed", tendency: "high", note: "Skeletons resist bleed." },
        { effect: "blight", tendency: "low", note: "Skeletons weak to blight." },
      ],
      recommendedCapabilities: ["Blight", "Stun"],
      cautions: ["Avoid bleed builds"],
      sources: [{ title: "Wiki", url: "https://example.com", verifiedAt: "2026-09-01" }],
    },
    {
      id: "cove",
      dlcs: [],
      overview: "Cove dominated by Eldritch fishmen with high bleed and protection.",
      commonThreats: [],
      resistanceTendencies: [],
      recommendedCapabilities: [],
      cautions: [],
      sources: [{ title: "Wiki", url: "https://example.com", verifiedAt: "2026-09-01" }],
    },
  ],
  enemies: [
    {
      id: "necromancer",
      enemyType: "boss",
      localizationId: "str_monstername_necromancer_A",
      aliases: ["Necromancer Apprentice", "강령술사"],
      regions: ["ruins"],
      dlcs: [],
      priority: "critical",
      priorityReasons: ["Summons skeletons repeatedly."],
      traits: ["Unholy"],
      dangerousActions: [],
      effectiveResponses: ["Focus burst damage directly on the Necromancer."],
      cautions: [],
      sources: [{ title: "Wiki", url: "https://example.com", verifiedAt: "2026-09-01" }],
    },
  ],
};

const mockClassKnowledge: ClassKnowledgeBase = {
  schemaVersion: 2,
  classes: [
    { id: "crusader", roles: ["damage", "stress_healing"] },
    { id: "highwayman", roles: ["damage"] },
    { id: "vestal", roles: ["healing"] },
    { id: "plague_doctor", roles: ["stun", "blight"] },
    { id: "jester", roles: ["stress_healing", "buff"] },
  ].map(({ id, roles }) => ({
    id,
    aliases: [],
    dlcs: [],
    summary: `${id} test guidance`,
    roles,
    strengths: [],
    limitations: [],
    positionGuidance: [
      {
        positions: [1, 2],
        recommendation: "preferred" as const,
        reason: "Verified test front-rank guidance.",
      },
    ],
    mechanics: [],
    skillGuidance: [],
    partySynergies: [],
    sources: [],
  })),
};

const mockProgressionRules: HeroProgressionRules = {
  resolveLevelThresholds: [0, 2, 8, 14, 24, 36, 48],
};

const mockRestrictionRules: QuestRestrictionRules = {
  maximumResolveLevelByDifficulty: [2, 4, 99],
};

const mockTrinketGuidance: TrinketGuidanceKnowledgeBase = {
  schemaVersion: 1,
  policy: { title: "Test", disclaimer: "Test policy" },
  trinkets: [
    {
      trinketId: "focus_ring",
      tier: "S",
      recommendedRoles: ["dps"],
      recommendedClasses: [],
      synergies: [],
      cautions: [],
      playstyleAdvice: "Accuracy ring",
    },
  ],
};

function createMockGameState(heroes: Hero[], quests: Quest[]): GameState {
  return {
    roster: { version: 1, nextGuid: 10, heroes },
    quests: { version: 1, plotQuestTotal: quests.length, quests },
    estate: {
      version: 1,
      resources: [{ type: "gold", amount: 10000 }],
      trinkets: [{ id: "focus_ring", type: "trinket", amount: 1 }],
      estateItems: [],
    },
    town: { version: 1, buildings: [], districts: [] },
    upgrades: { version: 1, purchases: [] },
  };
}

test("filters heroes by resolve level and town building availability", () => {
  const heroes = [
    makeHero("1", "Reynauld", "crusader", 0), // Level 0, free -> eligible
    makeHero("2", "Dismas", "highwayman", 1), // Level 0, free -> eligible
    makeHero("3", "Paracelsus", "plague_doctor", 0, 0, "sanitarium"), // In sanitarium -> ineligible
    makeHero("4", "Veteran Leper", "leper", 10), // Level 2 (resolveXp 10 >= 8), apprentice quest max is 2 -> eligible
    makeHero("5", "Champion Crusader", "crusader", 25), // Level 4 (resolveXp 25 >= 24), max is 2 -> ineligible
  ];
  const quest = makeQuest("apprentice_ruins_1", "ruins", 0, 0);
  const state = createMockGameState(heroes, [quest]);

  const plan = planExpedition(
    state,
    { questId: "apprentice_ruins_1" },
    {
      combatKnowledge: mockCombatKnowledge,
      classKnowledge: mockClassKnowledge,
      progressionRules: mockProgressionRules,
      restrictionRules: mockRestrictionRules,
      trinketGuidance: mockTrinketGuidance,
    },
  );

  assert.equal(plan.quest.id, "apprentice_ruins_1");
  assert.equal(plan.quest.dungeon, "ruins");
  assert.equal(plan.ineligibleHeroes.length, 2);

  const sanitariumHero = plan.ineligibleHeroes.find((h) => h.id === "3");
  assert.ok(sanitariumHero);
  assert.ok(sanitariumHero.reasons.some((r) => r.includes("sanitarium")));

  const overlevelHero = plan.ineligibleHeroes.find((h) => h.id === "5");
  assert.ok(overlevelHero);
  assert.ok(overlevelHero.reasons.some((r) => r.includes("Resolve level too high")));
});

test("categorizes candidates from curated class roles and position guidance", () => {
  const heroes = [
    makeHero("1", "Reynauld", "crusader", 3), // Level 1
    makeHero("2", "Junia", "vestal", 3),
    makeHero("3", "Paracelsus", "plague_doctor", 3),
    makeHero("4", "Jingle", "jester", 3),
  ];
  const quest = makeQuest("ruins_short_1", "ruins", 0, 0);
  const state = createMockGameState(heroes, [quest]);

  const plan = planExpedition(
    state,
    { questId: "ruins_short_1" },
    {
      combatKnowledge: mockCombatKnowledge,
      classKnowledge: mockClassKnowledge,
      progressionRules: mockProgressionRules,
      restrictionRules: mockRestrictionRules,
      trinketGuidance: mockTrinketGuidance,
    },
  );

  // Crusader in Frontline DPS
  assert.ok(plan.rolePool.frontlineDps.some((h) => h.heroClass === "crusader"));
  // Vestal in Primary Healer
  assert.ok(plan.rolePool.primaryHealer.some((h) => h.heroClass === "vestal"));
  // Plague Doctor in Control / Disruptor
  assert.ok(plan.rolePool.controlDisruptor.some((h) => h.heroClass === "plague_doctor"));
  // Jester in Support / Stress Healer
  assert.ok(plan.rolePool.supportStressHealer.some((h) => h.heroClass === "jester"));

  // Crusader has role evidence from curated class knowledge
  const crusaderCandidate = plan.rolePool.frontlineDps.find((h) => h.heroClass === "crusader");
  assert.ok(crusaderCandidate?.suitabilityReasons.some((r) => r.includes("Curated class roles")));
  assert.ok(crusaderCandidate && crusaderCandidate.roleScore >= 70);
});

test("does not infer roles for a class missing from the knowledge base", () => {
  const state = createMockGameState(
    [makeHero("1", "Unknown Crusader", "crusader", 0)],
    [makeQuest("ruins_short", "ruins", 0, 0)],
  );

  const plan = planExpedition(
    state,
    {},
    {
      combatKnowledge: mockCombatKnowledge,
      classKnowledge: { schemaVersion: 2, classes: [] },
      progressionRules: mockProgressionRules,
      restrictionRules: mockRestrictionRules,
    },
  );

  assert.deepEqual(plan.rolePool, {
    frontlineDps: [],
    controlDisruptor: [],
    supportStressHealer: [],
    primaryHealer: [],
  });
});

test("matches region aliases to save dungeon ids without falling back", () => {
  const heroes = [makeHero("1", "Reynauld", "crusader", 3)];
  const coveQuest = makeQuest("cove_short", "cove", 0, 0);
  const cryptsQuest = makeQuest("crypts_short", "crypts", 0, 0);
  const state = createMockGameState(heroes, [coveQuest, cryptsQuest]);

  const plan = planExpedition(
    state,
    { dungeon: "ruins" },
    {
      combatKnowledge: mockCombatKnowledge,
      classKnowledge: mockClassKnowledge,
      progressionRules: mockProgressionRules,
      restrictionRules: mockRestrictionRules,
    },
  );

  assert.equal(plan.quest.id, "crypts_short");
  assert.equal(plan.quest.regionOverview, "Ruins dominated by Unholy skeletons.");
  assert.ok(plan.provisions.items.some(({ id }) => id === "holy_water"));
  assert.ok(
    plan.rolePool.frontlineDps[0]?.suitabilityReasons.some((reason) =>
      reason.includes("Curated class roles"),
    ),
  );
});

test("localizes expedition details in an additional supported language", () => {
  const state = createMockGameState(
    [makeHero("1", "Reynauld", "crusader", 3)],
    [makeQuest("crypts_short", "crypts", 0, 0)],
  );
  const localization = new Map([
    [
      "french",
      new Map([
        ["dungeon_name_crypts", "Les Ruines"],
        ["town_quest_name_crypts_short", "Quête des Ruines"],
        ["hero_class_name_crusader", "Croisé"],
        ["str_inventory_title_supplyholy_water", "Eau bénite"],
      ]),
    ],
  ]);

  const plan = planExpedition(
    state,
    { language: "fr" },
    {
      combatKnowledge: mockCombatKnowledge,
      classKnowledge: mockClassKnowledge,
      progressionRules: mockProgressionRules,
      restrictionRules: mockRestrictionRules,
      localization,
    },
  );

  assert.equal(plan.quest.dungeonName, "Les Ruines");
  assert.equal(plan.quest.questName, "Quête des Ruines");
  assert.equal(plan.rolePool.frontlineDps[0]?.heroClassName, "Croisé");
  assert.equal(
    plan.provisions.items.find(({ id }) => id === "holy_water")?.name,
    "Eau bénite",
  );
});

test("rejects unmatched dungeon and difficulty filters", () => {
  const state = createMockGameState(
    [makeHero("1", "Reynauld", "crusader", 3)],
    [makeQuest("cove_short", "cove", 0, 0)],
  );

  assert.throws(
    () =>
      planExpedition(
        state,
        { dungeon: "ruins", difficulty: 2 },
        { combatKnowledge: mockCombatKnowledge },
      ),
    /No quest matches dungeon=crypts, difficulty=2/,
  );
});

test("separates heroes whose quest eligibility cannot be verified", () => {
  const state = createMockGameState(
    [makeHero("1", "Unverified Hero", "crusader", 0)],
    [makeQuest("ruins_short", "ruins", 0, 0)],
  );

  const plan = planExpedition(
    state,
    {},
    {
      combatKnowledge: mockCombatKnowledge,
      classKnowledge: mockClassKnowledge,
    },
  );

  assert.equal(plan.unverifiedHeroes.length, 1);
  assert.equal(plan.unverifiedHeroes[0]?.id, "1");
  assert.match(
    plan.unverifiedHeroes[0]?.reasons[0] ?? "",
    /restriction_rules_unavailable/,
  );
  assert.equal(plan.rolePool.frontlineDps.length, 0);
});

test("calculates accurate provisions and gold costs based on dungeon length and region", () => {
  const questShort = makeQuest("ruins_short", "ruins", 0, 0); // Short
  const questMedium = makeQuest("ruins_medium", "ruins", 0, 1); // Medium
  const questLong = makeQuest("cove_long", "cove", 0, 2); // Long Cove

  const stateShort = createMockGameState([makeHero("1", "Hero", "vestal", 0)], [questShort]);
  const planShort = planExpedition(stateShort, {}, { combatKnowledge: mockCombatKnowledge, classKnowledge: mockClassKnowledge });

  const foodShort = planShort.provisions.items.find((i) => i.id === "food");
  const torchShort = planShort.provisions.items.find((i) => i.id === "torch");
  const holyWaterShort = planShort.provisions.items.find((i) => i.id === "holy_water");

  assert.equal(foodShort?.amount, 8);
  assert.equal(torchShort?.amount, 8);
  assert.equal(holyWaterShort?.amount, 2);
  assert.ok(planShort.provisions.totalEstimatedCost > 0);

  const stateMedium = createMockGameState([makeHero("1", "Hero", "vestal", 0)], [questMedium]);
  const planMedium = planExpedition(stateMedium, {}, { combatKnowledge: mockCombatKnowledge, classKnowledge: mockClassKnowledge });
  const foodMedium = planMedium.provisions.items.find((i) => i.id === "food");
  const torchMedium = planMedium.provisions.items.find((i) => i.id === "torch");
  assert.equal(foodMedium?.amount, 16);
  assert.equal(torchMedium?.amount, 14);

  const stateLong = createMockGameState([makeHero("1", "Hero", "vestal", 0)], [questLong]);
  const planLong = planExpedition(stateLong, {}, { combatKnowledge: mockCombatKnowledge, classKnowledge: mockClassKnowledge });
  const foodLong = planLong.provisions.items.find((i) => i.id === "food");
  const herbsLong = planLong.provisions.items.find((i) => i.id === "medicinal_herbs");
  assert.equal(foodLong?.amount, 24);
  assert.equal(herbsLong?.amount, 4); // Cove Long Herbs = 4
});

test("binds target boss tactics when quest objectives target a boss", () => {
  const bossQuest = makeQuest("kill_necromancer_1", "ruins", 0, 1, ["kill_necromancer"]);
  const state = createMockGameState([makeHero("1", "Hero", "crusader", 0)], [bossQuest]);

  const plan = planExpedition(state, {}, { combatKnowledge: mockCombatKnowledge, classKnowledge: mockClassKnowledge });

  assert.ok(plan.quest.bossGuidance);
  assert.equal(plan.quest.bossGuidance?.id, "necromancer");
  assert.ok(plan.tacticalAdvice.some((a) => a.includes("necromancer")));
});

test("respects preferredHeroIds with scoring bonus and priority flag", () => {
  const heroes = [
    makeHero("1", "Reynauld", "crusader", 0),
    makeHero("2", "Dismas", "highwayman", 0),
  ];
  const quest = makeQuest("ruins_short", "ruins", 0, 0);
  const state = createMockGameState(heroes, [quest]);

  const plan = planExpedition(
    state,
    { preferredHeroIds: ["2"] },
    {
      combatKnowledge: mockCombatKnowledge,
      classKnowledge: mockClassKnowledge,
      progressionRules: mockProgressionRules,
      restrictionRules: mockRestrictionRules,
    },
  );

  const dismas = plan.rolePool.frontlineDps.find((h) => h.id === "2");
  assert.ok(dismas);
  assert.equal(dismas.isPreferred, true);
  assert.ok(dismas.suitabilityReasons.some((r) => r.includes("preferred")));
});

test("recommends only trinkets curated for the candidate class", () => {
  const state = createMockGameState(
    [makeHero("1", "Reynauld", "crusader", 0)],
    [makeQuest("ruins_short", "ruins", 0, 0)],
  );
  state.estate.trinkets.push({
    id: "vestal_only",
    type: "trinket",
    amount: 1,
  });
  const guidance: TrinketGuidanceKnowledgeBase = {
    ...mockTrinketGuidance,
    trinkets: [
      ...mockTrinketGuidance.trinkets,
      {
        trinketId: "vestal_only",
        tier: "S",
        recommendedRoles: ["healer"],
        recommendedClasses: ["vestal"],
        synergies: [],
        cautions: [],
        playstyleAdvice: "Vestal-only test guidance.",
      },
    ],
  };

  const plan = planExpedition(
    state,
    {},
    {
      combatKnowledge: mockCombatKnowledge,
      classKnowledge: mockClassKnowledge,
      trinketGuidance: guidance,
      progressionRules: mockProgressionRules,
      restrictionRules: mockRestrictionRules,
    },
  );

  const crusader = plan.rolePool.frontlineDps.find(({ id }) => id === "1");
  assert.ok(crusader);
  assert.deepEqual(crusader.recommendedTrinketIds, ["focus_ring"]);
});
