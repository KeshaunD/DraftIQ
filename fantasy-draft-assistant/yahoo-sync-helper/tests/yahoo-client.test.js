"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { YahooClient } = require("../yahoo-client.js");

test("builds an installed-app authorization URL and stores exchanged tokens", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "draftiq-yahoo-"));
  const tokenFile = path.join(tempDir, "tokens.json");
  let request = null;
  const client = new YahooClient({
    clientId: "client-id",
    clientSecret: "client-secret",
    redirectUri: "oob",
    tokenFile,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({
            access_token: "access",
            refresh_token: "refresh",
            expires_in: 3600,
          });
        },
      };
    },
  });

  const authUrl = new URL(client.getAuthUrl());
  assert.equal(authUrl.searchParams.get("client_id"), "client-id");
  assert.equal(authUrl.searchParams.get("redirect_uri"), "oob");

  await client.exchangeCode("authorization-code");

  assert.match(request.url, /get_token/);
  assert.match(request.options.body, /grant_type=authorization_code/);
  assert.equal(client.status().connected, true);
  assert.equal(JSON.parse(fs.readFileSync(tokenFile, "utf8")).refresh_token, "refresh");
});
