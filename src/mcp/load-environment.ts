import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

export const defaultEnvironmentFile = fileURLToPath(
  new URL("../../.env", import.meta.url),
);

function isMissingFile(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

export function readEnvironmentFile(
  path = defaultEnvironmentFile,
  required = false,
): NodeJS.ProcessEnv | undefined {
  try {
    return parseEnv(readFileSync(path, "utf8"));
  } catch (error) {
    if (!required && isMissingFile(error)) return undefined;
    throw error;
  }
}
