import { spawn } from "node:child_process";

import type { SaveDecoder } from "./save-decoder.js";

export type CommandRunner = (
  executable: string,
  args: readonly string[],
) => Promise<void>;

export interface DdsSaveEditorOptions {
  jarPath: string;
  javaExecutable: string;
  runCommand?: CommandRunner;
}

export class DecoderProcessError extends Error {
  constructor(
    message: string,
    public readonly executable: string,
    public readonly args: readonly string[],
  ) {
    super(message);
    this.name = "DecoderProcessError";
  }
}

export const runCommand: CommandRunner = (executable, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(executable, [...args], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const stderr: Buffer[] = [];

    child.stdout.resume();
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      reject(
        new DecoderProcessError(
          `Failed to start save decoder: ${error.message}`,
          executable,
          args,
        ),
      );
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const detail = Buffer.concat(stderr).toString("utf8").trim();
      reject(
        new DecoderProcessError(
          `Save decoder exited with code ${String(code)}${detail === "" ? "" : `: ${detail}`}`,
          executable,
          args,
        ),
      );
    });
  });

export class DdsSaveEditorDecoder implements SaveDecoder {
  private readonly commandRunner: CommandRunner;

  constructor(private readonly options: DdsSaveEditorOptions) {
    this.commandRunner = options.runCommand ?? runCommand;
  }

  async decode(inputPath: string, outputPath: string): Promise<void> {
    await this.commandRunner(this.options.javaExecutable, [
      "-jar",
      this.options.jarPath,
      "decode",
      "--output",
      outputPath,
      inputPath,
    ]);
  }
}
