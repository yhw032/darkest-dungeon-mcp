# MCP client configuration

These examples launch the built stdio server without relying on the client's
working directory or a `.env` file. Install and build the project first:

```powershell
npm install
npm run build
```

Replace every example path with an absolute path on your machine. The JSON and
TOML examples already show the required doubled Windows backslashes
(`C:\\path\\to\\file`); PowerShell commands use ordinary Windows paths.

The common launch command is:

```text
node ABSOLUTE_PATH_TO_PROJECT/dist/mcp/stdio.js
  --save-dir ABSOLUTE_PATH_TO_PROFILE
  --game-dir ABSOLUTE_PATH_TO_GAME
  --decoder-jar ABSOLUTE_PATH_TO_DDSaveEditor.jar
```

`--game-dir` is only required for building-upgrade and risky-quirk analysis.
`--java` is optional when Java is already available through `PATH` or
`JAVA_HOME`. You can use `--env-file ABSOLUTE_PATH` instead of the individual
configuration arguments when desired.

## Codex CLI, app, and IDE extension

Add this to the user-level `~/.codex/config.toml`, or to
`.codex/config.toml` in a trusted project:

```toml
[mcp_servers.darkest_dungeon]
command = "node"
args = [
  "C:\\absolute\\path\\to\\darkest-dungeon-mcp\\dist\\mcp\\stdio.js",
  "--save-dir", "C:\\absolute\\path\\to\\profile_0",
  "--game-dir", "C:\\absolute\\path\\to\\DarkestDungeon",
  "--decoder-jar", "C:\\absolute\\path\\to\\DDSaveEditor.jar",
]
startup_timeout_sec = 20
tool_timeout_sec = 120
```

Restart the client after editing the file. Use `codex mcp list` in the CLI or
`/mcp` in an interactive session to verify the connection. Codex's CLI, app,
and IDE extension share this configuration format. See the
[official Codex MCP documentation](https://developers.openai.com/codex/mcp).

## Claude Code

Register a user-scoped server from PowerShell:

```powershell
claude mcp add --scope user --transport stdio darkest-dungeon -- node "C:\absolute\path\to\darkest-dungeon-mcp\dist\mcp\stdio.js" --save-dir "C:\absolute\path\to\profile_0" --game-dir "C:\absolute\path\to\DarkestDungeon" --decoder-jar "C:\absolute\path\to\DDSaveEditor.jar"
```

Use `--scope project` instead to create a shareable `.mcp.json`. Do not commit
that file with personal save or game paths. Verify with `claude mcp get
darkest-dungeon`, `claude mcp list`, or `/mcp`. The separator before `node` is
important because it prevents Claude Code from interpreting server options as
its own. See the
[official Claude Code MCP documentation](https://code.claude.com/docs/en/mcp).

## Claude Desktop

For local development, open Claude Desktop's developer settings and add this
entry to its MCP configuration JSON:

```json
{
  "mcpServers": {
    "darkest-dungeon": {
      "type": "stdio",
      "command": "node",
      "args": [
        "C:\\absolute\\path\\to\\darkest-dungeon-mcp\\dist\\mcp\\stdio.js",
        "--save-dir",
        "C:\\absolute\\path\\to\\profile_0",
        "--game-dir",
        "C:\\absolute\\path\\to\\DarkestDungeon",
        "--decoder-jar",
        "C:\\absolute\\path\\to\\DDSaveEditor.jar"
      ]
    }
  }
}
```

Restart Claude Desktop and inspect Developer settings or the Connectors menu.
Anthropic currently recommends a packaged Desktop Extension (`.mcpb`) for
distribution; this repository does not yet publish one. The JSON example above
is intended for local development. See Anthropic's
[local MCP server guidance](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop).

## Google Antigravity

Open the agent panel, select **MCP Servers > Manage MCP Servers > View raw
config**, and add:

```json
{
  "mcpServers": {
    "darkest-dungeon": {
      "command": "node",
      "args": [
        "C:\\absolute\\path\\to\\darkest-dungeon-mcp\\dist\\mcp\\stdio.js",
        "--save-dir",
        "C:\\absolute\\path\\to\\profile_0",
        "--game-dir",
        "C:\\absolute\\path\\to\\DarkestDungeon",
        "--decoder-jar",
        "C:\\absolute\\path\\to\\DDSaveEditor.jar"
      ]
    }
  }
}
```

The global file is `~/.gemini/config/mcp_config.json`; a workspace-local file
can be placed at `.agents/mcp_config.json`. Reload the MCP servers from the UI
or `/mcp`. See the
[official Antigravity MCP documentation](https://antigravity.google/docs/mcp).

## OpenClaw

Add this server entry under `mcp.servers` in the OpenClaw configuration:

```json
{
  "mcp": {
    "servers": {
      "darkest-dungeon": {
        "command": "node",
        "args": [
          "C:\\absolute\\path\\to\\darkest-dungeon-mcp\\dist\\mcp\\stdio.js",
          "--save-dir",
          "C:\\absolute\\path\\to\\profile_0",
          "--game-dir",
          "C:\\absolute\\path\\to\\DarkestDungeon",
          "--decoder-jar",
          "C:\\absolute\\path\\to\\DDSaveEditor.jar"
        ]
      }
    }
  }
}
```

Run `openclaw mcp doctor darkest-dungeon --probe` to validate the executable,
connect to it, and inspect its advertised tools. See the
[official OpenClaw MCP documentation](https://docs.openclaw.ai/cli/mcp).

## Generic stdio clients

For any client that accepts the conventional `mcpServers` JSON shape, use the
Claude Desktop or Antigravity example. The essential fields are `command:
"node"` and an `args` array beginning with the absolute path to
`dist/mcp/stdio.js`. No `cwd` field is required.

If a client reports a handshake failure:

1. Run `node ABSOLUTE_PATH/dist/mcp/stdio.js` in a terminal and confirm it stays
   running without printing diagnostics.
2. Confirm `npm run build` was run and the configured file exists.
3. Use absolute paths and the correct JSON escaping for Windows.
4. Check that `node --version` is 20.12 or later and Java is discoverable.
5. Inspect the client's MCP logs; server diagnostics are written to stderr,
   never to the protocol's stdout stream.
