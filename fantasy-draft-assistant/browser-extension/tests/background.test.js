const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadBackground(fetchImpl, { nativeHost } = {}) {
  const listeners = {};
  const storageState = {};
  const openedTabs = [];
  const nativeMessages = [];
  const noopEvent = { addListener() {} };
  const createPortEvent = () => {
    const eventListeners = new Set();
    return {
      addListener(listener) {
        eventListeners.add(listener);
      },
      removeListener(listener) {
        eventListeners.delete(listener);
      },
      dispatch(value) {
        for (const listener of [...eventListeners]) listener(value);
      },
    };
  };
  const chrome = {
    runtime: {
      onInstalled: noopEvent,
      onStartup: noopEvent,
      onMessage: {
        addListener(listener) {
          listeners.message = listener;
        },
      },
      connectNative(name) {
        if (!nativeHost) throw new Error("Native host is unavailable in this test.");

        const onMessage = createPortEvent();
        const onDisconnect = createPortEvent();
        return {
          onMessage,
          onDisconnect,
          postMessage(message) {
            nativeMessages.push({ name, message });
            Promise.resolve(nativeHost(message)).then(
              (response) => onMessage.dispatch(response),
              () => onDisconnect.dispatch()
            );
          },
        };
      },
    },
    alarms: {
      create() {},
      onAlarm: noopEvent,
    },
    tabs: {
      async create(options) {
        openedTabs.push(options);
        return options;
      },
    },
    storage: {
      local: {
        async get(keys) {
          const requested = Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(
            requested
              .filter((key) => Object.prototype.hasOwnProperty.call(storageState, key))
              .map((key) => [key, storageState[key]])
          );
        },
        async set(values) {
          Object.assign(storageState, values);
        },
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
    importScripts() {},
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
    clearTimeout,
    setTimeout,
  });

  listeners.message.storageState = storageState;
  listeners.message.openedTabs = openedTabs;
  listeners.message.nativeMessages = nativeMessages;
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

test("background service reports Yahoo helper connection status", async () => {
  const listener = loadBackground(async (url) => {
    assert.equal(url, "http://127.0.0.1:3210/api/status");
    return {
      ok: true,
      status: 200,
      async json() {
        return { ok: true, configured: true, connected: true };
      },
    };
  });

  const response = await sendMessage(listener, {
    type: "DRAFTIQ_YAHOO_STATUS",
  });

  assert.equal(response.connected, true);
});

test("background service starts the Yahoo helper through native messaging", async () => {
  let helperRunning = false;
  const listener = loadBackground(
    async (url) => {
      assert.equal(url, "http://127.0.0.1:3210/api/status");

      if (!helperRunning) throw new Error("connection refused");

      return {
        ok: true,
        status: 200,
        async json() {
          return { ok: true, configured: true, connected: false };
        },
      };
    },
    {
      nativeHost(message) {
        helperRunning = true;
        return {
          ok: true,
          running: true,
          requestId: message.requestId,
        };
      },
    }
  );

  const response = await sendMessage(listener, {
    type: "DRAFTIQ_YAHOO_STATUS",
  });

  assert.equal(response.ok, true);
  assert.equal(listener.nativeMessages.length, 1);
  assert.equal(listener.nativeMessages[0].name, "com.draftiq.yahoo_sync");
  assert.equal(listener.nativeMessages[0].message.action, "start");
});

test("background service stores a synced Yahoo league snapshot", async () => {
  const snapshot = {
    league: { key: "461.l.12345", name: "Sunday Legends" },
    settings: { teamCount: 12 },
    teams: [],
  };
  const listener = loadBackground(async (url) => {
    if (url === "http://127.0.0.1:3210/api/status") {
      return {
        ok: true,
        status: 200,
        async json() {
          return { ok: true, configured: true, connected: true };
        },
      };
    }

    assert.match(url, /leagueKey=461\.l\.12345/);
    return {
      ok: true,
      status: 200,
      async json() {
        return { ok: true, snapshot };
      },
    };
  });

  const response = await sendMessage(listener, {
    type: "DRAFTIQ_YAHOO_SYNC",
    leagueKey: "461.l.12345",
  });

  assert.equal(response.ok, true);
  assert.deepEqual(listener.storageState.draftCopilotYahooLeague, snapshot);
  assert.equal(
    listener.storageState.draftCopilotYahooSelectedLeague,
    "461.l.12345"
  );
});
