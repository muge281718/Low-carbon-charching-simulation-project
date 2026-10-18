import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildStandalone } from "../scripts/build-standalone.mjs";

test("standalone file bundle is current and contains no module syntax", async () => {
  const [bundle, generated] = await Promise.all([
    readFile(new URL("../js/app.standalone.js", import.meta.url), "utf8"),
    buildStandalone(),
  ]);

  assert.equal(bundle, generated);
  assert.match(bundle, /window\.location\.protocol !== "file:"/);
  assert.doesNotMatch(bundle, /^\s*(?:import|export)\s/m);
});
