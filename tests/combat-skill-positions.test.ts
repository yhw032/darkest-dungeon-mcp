import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  loadHeroCombatSkillPositions,
  parseHeroCombatSkillPositions,
} from "../src/skills/combat-skill-positions.js";

const graveRobber = [
  'combat_skill: .id "lunge" .level 0 .move 0 2 .launch 43 .target 123 .is_crit_valid True',
  'combat_skill: .id "lunge" .level 1 .move 0 2 .launch 43 .target 123 .is_crit_valid True',
  'combat_skill: .id "flashing_daggers" .level 0 .launch 432 .target ~23 .is_crit_valid True',
  'combat_skill: .id "shadow_fade" .level 0 .move 2 0 .launch 21 .target  .is_crit_valid False',
  'combat_skill: .id "dagger_guard" .level 0 .launch 4321 .target @1234 .is_crit_valid False',
  'combat_skill: .id "random_shot" .level 0 .launch 4 .target ?1234 .is_crit_valid True',
].join("\n");

test("parses launch, target, and movement semantics", () => {
  assert.deepEqual(parseHeroCombatSkillPositions(graveRobber, "grave_robber"), [
    {
      heroClass: "grave_robber",
      skillId: "lunge",
      usableFromRanks: [3, 4],
      target: { side: "enemy", mode: "single", ranks: [1, 2, 3] },
      movement: { backward: 0, forward: 2 },
    },
    {
      heroClass: "grave_robber",
      skillId: "flashing_daggers",
      usableFromRanks: [2, 3, 4],
      target: { side: "enemy", mode: "group", ranks: [2, 3] },
      movement: { backward: 0, forward: 0 },
    },
    {
      heroClass: "grave_robber",
      skillId: "shadow_fade",
      usableFromRanks: [1, 2],
      target: { side: "self", mode: "single", ranks: [] },
      movement: { backward: 2, forward: 0 },
    },
    {
      heroClass: "grave_robber",
      skillId: "dagger_guard",
      usableFromRanks: [1, 2, 3, 4],
      target: { side: "ally", mode: "single", ranks: [1, 2, 3, 4] },
      movement: { backward: 0, forward: 0 },
    },
    {
      heroClass: "grave_robber",
      skillId: "random_shot",
      usableFromRanks: [4],
      target: { side: "enemy", mode: "random", ranks: [1, 2, 3, 4] },
      movement: { backward: 0, forward: 0 },
    },
  ]);
});

test("loads base and official DLC hero definitions while ignoring modes", async () => {
  const root = await mkdtemp(join(tmpdir(), "ddmcp-skill-positions-"));
  try {
    const base = join(root, "heroes", "grave_robber");
    const dlc = join(root, "dlc", "shieldbreaker", "heroes", "shieldbreaker");
    const mode = join(root, "dlc", "shieldbreaker", "modes", "radiant", "heroes", "shieldbreaker");
    await Promise.all([base, dlc, mode].map((path) => mkdir(path, { recursive: true })));
    await writeFile(join(base, "grave_robber.info.darkest"), graveRobber, "utf8");
    const pierce = 'combat_skill: .id "pierce" .level 0 .move 0 1 .launch 4321 .target 1234 .is_crit_valid True';
    await writeFile(join(dlc, "shieldbreaker.info.darkest"), pierce, "utf8");
    await writeFile(join(mode, "shieldbreaker.info.darkest"), pierce, "utf8");

    const definitions = await loadHeroCombatSkillPositions(root);
    assert.equal(definitions.length, 6);
    assert.ok(definitions.some(({ heroClass, skillId }) =>
      heroClass === "shieldbreaker" && skillId === "pierce"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
