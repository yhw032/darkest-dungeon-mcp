import {
  defaultEnvironmentFile,
  readEnvironmentFile,
} from "./load-environment.js";

interface CommandLineOptions {
  envFile?: string;
  saveDirectory?: string;
  gameDirectory?: string;
  decoderJar?: string;
  javaExecutable?: string;
}

export interface RuntimeConfiguration {
  environment: NodeJS.ProcessEnv;
  environmentFile: string;
}

const optionNames = {
  "--env-file": "envFile",
  "--save-dir": "saveDirectory",
  "--game-dir": "gameDirectory",
  "--decoder-jar": "decoderJar",
  "--java": "javaExecutable",
} as const;

function parseCommandLine(args: readonly string[]): CommandLineOptions {
  const result: CommandLineOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) continue;

    const separator = argument.indexOf("=");
    const name = separator === -1 ? argument : argument.slice(0, separator);
    const inlineValue = separator === -1 ? undefined : argument.slice(separator + 1);
    const key = optionNames[name as keyof typeof optionNames];
    if (key === undefined) throw new Error(`Unknown option: ${name}`);

    const value = inlineValue ?? args[index + 1];
    if (inlineValue === undefined) index += 1;
    if (value === undefined || value.trim() === "" || value.startsWith("--")) {
      throw new Error(`Option ${name} requires a value`);
    }
    if (result[key] !== undefined) {
      throw new Error(`Option ${name} may only be specified once`);
    }
    result[key] = value;
  }

  return result;
}

export function resolveRuntimeConfiguration(
  args: readonly string[] = process.argv.slice(2),
  processEnvironment: NodeJS.ProcessEnv = process.env,
): RuntimeConfiguration {
  const options = parseCommandLine(args);
  const environmentFile = options.envFile ?? defaultEnvironmentFile;
  const fileEnvironment = readEnvironmentFile(
    environmentFile,
    options.envFile !== undefined,
  );
  const environment: NodeJS.ProcessEnv = {
    ...fileEnvironment,
    ...processEnvironment,
  };

  if (options.saveDirectory !== undefined) environment.DD_SAVE_DIR = options.saveDirectory;
  if (options.gameDirectory !== undefined) environment.DD_GAME_DIR = options.gameDirectory;
  if (options.decoderJar !== undefined) environment.DD_SAVE_EDITOR_JAR = options.decoderJar;
  if (options.javaExecutable !== undefined) environment.DD_JAVA_EXECUTABLE = options.javaExecutable;

  return { environment, environmentFile };
}
