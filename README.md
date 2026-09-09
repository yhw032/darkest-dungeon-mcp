# Darkest Dungeon MCP

A read-only Model Context Protocol (MCP) server for inspecting **Darkest Dungeon 1** save data and retrieving verified gameplay knowledge.

The server decodes copied save files into a temporary directory, validates the decoded JSON, and exposes normalized campaign data without modifying the original saves. It also includes curated knowledge for curios, classes, combat, trinkets, camping skills, quirk treatment, and building-upgrade priorities.

This is an unofficial fan project. It is not affiliated with, endorsed by, or sponsored by Red Hook Studios or the Official Darkest Dungeon Wiki.

## Requirements

- Node.js 20.12 or later
- For live saves: Java through `PATH`, `JAVA_HOME`, or `--java`, plus
  [`DDSaveEditor.jar`](https://github.com/robojumper/DarkestDungeonSaveEditor)
- A PC installation of Darkest Dungeon 1 for official localization, building
  and trinket definitions, combat skill details, hero progression and quest
  restrictions, and quirk definitions

## Installation

```powershell
npm install
npm run build
```

Download `DDSaveEditor.jar`, then add the built stdio entrypoint to your MCP
client. This commonly supported `mcpServers` shape works with Claude Desktop,
Claude Code project configuration, Google Antigravity, and many other clients:

```json
{
  "mcpServers": {
    "darkest-dungeon": {
      "command": "node",
      "args": [
        "C:/absolute/path/to/darkest-dungeon-mcp/dist/mcp/stdio.js",
        "--save-dir",
        "C:/path/to/Steam/userdata/STEAM_USER_ID/262060/remote/profile_0",
        "--game-dir",
        "C:/path/to/Steam/steamapps/common/DarkestDungeon",
        "--decoder-jar",
        "C:/absolute/path/to/DDSaveEditor.jar"
      ]
    }
  }
}
```

Codex uses TOML instead of the JSON wrapper. Add this to
`~/.codex/config.toml` for a user-level installation:

```toml
[mcp_servers.darkest_dungeon]
command = "node"
args = [
  "C:/absolute/path/to/darkest-dungeon-mcp/dist/mcp/stdio.js",
  "--save-dir", "C:/path/to/profile_0",
  "--game-dir", "C:/path/to/DarkestDungeon",
  "--decoder-jar", "C:/absolute/path/to/DDSaveEditor.jar",
]
startup_timeout_sec = 20
tool_timeout_sec = 120
```

Restart the client after saving its configuration, then inspect its MCP server
list or ask it to call `get_game_state`. See
[MCP client configuration](docs/CLIENT_CONFIGURATION.md) for exact locations,
commands, and troubleshooting instructions for Codex, Claude Code, Claude
Desktop, Google Antigravity, OpenClaw, and generic stdio clients.

`--save-dir` selects the live profile. Without it, the server uses the
checked-in decoded samples. `--game-dir` enables official localized names plus
verified building upgrades, trinket metadata and filters, combat skill details,
hero resolve levels, quest eligibility, and quirk analysis. The original profile
remains untouched: supported save files are copied to a temporary directory
before decoding.

## Server options

The stdio entrypoint accepts configuration directly and does not require a
particular working directory:

```powershell
node C:\absolute\path\to\dist\mcp\stdio.js --save-dir "C:\path\to\profile_0" --game-dir "C:\path\to\DarkestDungeon" --decoder-jar "C:\path\to\DDSaveEditor.jar"
```

Available options are `--env-file`, `--save-dir`, `--game-dir`,
`--decoder-jar`, and `--java`. Command-line options take precedence over
process environment variables, which take precedence over an optional `.env`
next to the installed package. Java is discovered through `PATH` or
`JAVA_HOME` when `--java` is omitted.

## Development

`npm run mcp` runs the TypeScript source directly. The project-scoped
`.codex/config.toml` registers it as `darkest_dungeon_dev`, keeping it distinct
from an installed user-level `darkest_dungeon` server. After installing
dependencies, restart Codex and inspect `/mcp` to use it.

For repeated local development, `.env` remains an optional convenience rather
than an installation requirement:

```powershell
Copy-Item .env.example .env
```

It supports `DD_SAVE_DIR`, `DD_GAME_DIR`, `DD_SAVE_EDITOR_JAR`, and
`DD_JAVA_EXECUTABLE`. The local file and decoder JAR are ignored by Git. Do not
commit personal paths or save data.

Useful development checks:

```powershell
npm run typecheck
npm test
npm run test:package
git diff --check
```

`npm pack` creates an installable package exposing the `darkest-dungeon-mcp`
executable. The project uses strict TypeScript, ESM, and Node's built-in test
runner through `tsx`. Tests never access the user's live save directory.

## MCP tools

| Tool | Purpose |
| --- | --- |
| `refresh_game_state` | Reload the shared read-only save snapshot before a new analysis when the campaign has changed. |
| `get_game_state` | Return a combined campaign summary with localized estate resources, class counts, dungeon quest counts, and built-district names. |
| `list_building_upgrades` | List building upgrades and costs with localized building, tree, and heirloom names. |
| `recommend_quirk_management` | Separate negative-quirk removals from positive-quirk lock guidance with priorities, lock capacity, evidence, and localized quirk text. |
| `list_heroes` | Filter heroes by class, roster status, stress, party availability, and optional quest eligibility; localize class names with `language`. |
| `get_hero` | Return one hero with localized class, combat-skill, equipped-trinket, quirk, disease, affliction, and virtue names, resolve level, availability, optional quest eligibility, and town activity. |
| `compare_heroes` | Compare 2–8 heroes using localized class, skill, and risky-quirk names plus objective readiness, equipment, skill-position, and curated quirk-risk evidence. |
| `list_quests` | Filter available quests with localized titles, objectives, regions, lengths, and reward names. |
| `get_quest` | Return one quest by ID with localized official quest and reward text. |
| `list_trinkets` | Query up to `limit` trinkets across storage, heroes, and stores by ID, localized name, hero class eligibility, or rarity; class and rarity filters require `DD_GAME_DIR`. |
| `recommend_trinkets` | Recommend optimal trinkets for a hero or class, or match candidate heroes for a specific trinket based on estate ownership, tier rankings, and synergies. |
| `plan_expedition` | Build a quest briefing with verified eligibility, role pools, provisions, camping, and tactical guidance. |
| `recommend_building_upgrades` | Rank estate upgrades using current heirlooms, verified costs, exchange feasibility, and curated priorities. |
| `query_classes` | Query verified class guidance with official class, skill, and synergy names localized from the installed game. |
| `query_combat` | Query verified region and enemy guidance by name, region, threat type, or priority. |
| `search_curios` | Search verified curios by ID, localized name, alias, or region. |
| `get_curio_advice` | Return item-aware interaction advice and warnings with localized curio names. |

Live save tools reuse one read-only snapshot for up to two minutes so that a
multi-tool analysis observes a consistent campaign state and does not repeatedly
decode the profile. Call `refresh_game_state` when the user reports an in-game
change and a fresh snapshot is needed. Refreshing only replaces the server's
in-memory snapshot; it never writes to the game profile. Sample mode uses a
stable snapshot until explicitly refreshed.

### Localization

Tools with a `language` input accept `en`, `fr`, `de`, `es`, `pt-BR`, `ru`,
`pl`, `cs`, `it`, `zh-CN`, `ja`, and `ko`; the default is `en`. These codes
map to the language IDs verified in the installed Darkest Dungeon 1 string
tables. Official display names are returned only when the corresponding game
string exists; otherwise the localized field is `null` or the documented
stable-ID fallback is used. Stable internal IDs remain available in either
case. Curated strategy, priority, and policy prose remains English source
material for the MCP client to summarize in the user's language.

Curio coverage includes shared curios, Ruins, Warrens, Weald, Cove, Courtyard, Farmstead, Darkest Dungeon, Old Road, and relevant Hamlet quests. Retired curios that are no longer used by the game are intentionally excluded. `search_curios` and `get_curio_advice` resolve official curio names from `DD_GAME_DIR`; `availableItems` accepts internal IDs or official display names in any supported language. The curated knowledge set retains search aliases and language-neutral interaction outcomes and advice.

Class knowledge covers all 18 playable Darkest Dungeon 1 classes and all 126 combat skills. `query_classes` resolves official class and skill names from `DD_GAME_DIR`; the knowledge set retains only search aliases and language-neutral strategy guidance. Skill guidance uses internal IDs verified against the installed game definitions and describes use cases, synergies, and cautions without duplicating exact position or target data.

`list_heroes`, `get_hero`, and `compare_heroes` accept `language`. When
`DD_GAME_DIR` is configured, `heroClassName`, combat skill `name`,
camping skill `name`, equipped trinket `name`, `quirks[].name`, `afflictionName`, and
`virtueName` values come directly from the installed game's localization files; stable
internal IDs remain available alongside them. In `get_hero`, `equippedTrinkets`
also includes official `rarity`, `heroClassRequirements`, class compatibility
`isUsableByHeroClass`, and stat `effects`. `campingSkillDetails` provides official
skill names, respite point costs, nighttime ambush prevention flags, disease cure flags,
and categorized utility. In `compare_heroes`, `quirkTreatmentAnalysis.risk.riskyQuirks`
entries also include localized names.

`list_trinkets` accepts `id`, `query`, `location`, `heroClass`, `rarity`,
`limit` (default 50, maximum 100), and `language`. It resolves official trinket
names, rarities, hero class requirements (with localized class names), and stat
buff/debuff `effects` from
`DD_GAME_DIR`, including base-game, official DLC, and backer trinkets. Filtering
by `heroClass` or `rarity` returns an explicit configuration error when installed
game definitions are unavailable instead of returning an unverifiable result.

`recommend_trinkets` evaluates equipment options for a hero (`heroId`), a class
(`heroClass`), or a specific item (`trinketId`). It matches curated S/A/B/situational
tier ratings, class-specific synergies, and usage cautions against current estate
ownership (`in_storage`, `equipped_by_self`, `equipped_by_other`, `in_store`, or `not_owned`).
Pass exactly one of `heroId`, `heroClass`, or `trinketId`. By default, store-only
items are not treated as owned; they are exposed with `isAvailableForPurchase`
when `onlyOwned` is false.
When given `trinketId`, it returns candidate roster heroes ranked by suitability.
Each candidate includes current stress and party-selection availability, and
available candidates are ranked ahead of heroes blocked by a raid or town activity.

`plan_expedition` prepares a comprehensive expedition briefing (dossier) for a
target quest or dungeon region (`questId`, `dungeon`, `difficulty`, `preferredHeroIds`,
and `language`). It integrates strict eligibility pruning (resolve-level restrictions
and party-selection availability), explicit separation of unverifiable eligibility,
stress cautions, and class-knowledge-backed candidate pools across 4
functional roles (Frontline DPS, Control/Disruptor, Support/Stress Healer, and Primary
Healer), curated class-compatible trinket matches,
automated supply provision calculations with itemized gold costs based on dungeon
length and regional curio cleansing needs, nighttime ambush prevention and camping strategy
analysis (`campingStrategy` with 12-point respite plan and ambush prevention providers),
and target boss / regional combat tactics.
Heroes whose quest eligibility cannot be verified are returned separately under
`unverifiedHeroes` and are not included in the role pools.

`recommend_building_upgrades` accepts `language` and analyzes the estate's building
upgrades and current heirloom resources (Busts, Portraits, Deeds, Crests). It evaluates
strategic priority tiers (`S`, `A`, `B`, `C`), separates high-priority core targets
(Blacksmith, Guild, Stage Coach) from immediately affordable alternatives, calculates
heirloom shortages, simulates Heirloom Exchange feasibility with surplus currencies,
and recommends targeted farming dungeons (e.g. Weald for Deeds, Warrens for Portraits).

`recommend_quirk_management` accepts independent `minimumNegativePriority` and
`minimumPositivePriority` filters plus `includeUnrated`, `heroId`, `language`, and
`limit`. It separates `negativeRemovals` from `positiveQuirks` and reports each
positive quirk as `lock_positive`, `keep_locked`, `do_not_prioritize`, or `unrated`.
The result also reports the verified three-slot positive-lock capacity, current
usage, remaining slots, definition coverage, game effects, cautions, and evidence
sources. The checked-in policy currently contains 40 negative-removal rules and
16 general or conditional positive-lock rules. Official names and descriptions
are localized; priorities, reasons, cautions, and policy text remain English
editorial source material for the client to summarize in the user's language.

Town-facing and campaign tools accept `language` and resolve official building,
activity, district, upgrade-tree, heirloom, estate resource, class count, and
dungeon quest count names from `DD_GAME_DIR`. Stable IDs are retained alongside
localized display names.

Combat knowledge covers Ruins, Warrens, Weald, Cove, Courtyard (Crimson Court),
Farmstead (Color of Madness), their region-specific enemies, shared roaming enemies,
and key bosses / minibosses (Necromancer, Prophet, Swine Prince, Hag, Siren,
Drowned Crew, Collector, Shambler, Crocodilian, and The Miller).
`query_combat` accepts `query`, `region`, `threat`, `priority`, `scope`, and
`language` filters. Region display names and localized-name search come from
the installed game's localization files when `DD_GAME_DIR` is configured.
Enemy and dangerous-action names use the same localization source; English
strategy guidance remains language-neutral source material for the client to
summarize in the user's language.
The guidance describes qualitative priorities, dangerous actions, and counters.
It covers the listed base and DLC regions and curated bosses, but does not provide
live turn state or exact enemy stats.

Quirk management combines the current roster, installed game definitions, and a
conservative editorial policy. Negative rules focus on verified high-impact
penalties and forced interactions. Positive rules prioritize broadly applicable
speed, accuracy, defense, and opening-round effects while explicitly identifying
lower-value town or camping effects. Uncurated positive quirks can be returned as
`unrated`; special non-replaceable quirks are never curated as Sanitarium lock
targets. Results are guidance, not an absolute or exhaustive treatment order.
The evidence and priority policy is documented in
[`docs/QUIRK_MANAGEMENT_POLICY.md`](docs/QUIRK_MANAGEMENT_POLICY.md).

Combat skill levels combine per-hero purchases from `persist.upgrades.json`
with installed hero upgrade definitions. The raw values under
`selected_combat_skills` only identify selection data and are never reported as
levels. Without `--game-dir`, `get_hero` returns selected skills with
`level: null` rather than guessing.

With a configured game installation, combat skill details also include the
party positions where each skill can be used, its target side and positions,
whether it targets one, a group, or a random unit, and any forward or backward
movement. Position 1 is the frontmost position and position 4 is the rearmost
position for both sides. `get_hero` also summarizes the selected loadout as
objective per-position coverage, including positions where every selected
skill works and positions with the highest skill count. These fields do not
apply an editorial viability threshold.

Hero resolve levels are derived from the thresholds in the configured game
installation. Hero results also report whether each hero can be newly selected
for a party and list concrete blockers such as an existing raid or town
assignment. Pass a `questId` to `list_heroes` or `get_hero` to apply the
installed game's resolve-level restriction for that quest; `eligibleOnly` can
then restrict `list_heroes` to eligible heroes.

## CLI examples

The CLI uses checked-in samples by default and accepts explicit decoded JSON paths for offline inspection.

```powershell
npm run cli -- heroes
npm run cli -- hero HERO_ID
npm run cli -- resources
npm run cli -- quests -- --dungeon ruins
npm run cli -- trinkets -- --location equipped
npm run cli -- state
npm run cli -- live-state -- --save-dir "C:\path\to\profile_0"
```

Run the CLI without a command to print the complete command and option list.

## Knowledge data and attribution

Curios, classes, combat, trinkets, camping skills, quirk treatment, and
building-upgrade priorities live under [`data/knowledge`](data/knowledge).
The curio, class, and combat guidance is adapted from the
[Official Darkest Dungeon Wiki](https://darkestdungeon.wiki.gg/wiki/Darkest_Dungeon_Wiki),
and its records retain source URLs and verification dates. Other knowledge files
contain verified game identifiers and explicitly editorial recommendation data.

The wiki material was summarized, normalized into a machine-readable schema, reorganized by interaction, and supplemented with clearly marked recommendation metadata. No wiki images are included. The adapted knowledge data is distributed under [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-nc-sa/4.0/), matching the source license. Reuse of that data must preserve attribution, remain noncommercial, indicate changes, and use the same license for adaptations.

See [LICENSE.md](LICENSE.md) for the exact licensing scope. Source code and wiki-derived knowledge data are licensed separately.

## Disclaimer

Darkest Dungeon and related names and trademarks belong to their respective owners. This software is provided without warranty. Back up save data before using third-party tools, even though this server is designed to be read-only.
