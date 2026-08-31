import { serveStdio } from "@modelcontextprotocol/server/stdio";

import { createDarkestDungeonServer } from "./create-server.js";
import { createConfiguredDataSource } from "./data-source.js";
import { loadProjectEnvironment } from "./load-environment.js";

loadProjectEnvironment();
const dataSource = createConfiguredDataSource();

serveStdio(() => createDarkestDungeonServer(dataSource), {
  onerror(error) {
    console.error(error);
  },
});
