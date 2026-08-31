# Local tools

Download `DDSaveEditor.jar` from the
[DarkestDungeonSaveEditor releases](https://github.com/robojumper/DarkestDungeonSaveEditor/releases)
page and place it here:

```text
tools/DDSaveEditor.jar
```

The JAR is intentionally excluded from Git. You can override this default path
with the `--decoder-jar` CLI option or the `DD_SAVE_EDITOR_JAR` environment
variable.

Only the decoder's read-only `decode` command is used by this project.
