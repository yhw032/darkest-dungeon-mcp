import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { DdsSaveEditorDecoder } from "../decoder/dds-save-editor.js";
import {
  resolveDecoderJarPath,
  resolveJavaExecutable,
} from "../decoder/resolve-decoder.js";
import { loadGameState } from "../loaders/load-game-state.js";
import { loadLiveGameState } from "../loaders/load-live-game-state.js";
import { parseEstateJson } from "../parser/parse-estate.js";
import { parseQuestStateJson } from "../parser/parse-quest.js";
import { parseRosterJson } from "../parser/parse-roster.js";
import { parseTownJson } from "../parser/parse-town.js";
import { getEstateResources } from "../queries/get-estate-resources.js";
import { getGameStateSummary } from "../queries/get-game-state-summary.js";
import { getHero } from "../queries/get-hero.js";
import { getHeroTownContext } from "../queries/get-hero-town-context.js";
import { getQuest } from "../queries/get-quest.js";
import { getTownSummary } from "../queries/get-town-summary.js";
import {
  type HeroFilters,
  listHeroes,
} from "../queries/list-heroes.js";
import { type QuestFilters, listQuests } from "../queries/list-quests.js";
import { summarizeRoster } from "../queries/summarize-roster.js";
import {
  getTrinket,
  listTrinkets,
  type TrinketFilters,
  type TrinketLocation,
  type TrinketSources,
} from "../queries/trinkets.js";

const usage = `Usage:
  npm run cli -- heroes [-- --class <class> --status <number> --max-stress <number> --file <path>]
  npm run cli -- hero <id> [-- --file <path> --town-file <path>]
  npm run cli -- summary [-- --stress-threshold <number> --file <path>]
  npm run cli -- resources [-- --file <path>]
  npm run cli -- town [-- --file <path>]
  npm run cli -- quests [-- --dungeon <name> --type <type> --difficulty <number> --plot <true|false> --file <path>]
  npm run cli -- quest <id> [-- --file <path>]
  npm run cli -- trinkets [-- --id <id> --location <storage|equipped|store> --roster-file <path> --estate-file <path> --town-file <path>]
  npm run cli -- trinket <id> [-- --roster-file <path> --estate-file <path> --town-file <path>]
  npm run cli -- live-state -- --save-dir <profile-path> [--decoder-jar <path> --java <executable> --stress-threshold <number>]
  npm run cli -- state [-- --roster-file <path> --estate-file <path> --town-file <path> --quest-file <path> --stress-threshold <number>]`;

interface ParsedArguments {
  positional: string[];
  options: Map<string, string>;
}

