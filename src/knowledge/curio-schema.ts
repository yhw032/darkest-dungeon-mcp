import { z } from "zod";

import type { CurioKnowledgeBase } from "../domain/curio-knowledge.js";

const nonEmptyString = z.string().trim().min(1);

const outcomeSchema = z
  .object({
    type: z.enum([
      "loot",
      "stress",
      "health",
      "quirk",
      "disease",
      "status",
      "buff",
      "combat",
      "nothing",
      "other",
    ]),
    polarity: z.enum(["positive", "negative", "neutral", "mixed"]),
    description: nonEmptyString,
    chancePercent: z.number().min(0).max(100).optional(),
  })
  .strict();

const interactionSchema = z
  .object({
    item: nonEmptyString.nullable(),
    recommendation: z.enum(["recommended", "situational", "avoid"]),
    certainty: z.enum(["guaranteed", "possible"]),
    outcomes: z.array(outcomeSchema).min(1),
    note: nonEmptyString.optional(),
  })
  .strict();

const sourceSchema = z
  .object({
    title: nonEmptyString,
    url: z.url(),
    verifiedAt: z.iso.date(),
  })
  .strict();

const curioSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/),
    names: z
      .object({
        en: nonEmptyString,
        ko: nonEmptyString.optional(),
      })
      .strict(),
    aliases: z.array(nonEmptyString),
    regions: z
      .array(
        z.enum([
          "ruins",
          "warrens",
          "weald",
          "cove",
          "courtyard",
          "farmstead",
          "darkest_dungeon",
        ]),
      )
      .min(1),
    dlcs: z.array(nonEmptyString),
    interactions: z.array(interactionSchema).min(1),
    notes: z.array(nonEmptyString),
    sources: z.array(sourceSchema).min(1),
  })
  .strict();

const knowledgeBaseSchema = z
  .object({
    schemaVersion: z.literal(1),
    curios: z.array(curioSchema),
  })
  .strict()
  .superRefine(({ curios }, context) => {
    const ids = new Set<string>();
    curios.forEach((curio, index) => {
      if (ids.has(curio.id)) {
        context.addIssue({
          code: "custom",
          message: `duplicate curio id: ${curio.id}`,
          path: ["curios", index, "id"],
        });
      }
      ids.add(curio.id);
    });
  });

export class KnowledgeValidationError extends Error {
  constructor(
    message: string,
    public readonly path: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "KnowledgeValidationError";
  }
}

function formatPath(path: PropertyKey[]): string {
  return path.reduce<string>(
    (result, segment) =>
      typeof segment === "number"
        ? `${result}[${String(segment)}]`
        : `${result}.${String(segment)}`,
    "$",
  );
}

export function parseCurioKnowledge(value: unknown): CurioKnowledgeBase {
  const result = knowledgeBaseSchema.safeParse(value);
  if (result.success) return result.data as CurioKnowledgeBase;

  const issue = result.error.issues[0];
  if (issue === undefined) {
    throw new KnowledgeValidationError("invalid curio knowledge", "$");
  }

  const path = formatPath(issue.path);
  throw new KnowledgeValidationError(
    `Invalid curio knowledge at ${path}: ${issue.message}`,
    path,
    { cause: result.error },
  );
}

export function parseCurioKnowledgeJson(text: string): CurioKnowledgeBase {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch (error) {
    throw new KnowledgeValidationError("Invalid curio knowledge JSON", "$", {
      cause: error,
    });
  }
  return parseCurioKnowledge(value);
}
