const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadBackground(fetchImpl) {
  const listeners = {};
  const noopEvent = { addListener() {} };
  const chrome = {
    runtime: {
      onInstalled: noopEvent,
      onStartup: noopEvent,
      onMessage: {
        addListener(listener) {
          listeners.message = listener;
        },
      },
    },
    alarms: {
      create() {},
      onAlarm: noopEvent,
    },
    storage: {
      local: {
        async get() {
          return {};
        },
        async set() {},
      },
    },
  };
  const source = fs.readFileSync(
    path.join(__dirname, "..", "background.js"),
    "utf8"
  );

  vm.runInNewContext(source, {
    chrome,
    fetch: fetchImpl,
    console: {
      log() {},
      warn() {},
      error() {},
    },
    Date,
    Error,
    Promise,
    String,
    Array,
  });

  return listeners.message;
}

function sendMessage(listener, message) {
  return new Promise((resolve) => {
    const keepsChannelOpen = listener(message, {}, resolve);
    assert.equal(keepsChannelOpen, true);
  });
}

test("background service returns Sleeper draft and picks", async () => {
  const calls = [];
  const listener = loadBackground(async (url) => {
    calls.push(url);
    return {
      ok: true,
      status: 200,
      async json() {
        return url.endsWith("/picks")
          ? [{ pick_no: 1 }]
          : { draft_id: "123456789" };
      },
    };
  });

  const response = await sendMessage(listener, {
    type: "DRAFTIQ_GET_SLEEPER_DRAFT",
    draftId: "123456789",
  });

  assert.equal(response.ok, true);
  assert.equal(response.draft.draft_id, "123456789");
  assert.equal(response.picks.length, 1);
  assert.deepEqual(calls, [
    "https://api.sleeper.app/v1/draft/123456789",
    "https://api.sleeper.app/v1/draft/123456789/picks",
  ]);
});

test("background service rejects malformed Sleeper draft IDs", async () => {
  let fetchCalled = false;
  const listener = loadBackground(async () => {
    fetchCalled = true;
    throw new Error("should not fetch");
  });

  const response = await sendMessage(listener, {
    type: "DRAFTIQ_GET_SLEEPER_DRAFT",
    draftId: "not-a-draft",
  });

  assert.equal(response.ok, false);
  assert.match(response.error, /invalid/i);
  assert.equal(fetchCalled, false);
});
