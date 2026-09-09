# Quirk management evidence policy

This document defines how the server may recommend removing negative quirks or
locking positive quirks without presenting editorial judgments as game facts.

## Scope

- Cover Darkest Dungeon 1 base-game and installed official DLC quirks.
- Treat installed game definitions as the authority for IDs, polarity, effects,
  conditions, incompatibilities, replaceability, and localization.
- Do not infer a value for an undocumented numeric field.
- Do not read or modify a live save while building or testing the knowledge set.
- Treat mod quirks as unsupported until a separate, explicit mod policy exists.

The inspected installation currently contains 213 definitions: 91 positive and
122 negative. This count is an audit observation, not a hard-coded invariant.

## Source hierarchy

1. Installed game data establishes mechanical facts:
   `shared/quirk/quirk_library.json`, `shared/buffs/base.buffs.json`,
   `shared/rules.json`, official DLC equivalents, and localization tables.
2. The [official Darkest Dungeon Wiki quirk reference](https://darkestdungeon.wiki.gg/wiki/Quirks)
   is used to cross-check readable effect descriptions, acquisition, replacement,
   and special-case behavior.
3. The [official Darkest Dungeon Wiki Sanitarium reference](https://darkestdungeon.wiki.gg/wiki/Sanitarium)
   is used to cross-check treatment workflow and cost context.
4. Community guides and discussions may support an editorial recommendation,
   but never establish a game mechanic. Disagreement must be represented as a
   caution or a situational rating rather than silently resolved as fact.

Every curated rule must record its sources and verification date. Source text is
summarized; it is not copied into the repository.

## Verified management constraints

- Installed `shared/rules.json` sets `quirks_max_locked_positive` to `3`.
- Installed quirk definitions mark some special positive quirks as not
  replaceable. A non-replaceable quirk must not be recommended for Sanitarium
  locking even if it is strategically valuable.
- Save `isLocked` state determines whether an ordinary positive quirk already
  occupies a locked slot.
- A recommendation must distinguish removal, locking, keeping an existing lock,
  and taking no action.

## Recommendation categories

Negative and positive recommendations remain separate because the same priority
has different consequences:

- `remove_negative`: reduce a verified downside or forced behavior.
- `lock_positive`: protect a replaceable positive quirk from replacement.
- `keep_locked`: retain an already locked positive quirk.
- `do_not_prioritize`: preserve resources or lock capacity for a better option.
- `unrated`: expose the quirk without inventing a recommendation.

Positive value is classified by applicability:

- `universal`: broadly useful without relying on a specific class or route.
- `hero_class`: valuable only for explicitly listed classes.
- `build`: depends on a verified attack, healing, or party role.
- `region`: primarily useful in a particular dungeon or against an enemy type.
- `conditional`: depends on health, torchlight, stress, or another runtime state.

## Priority rubric

Priority is editorial guidance, not a value supplied by the game.

- `critical`: unusually costly to lose or an immediate negative-quirk threat.
- `high`: strong, repeatable value with clear applicability to the hero.
- `medium`: useful but narrower, replaceable, redundant, or resource-dependent.
- `low`: limited expected value or poor fit for the hero's verified capabilities.

For positive quirks, the analyzer must consider effect magnitude, activation
frequency, class or build compatibility, overlap with existing locked quirks,
and remaining lock capacity. It must not treat a community tier as sufficient
evidence by itself.

## Integration rules

- Expedition scoring may penalize only `remove_negative` rules.
- Positive quirks may produce evidence and cautions, but must not receive an
  arbitrary numeric expedition bonus without a separately verified scoring rule.
- Hero comparison must label negative risk and positive assets separately.
- Missing definitions, unsupported mods, and unrated quirks remain explicit.
- Official localized names are presentation data; recommendation reasons remain
  editorial source material for the client to summarize in the user's language.
