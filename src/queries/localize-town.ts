import type { BuildingUpgradeProgress } from "../domain/building-upgrades.js";
import {
  localizeBuildingUpgradeTree,
  localizeDistrict,
  localizeInventoryItem,
  localizeTownActivity,
  localizeTownBuilding,
  type GameLanguage,
  type GameLocalization,
} from "../localization/game-localization.js";
import type { HeroTownContext } from "./get-hero-town-context.js";
import type { TownSummary } from "./get-town-summary.js";

export function localizeHeroTownContext(
  context: HeroTownContext,
  language: GameLanguage,
  localization?: GameLocalization,
) {
  return {
    buildingId: context.buildingName,
    buildingName:
      context.buildingName === null
        ? null
        : localizeTownBuilding(context.buildingName, language, localization),
    activityAssignments: context.activityAssignments.map((assignment) => ({
      ...assignment,
      buildingName: localizeTownBuilding(
        assignment.buildingId,
        language,
        localization,
      ),
      activityName: localizeTownActivity(
        assignment.activityId,
        language,
        localization,
      ),
    })),
  };
}

export function localizeBuildingUpgradeProgress(
  progress: BuildingUpgradeProgress,
  language: GameLanguage,
  localization?: GameLocalization,
) {
  return {
    ...progress,
    treeName: localizeBuildingUpgradeTree(
      progress.treeId,
      language,
      localization,
    ),
    buildingName: localizeTownBuilding(
      progress.buildingId,
      language,
      localization,
    ),
    nextRequirement:
      progress.nextRequirement === null
        ? null
        : {
            ...progress.nextRequirement,
            currencyCost: progress.nextRequirement.currencyCost.map((cost) => ({
              ...cost,
              name: localizeInventoryItem(
                "heirloom",
                cost.type,
                language,
                localization,
              ),
            })),
          },
  };
}

export function localizeTownSummary<T extends Pick<TownSummary, "builtDistricts">>(
  summary: T,
  language: GameLanguage,
  localization?: GameLocalization,
): T & { builtDistrictDetails: Array<{ id: string; name: string | null }> } {
  return {
    ...summary,
    builtDistrictDetails: summary.builtDistricts.map((id) => ({
      id,
      name: localizeDistrict(id, language, localization),
    })),
  };
}
