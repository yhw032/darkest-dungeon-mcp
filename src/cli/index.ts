import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { parseEstateJson } from "../parser/parse-estate.js";
import { parseRosterJson } from "../parser/parse-roster.js";
import { getEstateResources } from "../queries/get-estate-resources.js";
import { getHero } from "../queries/get-hero.js";
import {
  type HeroFilters,
  listHeroes,
} from "../queries/list-heroes.js";
import { summarizeRoster } from "../queries/summarize-roster.js";

const usage = `Usage:
  npm run cli -- heroes [-- --class <class> --status <number> --max-stress <number> --file <path>]
  npm run cli -- hero <id> [-- --file <path>]
  npm run cli -- summary [-- --stress-threshold <number> --file <path>]
  npm run cli -- resources [-- --file <path>]`;

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

async function loadJson(path: string): Promise<string> {
  return readFile(path, "utf8");
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
      assertKnownOptions(options, ["file"]);
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

      output = { hero };
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
