import { resolve } from "node:path";

function isMissingFile(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

export function loadProjectEnvironment(
  path = resolve(process.cwd(), ".env"),
): boolean {
  try {
    process.loadEnvFile(path);
    return true;
  } catch (error) {
    if (isMissingFile(error)) return false;
    throw error;
  }
}
