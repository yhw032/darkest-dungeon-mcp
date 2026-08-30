type JsonRecord = Record<string, unknown>;

export class SaveValidationError extends Error {
  constructor(
    message: string,
    public readonly path: string,
  ) {
    super(`${path}: ${message}`);
    this.name = "SaveValidationError";
  }
}

export function expectRecord(value: unknown, path: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SaveValidationError("expected an object", path);
  }

  return value as JsonRecord;
}

export function expectNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new SaveValidationError("expected a finite number", path);
  }

  return value;
}

export function expectString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    throw new SaveValidationError("expected a string", path);
  }

  return value;
}

export function expectBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    throw new SaveValidationError("expected a boolean", path);
  }

  return value;
}

export function optionalBoolean(
  value: unknown,
  path: string,
  fallback = false,
): boolean {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "boolean") {
    throw new SaveValidationError("expected a boolean", path);
  }

  return value;
}
