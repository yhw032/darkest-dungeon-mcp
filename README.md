# Darkest Dungeon MCP

A read-only Model Context Protocol (MCP) server for inspecting **Darkest Dungeon 1** save data and retrieving verified curio interaction advice.

The server decodes copied save files into a temporary directory, validates the decoded JSON, and exposes normalized campaign data without modifying the original saves. It also includes a curated knowledge base covering 77 active curios across the base-game regions, the Courtyard, the Farmstead, and quest-specific locations.

This is an unofficial fan project. It is not affiliated with, endorsed by, or sponsored by Red Hook Studios or the Official Darkest Dungeon Wiki.

## Requirements

- Node.js 20.12 or later
- Java, available through `PATH`, `JAVA_HOME`, or `DD_JAVA_EXECUTABLE`
- [`DDSaveEditor.jar`](https://github.com/robojumper/DarkestDungeonSaveEditor) for live saves
- A PC installation of Darkest Dungeon 1 when reading live campaign data

## Installation

```powershell
npm install
Copy-Item .env.example .env
```

Set the profile directory in `.env`:

```dotenv
DD_SAVE_DIR=C:\path\to\Steam\userdata\STEAM_USER_ID\262060\remote\profile_0
```

Set the game installation directory to enable building upgrade progress and
cost lookup:

```dotenv
DD_GAME_DIR=C:\path\to\Steam\steamapps\common\DarkestDungeon
```

Place the decoder at `tools/DDSaveEditor.jar`, or configure another location:

```dotenv
DD_SAVE_EDITOR_JAR=C:\path\to\DDSaveEditor.jar
```

If Java cannot be discovered automatically, set its executable explicitly:

```dotenv
DD_JAVA_EXECUTABLE=C:\Program Files\Java\bin\java.exe
```

The local `.env` file and decoder JAR are ignored by Git. Environment variables already present in the process take precedence over `.env` values.

## Running the MCP server

Build and run the distributable JavaScript entrypoint:

```powershell
npm run build
npm start
```

`npm run mcp` remains available for development and runs the TypeScript source
directly. `npm pack` creates an installable package exposing the
`darkest-dungeon-mcp` executable.

The executable accepts configuration directly, so MCP clients do not need to
depend on a particular working directory or a local `.env` file:

```powershell
darkest-dungeon-mcp --save-dir "C:\path\to\profile_0" --game-dir "C:\path\to\DarkestDungeon" --decoder-jar "C:\path\to\DDSaveEditor.jar"
```

Available options are `--env-file`, `--save-dir`, `--game-dir`,
`--decoder-jar`, and `--java`. Command-line options take precedence over
process environment variables, which take precedence over the optional `.env`
next to the installed package. An explicitly supplied `--env-file` must exist.

See [MCP client configuration](docs/CLIENT_CONFIGURATION.md) for complete,
cwd-independent examples for Codex, Claude Code, Claude Desktop, Google
Antigravity, OpenClaw, and generic stdio clients.

Without `DD_SAVE_DIR`, the server uses the checked-in decoded samples. With `DD_SAVE_DIR`, each request copies the supported save components to a temporary directory and decodes those copies. The original profile remains untouched. `DD_GAME_DIR` is only needed by `list_building_upgrades` and `list_risky_quirks`; other tools do not require it.

The repository includes a project-scoped Codex configuration at
`.codex/config.toml`. After installing dependencies, restart Codex or the IDE
extension and check `/mcp` for the `darkest_dungeon_dev` server. This
contributor convenience runs the TypeScript source directly and contains no
personal filesystem paths. The `darkest_dungeon` name is reserved for an
installed, user-level server; use the command-line options documented above
for that configuration.

## MCP tools

| Tool | Purpose |
| --- | --- |
| `get_game_state` | Return a combined campaign summary. |
| `list_building_upgrades` | List building upgrade progress and the next heirloom costs. |
| `list_risky_quirks` | Rank heroes with treatment-worthy quirks and explain the risks. |
| `list_heroes` | Filter heroes by class, roster status, and stress. |
| `get_hero` | Return one hero with related town activity. |
| `list_quests` | Filter available quests. |
| `get_quest` | Return one quest by ID. |
| `list_trinkets` | List trinkets in storage, on heroes, or in stores. |
| `get_trinket` | Return one trinket across all known locations. |
| `search_curios` | Search verified curios by ID, name, alias, or region. |
| `get_curio_advice` | Return item-aware interaction advice and warnings. |

Curio coverage includes shared curios, Ruins, Warrens, Weald, Cove, Courtyard, Farmstead, Darkest Dungeon, Old Road, and relevant Hamlet quests. Retired curios that are no longer used by the game are intentionally excluded.

Quirk treatment analysis combines the current roster, installed game definitions, and a conservative editorial policy. It currently covers explicitly curated high-risk rules, primarily forced curio interactions and loot loss, rather than assigning an invented severity to every negative quirk. Results are guidance, not an absolute or exhaustive treatment order.

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

## Development

```powershell
npm run typecheck
npm test
git diff --check
```

The project uses strict TypeScript, ESM, and Node's built-in test runner through `tsx`. Tests never access the user's live save directory.

## Knowledge data and attribution

The curio knowledge in [`data/knowledge/curios.json`](data/knowledge/curios.json) is adapted from the [Official Darkest Dungeon Wiki curio data module](https://darkestdungeon.wiki.gg/wiki/Module:Curios/Data), the [curio reference](https://darkestdungeon.wiki.gg/wiki/Curios), and linked regional pages. Individual records retain their source URLs and verification dates.

The wiki material was summarized, normalized into a machine-readable schema, reorganized by interaction, and supplemented with clearly marked recommendation metadata. No wiki images are included. The adapted knowledge data is distributed under [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-nc-sa/4.0/), matching the source license. Reuse of that data must preserve attribution, remain noncommercial, indicate changes, and use the same license for adaptations.

See [LICENSE.md](LICENSE.md) for the exact licensing scope. Source code and wiki-derived knowledge data are licensed separately.

## Disclaimer

Darkest Dungeon and related names and trademarks belong to their respective owners. This software is provided without warranty. Back up save data before using third-party tools, even though this server is designed to be read-only.
