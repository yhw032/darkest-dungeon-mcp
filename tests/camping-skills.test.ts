import assert from "node:assert/strict";
import test from "node:test";

import type { Hero } from "../src/domain/hero.js";
import type { Quest } from "../src/domain/quest.js";
import type { CampingSkillKnowledgeBase } from "../src/domain/camping-skills.js";
import type { CombatKnowledgeBase } from "../src/domain/combat-knowledge.js";
import type { GameState } from "../src/domain/game-state.js";
import {
  planExpedition,
  type PlanExpeditionDependencies,
} from "../src/queries/plan-expedition.js";
import { loadCampingSkills } from "../src/knowledge/load-camping-skills.js";

const mockCombatKnowledge: CombatKnowledgeBase = {
  schemaVersion: 2,
  regions: [
    {
      id: "weald",
      dlcs: [],
      overview: "Fungal threats",
      commonThreats: [],
      resistanceTendencies: [],
      recommendedCapabilities: [],
      cautions: [],
      sources: [],
    },
  ],
  enemies: [],
};

const mockCampingSkills: CampingSkillKnowledgeBase = {
  schemaVersion: 1,
  skills: [
    {
      id: "sanctuary",
      cost: 4,
      classes: ["vestal"],
      preventsNightAmbush: true,
      curesDisease: false,
      primaryCategory: "ambush_prevention",
    },
    {
      id: "zealous_vigil",
      cost: 4,
      classes: ["crusader"],
      preventsNightAmbush: true,
      curesDisease: false,
      primaryCategory: "ambush_prevention",
    },
    {
      id: "tactics",
      cost: 4,
      classes: ["man_at_arms"],
      preventsNightAmbush: false,
      curesDisease: false,
      primaryCategory: "buff",
    },
    {
      id: "leeches",
      cost: 3,
      classes: ["plague_doctor"],
      preventsNightAmbush: false,
      curesDisease: true,
      primaryCategory: "heal",
    },
  ],
};

const eligibilityDependencies: Pick<
  PlanExpeditionDependencies,
  "progressionRules" | "restrictionRules"
> = {
  progressionRules: { resolveLevelThresholds: [0] },
  restrictionRules: { maximumResolveLevelByDifficulty: [99] },
};

function makeHero(
  id: string,
  name: string,
  heroClass: string,
  campingSkills: string[],
): Hero {
  return {
    id,
    name,
    heroClass,
    resolveXp: 0,
    stress: 0,
    rosterStatus: 0,
    buildingName: null,
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
    campingSkills,
    combatSkillSelections: [],
    campingSkillSelections: [],
  };
}

function makeQuest(
  id: string,
  dungeon: string,
  length: number,
): Quest {
  return {
    saveKey: id,
    id,
    mapName: dungeon,
    isPlotQuest: false,
    isFromTownEvent: false,
    type: "explore",
    dungeon,
    difficulty: 0,
    length,
    goalIds: [],
    reward: {
      resolveXp: 0,
      items: [],
    },
  };
}

function createMockGameState(
  questLength: number,
  heroes: Array<{ id: string; name: string; heroClass: string; campingSkills: string[] }>,
): GameState {
  return {
    roster: {
      version: 1,
      nextGuid: 1,
      heroes: heroes.map((h) => makeHero(h.id, h.name, h.heroClass, h.campingSkills)),
    },
    quests: {
      version: 1,
      plotQuestTotal: 0,
      quests: [makeQuest("q_test", "weald", questLength)],
    },
    estate: {
      version: 1,
      resources: [],
      trinkets: [],
      estateItems: [],
    },
    town: { version: 1, buildings: [], districts: [] },
    upgrades: { version: 1, purchases: [] },
  };
}

test("loads checked-in camping skills and verifies ambush prevention flag", async () => {
  const knowledge = await loadCampingSkills();
  assert.ok(knowledge.skills.length > 50);

  const sanctuary = knowledge.skills.find((s) => s.id === "sanctuary");
  assert.ok(sanctuary);
  assert.equal(sanctuary.preventsNightAmbush, true);
  assert.equal(sanctuary.primaryCategory, "ambush_prevention");

  const tactics = knowledge.skills.find((s) => s.id === "tactics");
  assert.ok(tactics);
  assert.equal(tactics.preventsNightAmbush, false);
  assert.equal(tactics.primaryCategory, "buff");
});

test("evaluates camping strategy for medium quest with ambush prevention provider", () => {
  const state = createMockGameState(1, [
    { id: "h1", name: "듀보스", heroClass: "vestal", campingSkills: ["sanctuary"] },
    { id: "h2", name: "바리스탄", heroClass: "man_at_arms", campingSkills: ["tactics"] },
  ]);

  const result = planExpedition(
    state,
    { language: "ko" },
    {
      combatKnowledge: mockCombatKnowledge,
      classKnowledge: { schemaVersion: 2, classes: [] },
      campingSkills: mockCampingSkills,
      ...eligibilityDependencies,
    },
  );

  assert.equal(result.campingStrategy.hasCamping, true);
  assert.equal(result.campingStrategy.firewoodCount, 1);
  assert.equal(result.campingStrategy.ambushPrevention.isAvailable, true);
  assert.equal(result.campingStrategy.ambushPrevention.providers.length, 1);
  assert.equal(result.campingStrategy.ambushPrevention.providers[0]?.heroName, "듀보스");
  assert.equal(result.campingStrategy.ambushPrevention.providers[0]?.skillId, "sanctuary");
  assert.equal(result.campingStrategy.ambushPrevention.warning, null);
  assert.ok(result.campingStrategy.respitePointPlan.length >= 3);
});

test("warns when no candidate heroes have ambush prevention skills", () => {
  const state = createMockGameState(2, [
    { id: "h2", name: "바리스탄", heroClass: "man_at_arms", campingSkills: ["tactics"] },
    { id: "h3", name: "페인트리", heroClass: "plague_doctor", campingSkills: ["leeches"] },
  ]);

  const result = planExpedition(
    state,
    { language: "ko" },
    {
      combatKnowledge: mockCombatKnowledge,
      classKnowledge: { schemaVersion: 2, classes: [] },
      campingSkills: mockCampingSkills,
      ...eligibilityDependencies,
    },
  );

  assert.equal(result.campingStrategy.hasCamping, true);
  assert.equal(result.campingStrategy.firewoodCount, 2);
  assert.equal(result.campingStrategy.ambushPrevention.isAvailable, false);
  assert.equal(result.campingStrategy.ambushPrevention.providers.length, 0);
  assert.ok(result.campingStrategy.ambushPrevention.warning);
  assert.match(result.campingStrategy.ambushPrevention.warning ?? "", /ambush/i);
});

test("returns hasCamping: false for short quests", () => {
  const state = createMockGameState(0, [
    { id: "h1", name: "듀보스", heroClass: "vestal", campingSkills: ["sanctuary"] },
  ]);

  const result = planExpedition(
    state,
    { language: "ko" },
    {
      combatKnowledge: mockCombatKnowledge,
      classKnowledge: { schemaVersion: 2, classes: [] },
      campingSkills: mockCampingSkills,
      ...eligibilityDependencies,
    },
  );

  assert.equal(result.campingStrategy.hasCamping, false);
  assert.equal(result.campingStrategy.firewoodCount, 0);
  assert.equal(result.campingStrategy.ambushPrevention.isAvailable, false);
});
