import type { CombatKnowledgeBase } from "../domain/combat-knowledge.js";
import type {
  ClassKnowledge,
  ClassKnowledgeBase,
} from "../domain/class-knowledge.js";
import type {
  ExpeditionHeroCandidate,
  ExpeditionPlanResult,
  ExpeditionProvisionEstimate,
  ExpeditionProvisionItem,
  ExpeditionQuestContext,
  ExpeditionRolePool,
  IneligibleHero,
} from "../domain/expedition-plan.js";
import type { GameState } from "../domain/game-state.js";
import type { Hero } from "../domain/hero.js";
import type { HeroProgressionRules } from "../domain/hero-progression.js";
import type { Quest } from "../domain/quest.js";
import type { QuestRestrictionRules } from "../domain/quest-restrictions.js";
import type { QuirkTreatmentKnowledgeBase } from "../domain/quirk-treatment-knowledge.js";
import type { TrinketDefinition } from "../domain/trinket-definitions.js";
import type { TrinketGuidanceKnowledgeBase } from "../domain/trinket-guidance.js";
import {
  localizeGameString,
  localizeGameStrings,
  localizeProvisionItem,
  type GameLanguage,
  type GameLocalization,
} from "../localization/game-localization.js";
import { getResolveLevel } from "../progression/hero-progression.js";
import { getQuestEligibility } from "../quests/quest-eligibility.js";
import {
  getCombatRegionId,
  normalizeSaveDungeonId,
} from "../quests/dungeon-ids.js";
import type { LocalizedEnemyCombatKnowledge } from "./query-combat.js";
import type {
  AmbushPreventionProvider,
  CampingSkillDefinition,
  CampingSkillKnowledgeBase,
  ExpeditionCampingStrategy,
  KeyCampingBuffProvider,
} from "../domain/camping-skills.js";

export interface PlanExpeditionOptions {
  questId?: string;
  dungeon?: string;
  difficulty?: number;
  preferredHeroIds?: string[];
  language?: GameLanguage;
}

export interface PlanExpeditionDependencies {
  combatKnowledge: CombatKnowledgeBase;
  classKnowledge?: ClassKnowledgeBase | undefined;
  trinketGuidance?: TrinketGuidanceKnowledgeBase | undefined;
  trinketDefinitions?:
    | TrinketDefinition[]
    | Map<string, TrinketDefinition>
    | undefined;
  quirkTreatmentKnowledge?: QuirkTreatmentKnowledgeBase | undefined;
  progressionRules?: HeroProgressionRules | undefined;
  restrictionRules?: QuestRestrictionRules | undefined;
  localization?: GameLocalization | undefined;
  campingSkills?: CampingSkillKnowledgeBase | undefined;
}

const provisionBaseCosts: Record<string, number> = {
  food: 75,
  torch: 75,
  shovel: 250,
  skeleton_key: 200,
  holy_water: 150,
  medicinal_herbs: 200,
  bandage: 150,
  antivenom: 150,
  the_blood: 0,
};

type ExpeditionRole = keyof ExpeditionRolePool;

const roleIds: Readonly<Record<ExpeditionRole, readonly string[]>> = {
  frontlineDps: ["damage", "bleed", "armor_piercing"],
  controlDisruptor: ["stun", "debuff", "movement_control", "mark"],
  supportStressHealer: [
    "stress_healing",
    "buff",
    "dodge_support",
    "guard_support",
    "guard",
  ],
  primaryHealer: ["healing"],
};

function getRoleEvidence(
  knowledge: ClassKnowledge,
  role: ExpeditionRole,
): { score: number; reasons: string[] } | undefined {
  const matchedRoles = knowledge.roles.filter((classRole) =>
    roleIds[role].includes(classRole),
  );
  if (matchedRoles.length === 0) return undefined;

  const reasons = [`Curated class roles: ${matchedRoles.join(", ")}`];
  let score = 50 + matchedRoles.length * 10;

  if (role === "frontlineDps") {
    const frontlineGuidance = knowledge.positionGuidance.find(
      (guidance) =>
        guidance.recommendation !== "avoid" &&
        guidance.positions.some((position) => position === 1 || position === 2),
    );
    if (frontlineGuidance === undefined) return undefined;
    score += frontlineGuidance.recommendation === "preferred" ? 10 : 5;
    reasons.push(`Front-rank guidance: ${frontlineGuidance.reason}`);
  }

  return { score, reasons };
}

