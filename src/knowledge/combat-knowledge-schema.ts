import { z } from "zod";

import type { CombatKnowledgeBase } from "../domain/combat-knowledge.js";

const nonEmptyString = z.string().trim().min(1);
const identifier = z.string().regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/);

function uniqueStrings(message: string) {
  return z.array(nonEmptyString).refine(
    (values) => new Set(values).size === values.length,
    { message },
  );
}

const regionIdSchema = z.enum([
  "ruins",
  "warrens",
  "weald",
  "cove",
  "courtyard",
  "farmstead",
  "darkest_dungeon",
]);
const threatTypeSchema = z.enum([
  "health_damage",
  "stress",
  "bleed",
  "blight",
  "disease",
  "stun",
  "mark",
  "debuff",
  "movement",
  "guard",
  "summon",
  "stealth",
  "healing",
  "other",
]);
const sourceSchema = z
  .object({
    title: nonEmptyString,
    url: z.url(),
    verifiedAt: z.iso.date(),
  })
  .strict();
const regionSchema = z
  .object({
    id: regionIdSchema,
    dlcs: uniqueStrings("dlcs must be unique"),
    overview: nonEmptyString,
    commonThreats: z
      .array(
        z
          .object({
            id: identifier,
            type: threatTypeSchema,
            description: nonEmptyString,
            counters: uniqueStrings("counters must be unique").min(1),
          })
          .strict(),
      )
      .min(1),
    resistanceTendencies: z.array(
      z
        .object({
          effect: z.enum(["bleed", "blight", "stun", "debuff", "move"]),
          tendency: z.enum(["low", "mixed", "high"]),
          note: nonEmptyString,
        })
        .strict(),
    ),
    recommendedCapabilities: uniqueStrings(
      "recommendedCapabilities must be unique",
    ).min(1),
    cautions: uniqueStrings("cautions must be unique"),
    sources: z.array(sourceSchema).min(1),
  })
  .strict()
  .superRefine((region, context) => {
    checkUniqueBy(
      region.commonThreats,
      ({ id }) => id,
      "duplicate threat id",
      "commonThreats",
      context,
    );
    checkUniqueBy(
      region.resistanceTendencies,
      ({ effect }) => effect,
      "duplicate resistance tendency",
      "resistanceTendencies",
      context,
    );
  });

const enemySchema = z
  .object({
    id: identifier,
    enemyType: z.enum(["common", "elite", "miniboss"]),
    localizationId: nonEmptyString,
    aliases: uniqueStrings("aliases must be unique"),
    regions: z
      .array(regionIdSchema)
      .min(1)
      .refine((regions) => new Set(regions).size === regions.length, {
        message: "regions must be unique",
      }),
    dlcs: uniqueStrings("dlcs must be unique"),
    priority: z.enum(["low", "medium", "high", "critical"]),
    priorityReasons: uniqueStrings("priorityReasons must be unique").min(1),
    traits: uniqueStrings("traits must be unique"),
    dangerousActions: z.array(
        z
          .object({
            id: identifier,
            localizationIds: uniqueStrings("localizationIds must be unique").min(1),
          threats: z
            .array(threatTypeSchema)
            .min(1)
            .refine((threats) => new Set(threats).size === threats.length, {
              message: "threats must be unique",
            }),
          description: nonEmptyString,
          counters: uniqueStrings("counters must be unique").min(1),
        })
        .strict(),
    ),
    effectiveResponses: uniqueStrings("effectiveResponses must be unique").min(
      1,
    ),
    cautions: uniqueStrings("cautions must be unique"),
    sources: z.array(sourceSchema).min(1),
  })
  .strict()
  .superRefine((enemy, context) => {
    checkUniqueBy(
      enemy.dangerousActions,
      ({ id }) => id,
      "duplicate dangerous action id",
      "dangerousActions",
      context,
    );
  });

function checkUniqueBy<T>(
  values: T[],
  key: (value: T) => string,
  message: string,
  path: string,
  context: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    const itemKey = key(value);
    if (seen.has(itemKey)) {
      context.addIssue({
        code: "custom",
        message: `${message}: ${itemKey}`,
        path: [path, index],
      });
    }
    seen.add(itemKey);
  });
}

const knowledgeBaseSchema = z
  .object({
    schemaVersion: z.literal(2),
    regions: z.array(regionSchema),
    enemies: z.array(enemySchema),
  })
  .strict()
  .superRefine((knowledge, context) => {
    checkUniqueBy(
      knowledge.regions,
      ({ id }) => id,
      "duplicate region id",
      "regions",
      context,
    );
    checkUniqueBy(
      knowledge.enemies,
      ({ id }) => id,
      "duplicate enemy id",
      "enemies",
      context,
    );
    const regionIds = new Set(knowledge.regions.map(({ id }) => id));
    knowledge.enemies.forEach((enemy, enemyIndex) => {
      enemy.regions.forEach((region, regionIndex) => {
        if (!regionIds.has(region)) {
          context.addIssue({
            code: "custom",
            message: `enemy references missing region: ${region}`,
            path: ["enemies", enemyIndex, "regions", regionIndex],
          });
        }
      });
    });
  });

export class CombatKnowledgeValidationError extends Error {
  constructor(
    message: string,
    public readonly path: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "CombatKnowledgeValidationError";
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

export function parseCombatKnowledge(value: unknown): CombatKnowledgeBase {
  const result = knowledgeBaseSchema.safeParse(value);
  if (result.success) return result.data as CombatKnowledgeBase;

  const issue = result.error.issues[0];
  if (issue === undefined) {
    throw new CombatKnowledgeValidationError("invalid combat knowledge", "$");
  }
  const path = formatPath(issue.path);
  throw new CombatKnowledgeValidationError(
    `Invalid combat knowledge at ${path}: ${issue.message}`,
    path,
    { cause: result.error },
  );
}

export function parseCombatKnowledgeJson(text: string): CombatKnowledgeBase {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch (error) {
    throw new CombatKnowledgeValidationError(
      "Invalid combat knowledge JSON",
      "$",
      { cause: error },
    );
  }
  return parseCombatKnowledge(value);
}
