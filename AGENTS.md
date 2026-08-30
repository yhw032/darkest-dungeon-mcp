# Project Guidelines

## Project Scope

- Build a read-only MCP server for inspecting Darkest Dungeon 1 save data.
- Preserve original save files. Do not implement save encoding or modify game saves unless the user explicitly expands the project scope.
- Keep decoded save shapes separate from normalized domain models.
- Do not infer meanings for undocumented numeric fields. Preserve raw values until their semantics are verified.

## Development Workflow

- Work in small, independently verifiable units.
- Complete one coherent work unit before starting the next.
- Commit every completed work unit.
- Do not include unrelated user changes in a commit.
- Before committing, inspect `git status` and the relevant diff.

## Git Convention

- Commit messages must use this exact structure:

  ```text
  feat(subject): contents
  ```

- Replace `subject` with the affected area and `contents` with a concise imperative summary.
- Example: `feat(roster): add validated roster parser`
- Keep each commit limited to one work unit.
- Do not amend, squash, reset, rebase, force-push, or otherwise rewrite history unless the user explicitly requests it.

## TypeScript Conventions

- Use strict TypeScript and ESM.
- Use `.js` extensions for relative imports compiled under `NodeNext`.
- Treat decoded JSON as `unknown` at the input boundary and validate it before use.
- Return normalized domain models from parsers; do not expose deeply nested save structures to CLI or MCP handlers.
- Represent optional or unknown data explicitly rather than inventing defaults with gameplay meaning.
- Keep query and normalization logic independent of CLI and MCP transports.
- Keep stdout free of diagnostic logging once stdio MCP transport is introduced; use stderr for diagnostics.

## Testing

- Add or update tests for every behavior change and bug fix.
- Prefer focused unit tests for validation, normalization, and query functions.
- Keep at least one integration test against the checked-in decoded sample.
- Cover malformed JSON, missing required fields, optional fields, and non-ASCII hero names where relevant.
- Tests must not read from or write to the user's live save directory.
- Run these checks before every commit:

  ```text
  npm run typecheck
  npm test
  git diff --check
  ```

## Save Data Safety

- Treat live save directories as read-only.
- Decode copied saves into a temporary or project-controlled location.
- Never invoke DDSaveEditor's `encode` command as part of normal operation.
- Do not accept unrestricted filesystem paths through MCP tools.
- Avoid committing new personal save data unless it is intentionally sanitized and approved as a fixture.