function getLocalized(
  localization: GameLocalization | undefined,
  language: GameLanguage,
  key: string,
): string | null {
  if (!localization) return null;
  const langKey = language === "ko" ? "koreana" : "english";
  return localization.get(langKey)?.get(key) ?? null;
}

function findBossGuidance(
  quest: Quest,
  combatKnowledge: CombatKnowledgeBase,
  language: GameLanguage,
  localization?: GameLocalization,
): LocalizedEnemyCombatKnowledge | null {
  const targetTokens = [
    quest.id.toLowerCase(),
    ...(quest.goalIds?.map((g) => g.toLowerCase()) ?? []),
  ];
  for (const enemy of combatKnowledge.enemies) {
    if (enemy.enemyType !== "boss" && enemy.enemyType !== "miniboss") continue;
    for (const token of targetTokens) {
      if (token.includes(enemy.id) || enemy.aliases.some((a) => token.includes(a.toLowerCase()))) {
        const { localizationId, aliases: _aliases, dangerousActions, ...rest } = enemy;
        return {
          ...rest,
          name: localizeGameString(localizationId, language, localization),
          dangerousActions: dangerousActions.map((action) => {
            const { localizationIds, ...details } = action;
            return {
              ...details,
              name: localizeGameStrings(localizationIds, language, localization),
            };
          }),
        };
      }
    }
  }
  return null;
}

function calculateProvisions(
  quest: Quest,
  language: GameLanguage,
  localization?: GameLocalization,
): ExpeditionProvisionEstimate {
  const dungeon = getCombatRegionId(quest.dungeon) ??
    normalizeSaveDungeonId(quest.dungeon);
  const length = quest.length; // 0=short, 1=medium, 2=long

  const items: ExpeditionProvisionItem[] = [];

  function addItem(id: string, amount: number, purpose: string) {
    if (amount <= 0) return;
    const costPerUnit = provisionBaseCosts[id] ?? 100;
    const name = localizeProvisionItem(id, language, localization) ?? id;
    items.push({
      id,
      name,
      amount,
      costPerUnit,
      totalCost: amount * costPerUnit,
      purpose,
    });
  }

  // Food
  const foodAmount = length === 0 ? 8 : length === 1 ? 16 : 24;
  addItem("food", foodAmount, "Camping meals and hallway hunger checks");

  // Torches (Courtyard and Farmstead have fixed light mechanics)
  if (dungeon !== "courtyard" && dungeon !== "farmstead") {
    const torchAmount = length === 0 ? 8 : length === 1 ? 14 : 18;
    addItem("torch", torchAmount, "Maintain high radiant light for ACC and CRT buffs");
  }

  // Shovels
  const shovelExtra = dungeon === "weald" || dungeon === "cove" ? 1 : 0;
  const shovelAmount = (length === 0 ? 2 : length === 1 ? 3 : 4) + shovelExtra;
  addItem("shovel", shovelAmount, "Clear blockages without severe HP/stress damage");

  // Skeleton Keys
  const keyExtra = dungeon === "ruins" ? 1 : 0;
  const keyAmount = (length === 0 ? 1 : length === 1 ? 2 : 3) + keyExtra;
  addItem("skeleton_key", keyAmount, "Safely unlock heirloom chests and secret rooms");

  // Regional provisions
  if (dungeon === "ruins") {
    const holyWaterAmount = length === 0 ? 2 : length === 1 ? 3 : 4;
    addItem("holy_water", holyWaterAmount, "Purify confession booths and unholy altars");
    const herbsAmount = length === 0 ? 1 : 2;
    addItem("medicinal_herbs", herbsAmount, "Cleanse alchemy tables and iron maidens");
  } else if (dungeon === "warrens") {
    const herbsAmount = length === 0 ? 2 : length === 1 ? 3 : 4;
    addItem("medicinal_herbs", herbsAmount, "Harvest food carts and dinner carts safely");
    const bandageAmount = length === 0 ? 1 : length === 1 ? 2 : 3;
    addItem("bandage", bandageAmount, "Cure severe swine bleeds and arterial cuts");
  } else if (dungeon === "weald") {
    const antivenomAmount = length === 0 ? 2 : length === 1 ? 3 : 4;
    addItem("antivenom", antivenomAmount, "Cure fungal blights and open venomous mackinaws");
    const bandageAmount = length === 0 ? 2 : length === 1 ? 3 : 4;
    addItem("bandage", bandageAmount, "Cure rabid bites and tree branch bleeds");
  } else if (dungeon === "cove") {
    const herbsAmount = length === 0 ? 2 : length === 1 ? 3 : 4;
    addItem("medicinal_herbs", herbsAmount, "Purify coral for negative quirk removal");
    const bandageAmount = length === 0 ? 2 : length === 1 ? 3 : 4;
    addItem("bandage", bandageAmount, "Counter Uca Major's catastrophic arterial bleeds");
  } else if (dungeon === "courtyard") {
    const bandageAmount = length === 0 ? 3 : length === 1 ? 4 : 5;
    addItem("bandage", bandageAmount, "Counter heavy bloodsucker bleeds");
    addItem("the_blood", length === 0 ? 2 : length === 1 ? 4 : 6, "Sustain cursed heroes entering craving/wasting states");
  }

  const totalEstimatedCost = items.reduce((sum, item) => sum + item.totalCost, 0);
  const notes: string[] = [
    "Always reserve at least one key for a possible Secret Room (found by critical scouting).",
    "Bring additional food if running heroes with stress-eating or tapeworm quirks.",
  ];

  return { items, totalEstimatedCost, notes };
}

