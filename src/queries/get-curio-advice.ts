import type {
  CurioInteraction,
  CurioKnowledge,
  CurioKnowledgeBase,
} from "../domain/curio-knowledge.js";
import {
  localizeCurio,
  localizeProvisionItem,
  type GameLanguage,
  type GameLocalization,
} from "../localization/game-localization.js";
import { gameLanguageCodes } from "../localization/languages.js";
import {
  normalizeKnowledgeTerm,
  searchCurios,
  type CurioSummary,
} from "./search-curios.js";

export interface CurioAdviceRequest {
  curioId?: string;
  name?: string;
  availableItems?: string[];
  language?: GameLanguage;
}

export type LocalizedCurioKnowledge = Omit<CurioKnowledge, "localizationId"> & {
  name: string | null;
};

export interface CurioAdvice {
  status: "found";
  curio: LocalizedCurioKnowledge;
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

function resolveAvailableItems(
  suppliedItems: string[],
  interactions: CurioInteraction[],
  localization?: GameLocalization,
): Set<string> {
  const supplied = new Set(suppliedItems.map(canonicalItem));
  const resolved = new Set(supplied);
  const interactionItemIds = new Set(
    interactions
      .map((interaction) => interaction.item)
      .filter((item): item is string => item !== null),
  );

  for (const itemId of interactionItemIds) {
    const aliases = [
      itemId,
      ...gameLanguageCodes.map((language) =>
        localizeProvisionItem(itemId, language, localization),
      ),
    ].filter((alias): alias is string => alias !== null);
    if (aliases.some((alias) => supplied.has(canonicalItem(alias)))) {
      resolved.add(canonicalItem(itemId));
    }
  }
  return resolved;
}

function resolveCurio(
  knowledge: CurioKnowledgeBase,
  request: CurioAdviceRequest,
  localization?: GameLocalization,
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
  const language = request.language ?? "en";
  const candidates = searchCurios(
    knowledge,
    { query: name, language },
    localization,
  );
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

function toLocalizedCurio(
  curio: CurioKnowledge,
  language: GameLanguage = "en",
  localization?: GameLocalization,
): LocalizedCurioKnowledge {
  const { localizationId: _localizationId, ...rest } = curio;
  return {
    ...rest,
    name: localizeCurio(curio.localizationId ?? curio.id, language, localization),
  };
}

export function getCurioAdvice(
  knowledge: CurioKnowledgeBase,
  request: CurioAdviceRequest,
  localization?: GameLocalization,
): CurioAdviceResult {
  const resolved = resolveCurio(knowledge, request, localization);
  if (resolved.status !== "found") return resolved;

  const language = request.language ?? "en";
  const availableItems =
    request.availableItems === undefined
      ? undefined
      : resolveAvailableItems(
          request.availableItems,
          resolved.curio.interactions,
          localization,
        );
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
    curio: toLocalizedCurio(resolved.curio, language, localization),
    usableInteractions,
    recommendedInteraction,
    warnings,
  };
}
