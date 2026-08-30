import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { parseRosterJson } from "./parser/parse-roster.js";

const defaultSamplePath = fileURLToPath(
  new URL("../samples/roster-decoded.json", import.meta.url),
);
const inputPath = process.argv[2] ?? defaultSamplePath;
const raw = await readFile(inputPath, "utf8");
const roster = parseRosterJson(raw);

console.dir(roster, { depth: null });
