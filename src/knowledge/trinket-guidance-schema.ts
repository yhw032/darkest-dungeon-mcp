import { z } from "zod";

import type { TrinketGuidanceKnowledgeBase } from "../domain/trinket-guidance.js";
import { KnowledgeValidationError } from "./curio-schema.js";

const nonEmptyString = z.string().trim().min(1);
const trinketId = z.string().regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/);

const trinketGuidanceEntrySchema = z
  .object({
    trinketId,
    tier: z.enum(["S", "A", "B", "situational", "trap"]),
    recommendedRoles: z.array(nonEmptyString),
    recommendedClasses: z.array(z.string()),
    synergies: z.array(nonEmptyString),
    cautions: z.array(nonEmptyString),
    playstyleAdvice: nonEmptyString,
  })
  .strict();

const knowledgeSchema = z
  .object({
    schemaVersion: z.literal(1),
    policy: z
      .object({
        title: nonEmptyString,
        disclaimer: nonEmptyString,
      })
      .strict(),
    trinkets: z.array(trinketGuidanceEntrySchema),
  })
  .strict()
  .superRefine(({ trinkets }, context) => {
    const ids = new Set<string>();
    trinkets.forEach((entry, index) => {
      if (ids.has(entry.trinketId)) {
        context.addIssue({
          code: "custom",
          message: `duplicate trinket id: ${entry.trinketId}`,
          path: ["trinkets", index, "trinketId"],
        });
      }
      ids.add(entry.trinketId);
    });
  });

function formatPath(path: PropertyKey[]): string {
  return path.reduce<string>(
    (result, segment) =>
      typeof segment === "number"
        ? `${result}[${String(segment)}]`
        : `${result}.${String(segment)}`,
    "$",
  );
}

export function parseTrinketGuidanceKnowledge(
  value: unknown,
): TrinketGuidanceKnowledgeBase {
  const result = knowledgeSchema.safeParse(value);
  if (result.success) return result.data as TrinketGuidanceKnowledgeBase;

  const issue = result.error.issues[0];
  if (issue === undefined) {
    throw new KnowledgeValidationError(
      "invalid trinket guidance knowledge",
      "$",
    );
  }
  const path = formatPath(issue.path);
  throw new KnowledgeValidationError(
    `Invalid trinket guidance knowledge at ${path}: ${issue.message}`,
    path,
    { cause: result.error },
  );
}

export function parseTrinketGuidanceKnowledgeJson(
  text: string,
  source = "trinkets.json",
): TrinketGuidanceKnowledgeBase {
  try {
    return parseTrinketGuidanceKnowledge(JSON.parse(text));
  } catch (error) {
    if (error instanceof KnowledgeValidationError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new KnowledgeValidationError(
      `Failed to parse ${source}: ${message}`,
      "$",
      { cause: error },
    );
  }
}
