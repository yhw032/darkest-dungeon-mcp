import { z } from "zod";

import type { QuirkTreatmentKnowledgeBase } from "../domain/quirk-treatment-knowledge.js";
import { KnowledgeValidationError } from "./curio-schema.js";

const nonEmptyString = z.string().trim().min(1);
const quirkId = z.string().regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/);

const sourceSchema = z
  .object({
    title: nonEmptyString,
    reference: nonEmptyString,
  })
  .strict();

const ruleSchema = z
  .object({
    quirkId,
    priority: z.enum(["critical", "high", "medium", "low"]),
    factors: z
      .array(
        z.enum([
          "forced_curio_interaction",
          "loot_loss",
          "resource_loss",
          "combat_penalty",
          "stress_penalty",
          "disease",
          "other",
        ]),
      )
      .min(1)
      .refine((factors) => new Set(factors).size === factors.length, {
        message: "factors must be unique",
      }),
    reasons: z.array(nonEmptyString).min(1),
    notes: z.array(nonEmptyString),
    sources: z.array(sourceSchema).min(1),
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
    rules: z.array(ruleSchema),
  })
  .strict()
  .superRefine(({ rules }, context) => {
    const ids = new Set<string>();
    rules.forEach((rule, index) => {
      if (ids.has(rule.quirkId)) {
        context.addIssue({
          code: "custom",
          message: `duplicate quirk id: ${rule.quirkId}`,
          path: ["rules", index, "quirkId"],
        });
      }
      ids.add(rule.quirkId);
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

export function parseQuirkTreatmentKnowledge(
  value: unknown,
): QuirkTreatmentKnowledgeBase {
  const result = knowledgeSchema.safeParse(value);
  if (result.success) return result.data as QuirkTreatmentKnowledgeBase;

  const issue = result.error.issues[0];
  if (issue === undefined) {
    throw new KnowledgeValidationError(
      "invalid quirk treatment knowledge",
      "$",
    );
  }
  const path = formatPath(issue.path);
  throw new KnowledgeValidationError(
    `Invalid quirk treatment knowledge at ${path}: ${issue.message}`,
    path,
    { cause: result.error },
  );
}

export function parseQuirkTreatmentKnowledgeJson(
  text: string,
): QuirkTreatmentKnowledgeBase {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch (error) {
    throw new KnowledgeValidationError(
      "Invalid quirk treatment knowledge JSON",
      "$",
      { cause: error },
    );
  }
  return parseQuirkTreatmentKnowledge(value);
}
