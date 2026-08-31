#!/usr/bin/env node

import { serveStdio } from "@modelcontextprotocol/server/stdio";

import { createDarkestDungeonServer } from "./create-server.js";
import { createConfiguredDataSource } from "./data-source.js";
import { resolveRuntimeConfiguration } from "./runtime-options.js";

const { environment } = resolveRuntimeConfiguration();
const dataSource = createConfiguredDataSource(environment);

serveStdio(
  () =>
    createDarkestDungeonServer(dataSource, {
      ...(environment.DD_GAME_DIR === undefined
        ? {}
        : { gameDirectory: environment.DD_GAME_DIR }),
    }),
  {
    onerror(error) {
      console.error(error);
    },
  },
);