function parseArguments(args: string[]): ParsedArguments {
  const positional: string[] = [];
  const options = new Map<string, string>();

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) {
      continue;
    }

    if (!argument.startsWith("--")) {
      positional.push(argument);
      continue;
    }

    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for ${argument}`);
    }

    options.set(argument.slice(2), value);
    index += 1;
  }

  return { positional, options };
}

function numberOption(
  options: Map<string, string>,
  name: string,
): number | undefined {
  const rawValue = options.get(name);
  if (rawValue === undefined) {
    return undefined;
  }

  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    throw new Error(`--${name} must be a finite number`);
  }

  return value;
}

function assertKnownOptions(
  options: Map<string, string>,
  allowed: readonly string[],
): void {
  for (const name of options.keys()) {
    if (!allowed.includes(name)) {
      throw new Error(`Unknown option: --${name}`);
    }
  }
}

const defaultSamplePath = fileURLToPath(
  new URL("../../samples/roster-decoded.json", import.meta.url),
);
const defaultEstateSamplePath = fileURLToPath(
  new URL("../../samples/estate-decoded.json", import.meta.url),
);
const defaultTownSamplePath = fileURLToPath(
  new URL("../../samples/town-decoded.json", import.meta.url),
);
const defaultQuestSamplePath = fileURLToPath(
  new URL("../../samples/quest-decoded.json", import.meta.url),
);

async function loadJson(path: string): Promise<string> {
  return readFile(path, "utf8");
}

async function loadTrinketSources(
  options: Map<string, string>,
): Promise<TrinketSources> {
  const [roster, estate, town] = await Promise.all([
    loadJson(options.get("roster-file") ?? defaultSamplePath).then(
      parseRosterJson,
    ),
    loadJson(options.get("estate-file") ?? defaultEstateSamplePath).then(
      parseEstateJson,
    ),
    loadJson(options.get("town-file") ?? defaultTownSamplePath).then(
      parseTownJson,
    ),
  ]);
  return { roster, estate, town };
}

function trinketLocationOption(
  options: Map<string, string>,
): TrinketLocation | undefined {
  const location = options.get("location");
  if (location === undefined) return undefined;
  if (location === "storage" || location === "equipped" || location === "store") {
    return location;
  }
  throw new Error("--location must be storage, equipped, or store");
}

function booleanOption(
  options: Map<string, string>,
  name: string,
): boolean | undefined {
  const value = options.get(name);
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`--${name} must be true or false`);
}

async function main(args: string[]): Promise<void> {
  const { positional, options } = parseArguments(args);
  const [command, id, ...extraPositionals] = positional;

  if (command === undefined) {
    throw new Error(usage);
  }

  let output: unknown;

  switch (command) {
    case "heroes": {
      assertKnownOptions(options, ["file", "class", "status", "max-stress"]);
      if (id !== undefined || extraPositionals.length > 0) {
        throw new Error("heroes does not accept positional arguments");
      }

      const roster = parseRosterJson(
        await loadJson(options.get("file") ?? defaultSamplePath),
      );
      const filters: HeroFilters = {};
      const heroClass = options.get("class");
      const rosterStatus = numberOption(options, "status");
      const maxStress = numberOption(options, "max-stress");

      if (heroClass !== undefined) filters.heroClass = heroClass;
      if (rosterStatus !== undefined) filters.rosterStatus = rosterStatus;
      if (maxStress !== undefined) filters.maxStress = maxStress;

      const heroes = listHeroes(roster, filters);
      output = { total: heroes.length, heroes };
      break;
    }

    case "hero": {
      assertKnownOptions(options, ["file", "town-file"]);
      if (id === undefined || extraPositionals.length > 0) {
        throw new Error("hero requires exactly one <id>");
      }

      const roster = parseRosterJson(
        await loadJson(options.get("file") ?? defaultSamplePath),
      );
      const hero = getHero(roster, id);
      if (hero === undefined) {
        throw new Error(`Hero not found: ${id}`);
      }

      const town = parseTownJson(
        await loadJson(options.get("town-file") ?? defaultTownSamplePath),
      );
      output = { hero, town: getHeroTownContext(roster, town, id) };
      break;
    }

    case "summary": {
      assertKnownOptions(options, ["file", "stress-threshold"]);
      if (id !== undefined || extraPositionals.length > 0) {
        throw new Error("summary does not accept positional arguments");
      }

      const roster = parseRosterJson(
        await loadJson(options.get("file") ?? defaultSamplePath),
      );
      output = summarizeRoster(
        roster,
        numberOption(options, "stress-threshold"),
      );
      break;
    }

    case "resources": {
      assertKnownOptions(options, ["file"]);
      if (id !== undefined || extraPositionals.length > 0) {
        throw new Error("resources does not accept positional arguments");
      }

      const estate = parseEstateJson(
        await loadJson(options.get("file") ?? defaultEstateSamplePath),
      );
      output = getEstateResources(estate);
      break;
    }

    case "town": {
      assertKnownOptions(options, ["file"]);
      if (id !== undefined || extraPositionals.length > 0) {
        throw new Error("town does not accept positional arguments");
      }

      const town = parseTownJson(
        await loadJson(options.get("file") ?? defaultTownSamplePath),
      );
      output = getTownSummary(town);
      break;
    }

    case "quests": {
      assertKnownOptions(options, [
        "file",
        "dungeon",
        "type",
        "difficulty",
        "plot",
      ]);
      if (id !== undefined || extraPositionals.length > 0) {
        throw new Error("quests does not accept positional arguments");
      }

      const state = parseQuestStateJson(
        await loadJson(options.get("file") ?? defaultQuestSamplePath),
      );
      const filters: QuestFilters = {};
      const dungeon = options.get("dungeon");
      const type = options.get("type");
      const difficulty = numberOption(options, "difficulty");
      const isPlotQuest = booleanOption(options, "plot");
      if (dungeon !== undefined) filters.dungeon = dungeon;
      if (type !== undefined) filters.type = type;
      if (difficulty !== undefined) filters.difficulty = difficulty;
      if (isPlotQuest !== undefined) filters.isPlotQuest = isPlotQuest;
      const quests = listQuests(state, filters);
      output = { total: quests.length, quests };
      break;
    }

    case "quest": {
      assertKnownOptions(options, ["file"]);
      if (id === undefined || extraPositionals.length > 0) {
        throw new Error("quest requires exactly one <id>");
      }

      const state = parseQuestStateJson(
        await loadJson(options.get("file") ?? defaultQuestSamplePath),
      );
      const quest = getQuest(state, id);
      if (quest === undefined) throw new Error(`Quest not found: ${id}`);
      output = { quest };
      break;
    }

    case "trinkets": {
      assertKnownOptions(options, [
        "id",
        "location",
        "roster-file",
        "estate-file",
        "town-file",
      ]);
      if (id !== undefined || extraPositionals.length > 0) {
        throw new Error("trinkets does not accept positional arguments");
      }

      const filters: TrinketFilters = {};
      const filterId = options.get("id");
      const location = trinketLocationOption(options);
      if (filterId !== undefined) filters.id = filterId;
      if (location !== undefined) filters.location = location;
      const trinkets = listTrinkets(await loadTrinketSources(options), filters);
      output = { total: trinkets.length, trinkets };
      break;
    }

    case "trinket": {
      assertKnownOptions(options, ["roster-file", "estate-file", "town-file"]);
      if (id === undefined || extraPositionals.length > 0) {
        throw new Error("trinket requires exactly one <id>");
      }

      const trinket = getTrinket(await loadTrinketSources(options), id);
      if (trinket === undefined) throw new Error(`Trinket not found: ${id}`);
      output = { trinket };
      break;
    }

    case "live-state": {
      assertKnownOptions(options, [
        "save-dir",
        "decoder-jar",
        "java",
        "stress-threshold",
      ]);
      if (id !== undefined || extraPositionals.length > 0) {
        throw new Error("live-state does not accept positional arguments");
      }

      const saveDirectory = options.get("save-dir");
      if (saveDirectory === undefined) {
        throw new Error("live-state requires --save-dir <profile-path>");
      }
      const explicitJarPath = options.get("decoder-jar");
      const jarPath = await resolveDecoderJarPath(
        explicitJarPath === undefined
          ? {}
          : { explicitPath: explicitJarPath },
      );
      const javaExecutable = await resolveJavaExecutable(options.get("java"));
      const decoder = new DdsSaveEditorDecoder({ jarPath, javaExecutable });
      const gameState = await loadLiveGameState({ saveDirectory, decoder });
      output = getGameStateSummary(
        gameState,
        numberOption(options, "stress-threshold"),
      );
      break;
    }

    case "state": {
      assertKnownOptions(options, [
        "roster-file",
        "estate-file",
        "town-file",
        "quest-file",
        "stress-threshold",
      ]);
      if (id !== undefined || extraPositionals.length > 0) {
        throw new Error("state does not accept positional arguments");
      }

      const gameState = await loadGameState({
        rosterPath: options.get("roster-file") ?? defaultSamplePath,
        estatePath: options.get("estate-file") ?? defaultEstateSamplePath,
        townPath: options.get("town-file") ?? defaultTownSamplePath,
        questPath: options.get("quest-file") ?? defaultQuestSamplePath,
      });
      output = getGameStateSummary(
        gameState,
        numberOption(options, "stress-threshold"),
      );
      break;
    }

    default:
      throw new Error(`Unknown command: ${command}\n\n${usage}`);
  }

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
