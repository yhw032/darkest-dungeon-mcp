import { access, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { extname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface DecoderPathOptions {
  explicitPath?: string;
  environment?: NodeJS.ProcessEnv;
  defaultPath?: string;
}

async function isReadableFile(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

const projectDefaultJarPath = fileURLToPath(
  new URL("../../tools/DDSaveEditor.jar", import.meta.url),
);

export async function resolveDecoderJarPath(
  options: DecoderPathOptions = {},
): Promise<string> {
  const environment = options.environment ?? process.env;
  const candidates = [
    options.explicitPath,
    environment.DD_SAVE_EDITOR_JAR,
    options.defaultPath ?? projectDefaultJarPath,
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    const absolutePath = resolve(candidate);
    if (
      extname(absolutePath).toLowerCase() === ".jar" &&
      (await isReadableFile(absolutePath))
    ) {
      return absolutePath;
    }
  }

  throw new Error(
    `DDSaveEditor.jar was not found. Place it at ${projectDefaultJarPath}, set DD_SAVE_EDITOR_JAR, or pass --decoder-jar.`,
  );
}

export async function resolveJavaExecutable(
  explicitExecutable?: string,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  if (explicitExecutable !== undefined) {
    if (!isAbsolute(explicitExecutable)) return explicitExecutable;
    if (await isReadableFile(explicitExecutable)) return explicitExecutable;
    throw new Error(`Java executable was not found: ${explicitExecutable}`);
  }

  if (environment.JAVA_HOME !== undefined) {
    const executableName = process.platform === "win32" ? "java.exe" : "java";
    const candidate = join(environment.JAVA_HOME, "bin", executableName);
    if (await isReadableFile(candidate)) return candidate;
  }

  return "java";
}
