# Darkest Dungeon MCP

A read-only Model Context Protocol (MCP) server for inspecting **Darkest Dungeon 1** save data and retrieving verified gameplay knowledge.

The server decodes copied save files into a temporary directory, validates the decoded JSON, and exposes normalized campaign data without modifying the original saves. It also includes curated knowledge for curios, classes, combat skills, base-region threats, and enemies.

This is an unofficial fan project. It is not affiliated with, endorsed by, or sponsored by Red Hook Studios or the Official Darkest Dungeon Wiki.

## Requirements

- Node.js 20.12 or later
- For live saves: Java through `PATH`, `JAVA_HOME`, or `--java`, plus
  [`DDSaveEditor.jar`](https://github.com/robojumper/DarkestDungeonSaveEditor)
- A PC installation of Darkest Dungeon 1 for building upgrades, combat skill
  levels, and risky-quirk analysis

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
checked-in decoded samples. `--game-dir` enables building upgrades, verified
combat skill levels in `get_hero`, and risky-quirk analysis. The original
profile remains untouched: supported save files are copied to a temporary
directory before decoding.

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
| `get_game_state` | Return a combined campaign summary with localized built-district names. |
| `list_building_upgrades` | List building upgrades and costs with localized building, tree, and heirloom names. |
| `list_risky_quirks` | Rank treatment-worthy quirks with localized class, quirk, and effect text. |
| `list_heroes` | Filter heroes by class, roster status, stress, party availability, and optional quest eligibility; localize class names with `language`. |
| `get_hero` | Return one hero with localized class, combat-skill, and equipped-trinket names, resolve level, availability, optional quest eligibility, and town activity. |
| `compare_heroes` | Compare 2–8 heroes using localized class and skill names plus objective readiness, equipment, skill-position, and curated quirk-risk evidence. |
| `list_quests` | Filter available quests with localized titles, objectives, regions, lengths, and reward names. |
| `get_quest` | Return one quest by ID with localized official quest and reward text. |
| `list_trinkets` | Query trinkets by ID or localized name across storage, heroes, and stores. |
| `query_classes` | Query verified class guidance with official class, skill, and synergy names localized from the installed game. |
| `query_combat` | Query verified region and enemy guidance by name, region, threat type, or priority. |
| `search_curios` | Search verified curios by ID, localized name, alias, or region. |
| `get_curio_advice` | Return item-aware interaction advice and warnings with localized curio names. |

Curio coverage includes shared curios, Ruins, Warrens, Weald, Cove, Courtyard, Farmstead, Darkest Dungeon, Old Road, and relevant Hamlet quests. Retired curios that are no longer used by the game are intentionally excluded. `search_curios` and `get_curio_advice` accept `language` (`en` or `ko`) and resolve official curio names from `DD_GAME_DIR`; the curated knowledge set retains search aliases and language-neutral interaction outcomes and advice.

Class knowledge covers all 18 playable Darkest Dungeon 1 classes and all 126 combat skills. `query_classes` accepts `language` (`en` or `ko`) and resolves official class and skill names from `DD_GAME_DIR`; the knowledge set retains only search aliases and language-neutral strategy guidance. Skill guidance uses internal IDs verified against the installed game definitions and describes use cases, synergies, and cautions without duplicating exact position or target data.

`list_heroes`, `get_hero`, and `compare_heroes` accept `language` (`en` or
`ko`). When `DD_GAME_DIR` is configured, `heroClassName`, combat skill `name`,
and equipped trinket `name` values come directly from the installed game's
localization files; stable internal IDs remain available alongside them.

`list_trinkets` also accepts `language` and resolves official trinket names
from `DD_GAME_DIR`, including base-game, official DLC, and backer trinkets.

`list_risky_quirks` accepts `language` and returns one official localized
quirk name and description plus the hero's localized class name. Treatment
priorities, reasons, and policy text remain English editorial source material
for the client to summarize in the user's language.

Town-facing tools accept `language` and resolve official building, activity,
district, upgrade-tree, and heirloom names from `DD_GAME_DIR`. Stable IDs are
retained alongside localized display names.

Combat knowledge currently covers Ruins, Warrens, Weald, Cove, their
region-specific enemies, and base-game enemies shared across those regions.
`query_combat` accepts `query`, `region`, `threat`, `priority`, `scope`, and
`language` filters. Region display names and localized-name search come from
the installed game's localization files when `DD_GAME_DIR` is configured.
Enemy and dangerous-action names use the same localization source; English
strategy guidance remains language-neutral source material for the client to
summarize in the user's language.
The guidance describes qualitative priorities, dangerous actions,
and counters; it does not provide live turn state, exact enemy stats, bosses,
or DLC-region coverage.

Quirk treatment analysis combines the current roster, installed game definitions, and a conservative editorial policy. It currently covers explicitly curated high-risk rules, primarily forced curio interactions and loot loss, rather than assigning an invented severity to every negative quirk. Results are guidance, not an absolute or exhaustive treatment order.

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

The curio knowledge in [`data/knowledge/curios.json`](data/knowledge/curios.json), class guidance in [`data/knowledge/classes.json`](data/knowledge/classes.json), and combat guidance in [`data/knowledge/combat.json`](data/knowledge/combat.json) are adapted from the [Official Darkest Dungeon Wiki](https://darkestdungeon.wiki.gg/wiki/Darkest_Dungeon_Wiki). Individual records retain their source URLs and verification dates.

The wiki material was summarized, normalized into a machine-readable schema, reorganized by interaction, and supplemented with clearly marked recommendation metadata. No wiki images are included. The adapted knowledge data is distributed under [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-nc-sa/4.0/), matching the source license. Reuse of that data must preserve attribution, remain noncommercial, indicate changes, and use the same license for adaptations.

See [LICENSE.md](LICENSE.md) for the exact licensing scope. Source code and wiki-derived knowledge data are licensed separately.

## Disclaimer

Darkest Dungeon and related names and trademarks belong to their respective owners. This software is provided without warranty. Back up save data before using third-party tools, even though this server is designed to be read-only.
