import { z } from "zod";

import type { ClassKnowledgeBase } from "../domain/class-knowledge.js";

const nonEmptyString = z.string().trim().min(1);
const identifier = z.string().regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/);

function uniqueStrings(message: string) {
  return z.array(nonEmptyString).refine(
    (values) => new Set(values).size === values.length,
    { message },
  );
}

const sourceSchema = z
  .object({
    title: nonEmptyString,
    url: z.url(),
    verifiedAt: z.iso.date(),
  })
  .strict();

const positionGuidanceSchema = z
  .object({
    positions: z
      .array(z.number().int().min(1).max(4))
      .min(1)
      .refine((positions) => new Set(positions).size === positions.length, {
        message: "positions must be unique",
      }),
    recommendation: z.enum([
      "preferred",
      "viable",
      "situational",
      "avoid",
    ]),
    reason: nonEmptyString,
  })
  .strict();

const mechanicSchema = z
  .object({
    id: identifier,
    description: nonEmptyString,
  })
  .strict();

const skillGuidanceSchema = z
  .object({
    skillId: identifier,
    useCases: uniqueStrings("useCases must be unique"),
    synergies: uniqueStrings("synergies must be unique"),
    cautions: uniqueStrings("cautions must be unique"),
  })
  .strict();

const partySynergySchema = z
  .object({
    heroClassId: identifier,
    reasons: uniqueStrings("reasons must be unique").min(1),
  })
  .strict();

const classSchema = z
  .object({
    id: identifier,
    names: z
      .object({
        en: nonEmptyString,
        ko: nonEmptyString.optional(),
      })
      .strict(),
    aliases: uniqueStrings("aliases must be unique"),
    dlcs: uniqueStrings("dlcs must be unique"),
    summary: nonEmptyString,
    roles: uniqueStrings("roles must be unique").min(1),
    strengths: uniqueStrings("strengths must be unique").min(1),
    limitations: uniqueStrings("limitations must be unique"),
    positionGuidance: z.array(positionGuidanceSchema).min(1),
    mechanics: z.array(mechanicSchema),
    skillGuidance: z.array(skillGuidanceSchema),
    partySynergies: z.array(partySynergySchema),
    sources: z.array(sourceSchema).min(1),
  })
  .strict()
  .superRefine((knowledge, context) => {
    for (const [field, values] of [
      ["mechanics", knowledge.mechanics.map(({ id }) => id)],
      ["skillGuidance", knowledge.skillGuidance.map(({ skillId }) => skillId)],
      [
        "partySynergies",
        knowledge.partySynergies.map(({ heroClassId }) => heroClassId),
      ],
    ] as const) {
      const seen = new Set<string>();
      values.forEach((value, index) => {
        if (seen.has(value)) {
          context.addIssue({
            code: "custom",
            message: `duplicate ${field} id: ${value}`,
            path: [field, index],
          });
        }
        seen.add(value);
      });
    }
  });

const knowledgeBaseSchema = z
  .object({
    schemaVersion: z.literal(1),
    classes: z.array(classSchema),
  })
  .strict()
  .superRefine(({ classes }, context) => {
    const ids = new Set<string>();
    classes.forEach(({ id }, index) => {
      if (ids.has(id)) {
        context.addIssue({
          code: "custom",
          message: `duplicate class id: ${id}`,
          path: ["classes", index, "id"],
        });
      }
      ids.add(id);
    });
  });

export class ClassKnowledgeValidationError extends Error {
  constructor(
    message: string,
    public readonly path: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ClassKnowledgeValidationError";
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

export function parseClassKnowledge(value: unknown): ClassKnowledgeBase {
  const result = knowledgeBaseSchema.safeParse(value);
  if (result.success) return result.data as ClassKnowledgeBase;

  const issue = result.error.issues[0];
  if (issue === undefined) {
    throw new ClassKnowledgeValidationError("invalid class knowledge", "$");
  }

  const path = formatPath(issue.path);
  throw new ClassKnowledgeValidationError(
    `Invalid class knowledge at ${path}: ${issue.message}`,
    path,
    { cause: result.error },
  );
}

export function parseClassKnowledgeJson(text: string): ClassKnowledgeBase {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch (error) {
    throw new ClassKnowledgeValidationError(
      "Invalid class knowledge JSON",
      "$",
      { cause: error },
    );
  }
  return parseClassKnowledge(value);
}
