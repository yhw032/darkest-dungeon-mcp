import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { Hero } from "../src/domain/hero.js";
import type { UpgradeState } from "../src/domain/upgrades.js";
import { darkestDungeonStringHash } from "../src/upgrades/building-upgrades.js";
import {
  getHeroCombatSkillDetails,
  loadHeroCombatSkillTrees,
  parseHeroCombatSkillTrees,
} from "../src/upgrades/hero-skills.js";

function hellionDefinition(): unknown {
  const requirements = ["0", "1", "2", "3", "4"].map((code) => ({ code }));
  return {
    trees: [
      {
        id: "hellion.weapon",
        is_instanced: true,
        tags: ["weapon"],
        requirements: [{ code: "0" }],
      },
      {
        id: "hellion.wicked_hack",
        is_instanced: true,
        tags: ["combat_skill"],
        requirements,
      },
      {
        id: "hellion.iron_swan",
        is_instanced: true,
        tags: ["combat_skill"],
        requirements,
      },
    ],
  };
}

const hero: Hero = {
  id: "18",
  name: "Boudica",
  heroClass: "hellion",
  resolveXp: 14,
  stress: 0,
  rosterStatus: 0,
  buildingName: null,
  currentHp: 30,
  weaponRank: 2,
  armourRank: 2,
  afflictionId: null,
  afflictionSeverity: 0,
  virtueId: null,
  visitedDeathsDoor: false,
  hasHadHeartAttack: false,
  deathHeartAttackCompleted: false,
  quirks: [],
  equippedTrinkets: [],
  combatSkills: ["wicked_hack"],
  campingSkills: [],
  combatSkillSelections: [
    { id: "wicked_hack", rawSelectionValue: 0 },
  ],
  campingSkillSelections: [],
};

test("parses only instanced combat skill upgrade trees", () => {
  const trees = parseHeroCombatSkillTrees(
    hellionDefinition(),
    "hellion.upgrades.json",
  );

  assert.deepEqual(trees.map(({ id, skillId, requirementCodes }) => ({
    id,
    skillId,
    requirementCodes,
  })), [
    {
      id: "hellion.wicked_hack",
      skillId: "wicked_hack",
      requirementCodes: ["0", "1", "2", "3", "4"],
    },
    {
      id: "hellion.iron_swan",
      skillId: "iron_swan",
      requirementCodes: ["0", "1", "2", "3", "4"],
    },
  ]);
});

test("loads hero combat skill definitions from the game directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "ddmcp-hero-skills-"));
  try {
    const directory = join(root, "upgrades", "heroes");
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, "hellion.upgrades.json"),
      JSON.stringify(hellionDefinition()),
      "utf8",
    );
    const dlcDirectory = join(
      root,
      "dlc",
      "shieldbreaker",
      "upgrades",
      "heroes",
    );
    await mkdir(dlcDirectory, { recursive: true });
    const shieldbreakerDefinition = JSON.stringify({
      trees: [
        {
          id: "shieldbreaker.pierce",
          is_instanced: true,
          tags: ["combat_skill"],
          requirements: [{ code: "0" }],
        },
      ],
    });
    await writeFile(
      join(dlcDirectory, "shieldbreaker.upgrades.json"),
      shieldbreakerDefinition,
      "utf8",
    );
    const modeDirectory = join(
      root,
      "dlc",
      "shieldbreaker",
      "modes",
      "radiant",
      "upgrades",
      "heroes",
    );
    await mkdir(modeDirectory, { recursive: true });
    await writeFile(
      join(modeDirectory, "shieldbreaker.upgrades.json"),
      shieldbreakerDefinition,
      "utf8",
    );

    const trees = await loadHeroCombatSkillTrees(root);
    assert.equal(trees.length, 3);
    assert.ok(trees.some((tree) => tree.id === "shieldbreaker.pierce"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("derives displayed levels from per-hero upgrade purchases", () => {
  const trees = parseHeroCombatSkillTrees(
    hellionDefinition(),
    "hellion.upgrades.json",
  );
  const upgrades: UpgradeState = {
    version: 1,
    purchases: ["0", "1"].map((requirementCode, index) => ({
      id: String(index),
      instanceNumber: 18,
      treeId: darkestDungeonStringHash("hellion.wicked_hack"),
      requirementCode,
      isPurchased: true,
    })),
  };

  assert.deepEqual(getHeroCombatSkillDetails(hero, upgrades, trees), [
    {
      id: "wicked_hack",
      level: 2,
      isSelected: true,
      rawSelectionValue: 0,
    },
    {
      id: "iron_swan",
      level: null,
      isSelected: false,
      rawSelectionValue: null,
    },
  ]);
});

test("does not infer levels without game definitions", () => {
  assert.deepEqual(
    getHeroCombatSkillDetails(hero, { version: 1, purchases: [] }),
    [
      {
        id: "wicked_hack",
        level: null,
        isSelected: true,
        rawSelectionValue: 0,
      },
    ],
  );
});
