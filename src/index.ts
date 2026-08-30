import fs from "node:fs";

const raw = fs.readFileSync(
  "./samples/roster-decoded.json",
  "utf-8",
);

const save = JSON.parse(raw);

console.dir(save, {
  depth: 3,
});