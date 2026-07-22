"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("../server.js");

test("serves extension status and normalized league sync responses", async (t) => {
  const snapshot = {
    source: "yahoo-api",
    league: { key: "461.l.12345", name: "Sunday Legends" },
    teams: [],
  };
  const client = {
    status() {
      return { configured: true, connected: true };
    },
    async syncLeague(key) {
      assert.equal(key, "461.l.12345");
      return snapshot;
    },
  };
  const server = createServer({ client });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const port = server.address().port;

  const statusResponse = await fetch(`http://127.0.0.1:${port}/api/status`, {
    headers: { Origin: "chrome-extension://draftiq-test" },
  });
  const status = await statusResponse.json();
  assert.equal(status.connected, true);
  assert.equal(
    statusResponse.headers.get("access-control-allow-origin"),
    "chrome-extension://draftiq-test"
  );

  const syncResponse = await fetch(
    `http://127.0.0.1:${port}/api/sync?leagueKey=461.l.12345`
  );
  assert.deepEqual((await syncResponse.json()).snapshot, snapshot);
});
