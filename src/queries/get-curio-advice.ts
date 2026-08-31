import type {
  CurioInteraction,
  CurioKnowledge,
  CurioKnowledgeBase,
} from "../domain/curio-knowledge.js";
import {
  normalizeKnowledgeTerm,
  searchCurios,
  type CurioSummary,
} from "./search-curios.js";

export interface CurioAdviceRequest {
  curioId?: string;
  name?: string;
  availableItems?: string[];
}

export interface CurioAdvice {
  status: "found";
  curio: CurioKnowledge;
  usableInteractions: CurioInteraction[];
  recommendedInteraction: CurioInteraction | null;
  warnings: string[];
}

export interface CurioAdviceNotFound {
  status: "not_found";
  query: string;
}

export interface CurioAdviceAmbiguous {
  status: "ambiguous";
  query: string;
  candidates: CurioSummary[];
}

export interface CurioAdviceInvalidRequest {
  status: "invalid_request";
  message: string;
}

export type CurioAdviceResult =
  | CurioAdvice
  | CurioAdviceNotFound
  | CurioAdviceAmbiguous
  | CurioAdviceInvalidRequest;

function canonicalItem(value: string): string {
  return normalizeKnowledgeTerm(value).replace(/\s+/g, "_");
}

function resolveCurio(
  knowledge: CurioKnowledgeBase,
  request: CurioAdviceRequest,
):
  | { status: "found"; curio: CurioKnowledge }
  | CurioAdviceNotFound
  | CurioAdviceAmbiguous
  | CurioAdviceInvalidRequest {
  const hasId = request.curioId !== undefined;
  const hasName = request.name !== undefined;
  if (hasId === hasName) {
    return {
      status: "invalid_request",
      message: "Provide exactly one of curioId or name.",
    };
  }

  if (request.curioId !== undefined) {
    const normalizedId = canonicalItem(request.curioId);
    const curio = knowledge.curios.find(
      (candidate) => canonicalItem(candidate.id) === normalizedId,
    );
    return curio === undefined
      ? { status: "not_found", query: request.curioId }
      : { status: "found", curio };
  }

  const name = request.name!;
  const candidates = searchCurios(knowledge, { query: name });
  if (candidates.length === 0) return { status: "not_found", query: name };
  if (candidates.length > 1) {
    return { status: "ambiguous", query: name, candidates };
  }

  const id = candidates[0]!.id;
  return {
    status: "found",
    curio: knowledge.curios.find((curio) => curio.id === id)!,
  };
}

export function getCurioAdvice(
  knowledge: CurioKnowledgeBase,
  request: CurioAdviceRequest,
): CurioAdviceResult {
  const resolved = resolveCurio(knowledge, request);
  if (resolved.status !== "found") return resolved;

  const availableItems =
    request.availableItems === undefined
      ? undefined
      : new Set(request.availableItems.map(canonicalItem));
  const usableInteractions = resolved.curio.interactions.filter(
    (interaction) =>
      availableItems === undefined ||
      interaction.item === null ||
      availableItems.has(canonicalItem(interaction.item)),
  );
  const recommendedInteraction =
    usableInteractions.find(
      (interaction) => interaction.recommendation === "recommended",
    ) ?? null;
  const warnings = usableInteractions
    .filter((interaction) => interaction.recommendation === "avoid")
    .map(
      (interaction) =>
        interaction.note ??
        `Avoid the ${interaction.item ?? "no-item"} interaction.`,
    );

  if (
    availableItems !== undefined &&
    recommendedInteraction === null &&
    resolved.curio.interactions.some(
      (interaction) => interaction.recommendation === "recommended",
    )
  ) {
    warnings.unshift(
      "None of the supplied items enables a recommended interaction.",
    );
  }

  return {
    status: "found",
    curio: resolved.curio,
    usableInteractions,
    recommendedInteraction,
    warnings,
  };
}
