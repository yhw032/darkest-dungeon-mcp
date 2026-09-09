import { z } from "zod";

import type { QuirkTreatmentKnowledgeBase } from "../domain/quirk-treatment-knowledge.js";
import { KnowledgeValidationError } from "./curio-schema.js";

const nonEmptyString = z.string().trim().min(1);
const quirkId = z.string().regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/);

const sourceSchema = z
  .object({
    kind: z.enum(["game", "wiki", "community"]),
    title: nonEmptyString,
    reference: nonEmptyString,
    verifiedAt: z.iso.date(),
  })
  .strict();

const ruleBase = {
  quirkId,
  priority: z.enum(["critical", "high", "medium", "low"]),
  reasons: z.array(nonEmptyString).min(1),
  notes: z.array(nonEmptyString),
  sources: z.array(sourceSchema).min(1),
} as const;

const negativeRuleSchema = z
  .object({
    ...ruleBase,
    action: z.literal("remove_negative"),
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
  })
  .strict();

const positiveRuleSchema = z
  .object({
    ...ruleBase,
    action: z.literal("lock_positive"),
    factors: z
      .array(
        z.enum([
          "accuracy",
          "critical",
          "damage",
          "durability",
          "healing",
          "resistance",
          "scouting",
          "speed",
          "stress_control",
          "town",
          "other",
        ]),
      )
      .min(1)
      .refine((factors) => new Set(factors).size === factors.length, {
        message: "factors must be unique",
      }),
    applicability: z.enum([
      "universal",
      "hero_class",
      "build",
      "region",
      "conditional",
    ]),
    heroClasses: z
      .array(quirkId)
      .refine((classes) => new Set(classes).size === classes.length, {
        message: "heroClasses must be unique",
      }),
    cautions: z.array(nonEmptyString),
  })
  .strict();

const ruleSchema = z.discriminatedUnion("action", [
  negativeRuleSchema,
  positiveRuleSchema,
]);

const knowledgeSchema = z
  .object({
    schemaVersion: z.literal(2),
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
