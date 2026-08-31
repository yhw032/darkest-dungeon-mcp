export interface SaveDecoder {
  decode(inputPath: string, outputPath: string): Promise<void>;
}