function getLocalizedSkillName(
  localization: GameLocalization | undefined,
  language: GameLanguage,
  skillId: string,
): string | null {
  if (!localization) return null;
  const langKey = language === "ko" ? "koreana" : "english";
  return localization.get(langKey)?.get(`camping_skill_name_${skillId}`) ?? null;
}

function buildCampingStrategy(
  quest: Quest,
  candidateHeroes: Hero[],
  campingSkillsKnowledge: CampingSkillKnowledgeBase | undefined,
  language: GameLanguage,
  localization: GameLocalization | undefined,
): ExpeditionCampingStrategy {
  const firewoodCount = quest.length === 1 ? 1 : quest.length === 2 ? 2 : 0;
  const hasCamping = firewoodCount > 0;

  if (!hasCamping) {
    return {
      hasCamping: false,
      firewoodCount: 0,
      ambushPrevention: {
        isAvailable: false,
        providers: [],
        warning: null,
      },
      keyCampingSkills: [],
      respitePointPlan: [
        "Short expedition without camping (no firewood provided).",
      ],
    };
  }

  // Ambush prevention skills known in Darkest Dungeon 1
  const ambushSkillIds = new Set([
    "zealous_vigil",
    "sanctuary",
    "hounds_watch",
    "bandits_sense",
    "unspeakable_commune",
    "snake_eyes",
  ]);

  const skillMap = new Map<string, CampingSkillDefinition>();
  if (campingSkillsKnowledge?.skills) {
    for (const s of campingSkillsKnowledge.skills) {
      skillMap.set(s.id, s);
    }
  }

  const ambushProviders: AmbushPreventionProvider[] = [];
  const keySkills: KeyCampingBuffProvider[] = [];
  const seenKeySkills = new Set<string>();

  for (const hero of candidateHeroes) {
    for (const skillId of hero.campingSkills) {
      const def = skillMap.get(skillId);
      const isAmbushSkill = ambushSkillIds.has(skillId) || def?.preventsNightAmbush === true;
      const cost = def?.cost ?? (isAmbushSkill ? (skillId === "unspeakable_commune" || skillId === "snake_eyes" ? 3 : 4) : 3);
      const skillName = getLocalizedSkillName(localization, language, skillId) ?? skillId;

      if (isAmbushSkill) {
        ambushProviders.push({
          heroId: hero.id,
          heroName: hero.name,
          skillId,
          skillName,
          cost,
        });
      }

      const category = def?.primaryCategory ?? (isAmbushSkill ? "ambush_prevention" : "buff");
      if (
        (category === "buff" || category === "stress_heal" || def?.curesDisease) &&
        !seenKeySkills.has(`${hero.id}:${skillId}`)
      ) {
        seenKeySkills.add(`${hero.id}:${skillId}`);
        keySkills.push({
          heroId: hero.id,
          heroName: hero.name,
          skillId,
          skillName,
          cost,
          category,
        });
      }
    }
  }

  const isAmbushPreventable = ambushProviders.length > 0;
  const warning = isAmbushPreventable
    ? null
    : "Caution: No candidate heroes possess nighttime ambush prevention skills. Camping carries a high ambush risk.";

  const respitePointPlan: string[] = [
    "Total 12 Respite Points are available per camp.",
    isAmbushPreventable
      ? `Phase 1 (3-4 pts): Prioritize Ambush Prevention skill (${ambushProviders[0]?.skillName ?? "Sanctuary / Hound's Watch / Zealous Vigil"}) to prevent nocturnal surprises.`
      : "Phase 1 (Warning): No ambush prevention available; ensure hero positioning flexibility in case of night ambush.",
    "Phase 2 (5-8 pts): Activate high-value offensive buffs (ACC/CRIT/DMG) before bosses, or focus on Stress Healing / Disease Curing in standard dungeons.",
    "Phase 3 (1-2 pts): Spend remaining points on universal skills (Wound Care, Encourage) to maximize all 12 points.",
  ];

  return {
    hasCamping: true,
    firewoodCount,
    ambushPrevention: {
      isAvailable: isAmbushPreventable,
      providers: ambushProviders,
      warning,
    },
    keyCampingSkills: keySkills.slice(0, 8),
    respitePointPlan,
  };
}

export function planExpedition(
  gameState: GameState,
  options: PlanExpeditionOptions,
  dependencies: PlanExpeditionDependencies,
): ExpeditionPlanResult {
  const language = options.language ?? "en";
  const {
    combatKnowledge,
    classKnowledge,
    trinketGuidance,
    trinketDefinitions,
    quirkTreatmentKnowledge,
    progressionRules,
    restrictionRules,
    localization,
  } = dependencies;

  const trinketDefMap =
    trinketDefinitions instanceof Map
      ? trinketDefinitions
      : trinketDefinitions
        ? new Map(trinketDefinitions.map((d) => [d.id, d]))
        : undefined;

  // 1. Resolve Target Quest
  const quests = gameState.quests.quests;
  if (quests.length === 0) {
    throw new Error("No quests available in current game state");
  }

  let selectedQuest: Quest | undefined;
  if (options.questId) {
    selectedQuest = quests.find((q) => q.id === options.questId);
    if (!selectedQuest) {
      throw new Error(`Quest "${options.questId}" was not found`);
    }
  } else {
    const requestedDungeon =
      options.dungeon === undefined
        ? undefined
        : normalizeSaveDungeonId(options.dungeon);
    selectedQuest = quests.find((q) => {
      if (
        requestedDungeon !== undefined &&
        normalizeSaveDungeonId(q.dungeon) !== requestedDungeon
      ) {
        return false;
      }
      if (options.difficulty !== undefined && q.difficulty !== options.difficulty) {
        return false;
      }
      return true;
    });
    if (
      !selectedQuest &&
      (requestedDungeon !== undefined || options.difficulty !== undefined)
    ) {
      const filters = [
        requestedDungeon === undefined
          ? undefined
          : `dungeon=${requestedDungeon}`,
        options.difficulty === undefined
          ? undefined
          : `difficulty=${String(options.difficulty)}`,
      ].filter((value): value is string => value !== undefined);
      throw new Error(`No quest matches ${filters.join(", ")}`);
    }
    selectedQuest ??= quests[0];
  }
  if (!selectedQuest) {
    throw new Error("Unable to select target quest");
  }

  const dungeonId = normalizeSaveDungeonId(selectedQuest.dungeon);
  const regionId = getCombatRegionId(dungeonId);
  const regionKnowledge = combatKnowledge.regions.find(
    (region) => region.id === regionId,
  );
  const bossGuidance = findBossGuidance(selectedQuest, combatKnowledge, language, localization);

  const questContext: ExpeditionQuestContext = {
    id: selectedQuest.id,
    dungeon: selectedQuest.dungeon,
    dungeonName:
      getLocalized(localization, language, `dungeon_name_${dungeonId}`) ??
      selectedQuest.dungeon,
    difficulty: selectedQuest.difficulty,
    length: selectedQuest.length,
    questName:
      getLocalized(localization, language, `town_quest_name_${selectedQuest.id}`) ??
      selectedQuest.id,
    questDescription:
      getLocalized(localization, language, `town_quest_description_${selectedQuest.id}`) ??
      null,
    isPlotQuest: selectedQuest.isPlotQuest,
    goalIds: selectedQuest.goalIds,
    bossGuidance,
    regionOverview: regionKnowledge?.overview ?? null,
    regionCommonThreats: regionKnowledge?.commonThreats ?? [],
    regionResistanceTendencies: regionKnowledge?.resistanceTendencies ?? [],
    regionRecommendedCapabilities: regionKnowledge?.recommendedCapabilities ?? [],
    regionCautions: regionKnowledge?.cautions ?? [],
  };

  // 2. Roster Evaluation (Eligible vs Ineligible)
  const eligibleCandidates: Hero[] = [];
  const ineligibleHeroes: IneligibleHero[] = [];
  const unverifiedHeroes: IneligibleHero[] = [];
  const preferredSet = new Set(options.preferredHeroIds ?? []);

  // Owned S/A tier trinkets map
  const ownedTrinketIds = new Set<string>();
  for (const stack of gameState.estate.trinkets) {
    ownedTrinketIds.add(stack.id);
  }
  for (const hero of gameState.roster.heroes) {
    for (const t of hero.equippedTrinkets) {
      ownedTrinketIds.add(t.id);
    }
  }

  for (const hero of gameState.roster.heroes) {
    if (hero.rosterStatus === 3) continue; // Dead

    const resolveLevel = getResolveLevel(hero.resolveXp, progressionRules);
    const eligibility = getQuestEligibility(selectedQuest, resolveLevel, restrictionRules);

    const reasons: string[] = [];
    if (hero.rosterStatus === 1) {
      reasons.push("Already selected for raid party");
    } else if (hero.rosterStatus !== 0) {
      reasons.push("Hero roster status unavailable");
    }
    if (hero.buildingName !== null) {
      reasons.push(`In town building (${hero.buildingName})`);
    }
    if (eligibility.status === "ineligible") {
      reasons.push(`Resolve level too high for quest (Level ${resolveLevel ?? "?"} > Max ${eligibility.maximumResolveLevel ?? "?"})`);
    }

    const heroClassName =
      getLocalized(localization, language, `hero_class_name_${hero.heroClass}`) ??
      hero.heroClass;

    const heroResult = {
      id: hero.id,
      name: hero.name,
      heroClass: hero.heroClass,
      heroClassName,
      resolveLevel,
      stress: hero.stress,
    };

    if (reasons.length > 0) {
      ineligibleHeroes.push({ ...heroResult, reasons });
    } else if (eligibility.status === "unknown") {
      unverifiedHeroes.push({
        ...heroResult,
        reasons: [
          `Quest eligibility could not be verified (${eligibility.reason ?? "unknown_reason"})`,
        ],
      });
    } else {
      eligibleCandidates.push(hero);
    }
  }

  // 3. Score and Classify Candidates into Roles
  function buildCandidate(
    hero: Hero,
    baseScore: number,
    reasons: string[],
  ): ExpeditionHeroCandidate {
    const resolveLevel = getResolveLevel(hero.resolveXp, progressionRules);
    const heroClassName =
      getLocalized(localization, language, `hero_class_name_${hero.heroClass}`) ??
      hero.heroClass;

    let score = baseScore + (resolveLevel ?? 0) * 10;
    const cautions: string[] = [];

    // Stress penalty
    if (hero.stress >= 70) {
      score -= 25;
      cautions.push(`Elevated stress (${hero.stress}/100); high affliction hazard`);
    } else if (hero.stress >= 40) {
      score -= 10;
    }

    // Risky quirks
    if (quirkTreatmentKnowledge) {
      for (const quirk of hero.quirks) {
        const rule = quirkTreatmentKnowledge.rules.find((r) => r.quirkId === quirk.id);
        if (rule && (rule.priority === "critical" || rule.priority === "high")) {
          cautions.push(`Risky quirk [${quirk.id}] (${rule.priority})`);
          score -= rule.priority === "critical" ? 15 : 8;
        }
      }
    }

    // Preferred hero bonus
    const isPreferred = preferredSet.has(hero.id);
    if (isPreferred) {
      score += 50;
      reasons.unshift("User preferred hero");
    }

    // Recommended owned trinkets
    const recommendedTrinketIds: string[] = [];
    if (trinketGuidance) {
      for (const entry of trinketGuidance.trinkets) {
        if (!ownedTrinketIds.has(entry.trinketId)) continue;
        if (entry.tier !== "S" && entry.tier !== "A") continue;
        if (
          entry.recommendedClasses.length > 0 &&
          !entry.recommendedClasses.includes(hero.heroClass)
        ) {
          continue;
        }
        const def = trinketDefMap?.get(entry.trinketId);
        if (def && def.heroClassRequirements.length > 0 && !def.heroClassRequirements.includes(hero.heroClass)) {
          continue;
        }
        recommendedTrinketIds.push(entry.trinketId);
        if (recommendedTrinketIds.length >= 2) break;
      }
    }

    return {
      id: hero.id,
      name: hero.name,
      heroClass: hero.heroClass,
      heroClassName,
      resolveLevel,
      stress: hero.stress,
      roleScore: Math.round(score),
      suitabilityReasons: reasons,
      cautions,
      recommendedTrinketIds,
      isPreferred,
    };
  }

  const rolePool: ExpeditionRolePool = {
    frontlineDps: [],
    controlDisruptor: [],
    supportStressHealer: [],
    primaryHealer: [],
  };

  for (const hero of eligibleCandidates) {
    const knowledge = classKnowledge?.classes.find(
      (entry) => entry.id === hero.heroClass,
    );
    if (knowledge === undefined) continue;

    for (const role of Object.keys(rolePool) as ExpeditionRole[]) {
      const evidence = getRoleEvidence(knowledge, role);
      if (evidence !== undefined) {
        rolePool[role].push(
          buildCandidate(hero, evidence.score, evidence.reasons),
        );
      }
    }
  }

  // Sort each pool by score descending
  rolePool.frontlineDps.sort((a, b) => b.roleScore - a.roleScore);
  rolePool.controlDisruptor.sort((a, b) => b.roleScore - a.roleScore);
  rolePool.supportStressHealer.sort((a, b) => b.roleScore - a.roleScore);
  rolePool.primaryHealer.sort((a, b) => b.roleScore - a.roleScore);

  // 4. Provisions Estimate
  const provisions = calculateProvisions(selectedQuest, language, localization);

  // 5. Camping Strategy
  const campingStrategy = buildCampingStrategy(
    selectedQuest,
    eligibleCandidates,
    dependencies.campingSkills,
    language,
    localization,
  );

  // 6. Tactical Advice
  const tacticalAdvice: string[] = [
    "Construct a balanced 4-hero party covering Ranks 1 to 4 with at least 1 reliable healer and 1 backline reach attacker.",
    `Review the provided ${provisions.items.length} provision items to ensure adequate curio cleansing tools for ${selectedQuest.dungeon}.`,
  ];
  if (bossGuidance) {
    tacticalAdvice.unshift(`Target boss detected [${bossGuidance.id}]: ${bossGuidance.effectiveResponses[0] ?? ""}`);
  }
  if (campingStrategy.hasCamping) {
    if (campingStrategy.ambushPrevention.isAvailable) {
      tacticalAdvice.push(
        `Camping included in this expedition. Prioritize [${campingStrategy.ambushPrevention.providers[0]?.skillName ?? "Ambush Prevention"}] to avoid nighttime ambushes.`,
      );
    } else {
      tacticalAdvice.push(
        "Expedition includes camping but no candidate heroes have ambush prevention skills. Beware of nocturnal party shuffling.",
      );
    }
  }

  return {
    quest: questContext,
    rolePool,
    ineligibleHeroes,
    unverifiedHeroes,
    provisions,
    campingStrategy,
    tacticalAdvice,
  };
}
