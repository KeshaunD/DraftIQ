importScripts("rotowire-live.js");

const DRAFTIQ_REMOTE_DATA_URL =
  "https://raw.githubusercontent.com/KeshaunD/draftiq-public-data/main/draftiq-data-2026.json";

const STORAGE_KEY_REMOTE_DATA = "draftCopilotRemoteData";
const STORAGE_KEY_REMOTE_DATA_VERSION = "draftCopilotRemoteDataVersion";
const STORAGE_KEY_LAST_UPDATE_CHECK = "draftCopilotLastUpdateCheck";
const STORAGE_KEY_YAHOO_LEAGUE = "draftCopilotYahooLeague";
const STORAGE_KEY_YAHOO_SELECTED_LEAGUE = "draftCopilotYahooSelectedLeague";
const YAHOO_HELPER_BASE_URL = "http://127.0.0.1:3210";
const YAHOO_NATIVE_HOST_NAME = "com.draftiq.yahoo_sync";

let yahooNativePort = null;
let yahooNativeRequestCounter = 0;
let yahooHelperStartPromise = null;

async function fetchRemoteDraftIqData({ force = false } = {}) {
  const checkedAt = new Date().toISOString();
  const cacheBustedUrl = `${DRAFTIQ_REMOTE_DATA_URL}?t=${Date.now()}`;

  const response = await fetch(cacheBustedUrl, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Remote data request failed: ${response.status}`);
  }

  const remoteData = await response.json();

  if (!remoteData || !Array.isArray(remoteData.players)) {
    throw new Error("Remote data file is missing players array.");
  }

  const current = await chrome.storage.local.get([
    STORAGE_KEY_REMOTE_DATA_VERSION,
  ]);

  const currentVersion = current[STORAGE_KEY_REMOTE_DATA_VERSION];
  const remoteVersion =
    remoteData.version || remoteData.updatedAt || "unknown";

  const versionChanged = currentVersion !== remoteVersion;
  const shouldStoreRemoteData = force || versionChanged;

  if (shouldStoreRemoteData) {
    await chrome.storage.local.set({
      [STORAGE_KEY_REMOTE_DATA]: remoteData,
      [STORAGE_KEY_REMOTE_DATA_VERSION]: remoteVersion,
      [STORAGE_KEY_LAST_UPDATE_CHECK]: checkedAt,
    });
  } else {
    await chrome.storage.local.set({
      [STORAGE_KEY_LAST_UPDATE_CHECK]: checkedAt,
    });
  }

  if (versionChanged) {
    console.log("DraftIQ remote data updated:", remoteVersion);
  } else if (force) {
    console.log(
      "DraftIQ remote data refreshed; version is unchanged:",
      remoteVersion
    );
  } else {
    console.log("DraftIQ data already up to date.");
  }

  return {
    updated: versionChanged,
    refreshed: shouldStoreRemoteData,
    version: remoteVersion,
    checkedAt,
  };
}

async function runAutomaticUpdate() {
  try {
    await fetchRemoteDraftIqData();
  } catch (error) {
    console.warn("DraftIQ remote data update failed:", error);
  }
}

async function fetchSleeperDraft(draftId) {
  const normalizedDraftId = String(draftId || "").trim();

  if (!/^\d{6,}$/.test(normalizedDraftId)) {
    throw new Error("Sleeper draft ID is invalid.");
  }

  const baseUrl = `https://api.sleeper.app/v1/draft/${normalizedDraftId}`;
  const [draftResponse, picksResponse] = await Promise.all([
    fetch(baseUrl, { cache: "no-store" }),
    fetch(`${baseUrl}/picks`, { cache: "no-store" }),
  ]);

  if (!draftResponse.ok || !picksResponse.ok) {
    throw new Error(
      `Sleeper API returned ${draftResponse.status}/${picksResponse.status}.`
    );
  }

  const [draft, picks] = await Promise.all([
    draftResponse.json(),
    picksResponse.json(),
  ]);

  if (!draft || !Array.isArray(picks)) {
    throw new Error("Sleeper draft response was incomplete.");
  }

  return { draft, picks };
}

async function fetchYahooHelper(path, options = {}) {
  let response;

  try {
    response = await fetch(`${YAHOO_HELPER_BASE_URL}${path}`, {
      cache: "no-store",
      ...options,
    });
  } catch (_error) {
    throw new Error("DraftIQ Yahoo helper is not running.");
  }

  let payload = null;

  try {
    payload = await response.json();
  } catch (_error) {
    payload = null;
  }

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || `Yahoo helper returned ${response.status}.`);
  }

  return payload;
}

function getYahooNativePort() {
  if (yahooNativePort) return yahooNativePort;

  if (typeof chrome.runtime.connectNative !== "function") {
    throw new Error("Chrome native messaging is unavailable.");
  }

  const port = chrome.runtime.connectNative(YAHOO_NATIVE_HOST_NAME);
  yahooNativePort = port;

  port.onDisconnect.addListener(() => {
    if (yahooNativePort === port) yahooNativePort = null;
  });

  return port;
}

function requestYahooNativeHost(action) {
  const port = getYahooNativePort();
  const requestId = `${Date.now().toString(36)}-${++yahooNativeRequestCounter}`;

  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      clearTimeout(timeoutId);
      port.onMessage.removeListener(onMessage);
      port.onDisconnect.removeListener(onDisconnect);
    };

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };

    const onMessage = (message) => {
      if (message?.requestId !== requestId) return;
      finish(resolve, message);
    };

    const onDisconnect = () => {
      const detail = chrome.runtime.lastError?.message;
      finish(
        reject,
        new Error(detail || "The DraftIQ Yahoo launcher disconnected.")
      );
    };

    const timeoutId = setTimeout(() => {
      finish(reject, new Error("The DraftIQ Yahoo launcher timed out."));
    }, 10000);

    port.onMessage.addListener(onMessage);
    port.onDisconnect.addListener(onDisconnect);

    try {
      port.postMessage({ action, requestId });
    } catch (error) {
      finish(reject, error);
    }
  });
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function ensureYahooHelperRunning({ knownOffline = false } = {}) {
  if (!knownOffline) {
    try {
      return await fetchYahooHelper("/api/status");
    } catch (_error) {
      // The native launcher below will start the private local helper.
    }
  }

  if (!yahooHelperStartPromise) {
    yahooHelperStartPromise = (async () => {
      try {
        const result = await requestYahooNativeHost("start");

        if (!result?.ok || !result?.running) {
          throw new Error(result?.error || "The local helper did not start.");
        }

        let lastError = null;

        for (let attempt = 0; attempt < 5; attempt += 1) {
          try {
            return await fetchYahooHelper("/api/status");
          } catch (error) {
            lastError = error;
            if (attempt < 4) await wait(200);
          }
        }

        throw lastError || new Error("The local helper did not respond.");
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(
          `DraftIQ could not start its Yahoo connector automatically. ${detail} ` +
            "As a fallback, double-click Start DraftIQ Yahoo Sync.cmd."
        );
      }
    })().finally(() => {
      yahooHelperStartPromise = null;
    });
  }

  return yahooHelperStartPromise;
}

async function requestYahooHelper(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();

  if (path === "/api/status" && method === "GET") {
    try {
      return await fetchYahooHelper(path, options);
    } catch (_error) {
      await ensureYahooHelperRunning({ knownOffline: true });
      return fetchYahooHelper(path, options);
    }
  }

  await ensureYahooHelperRunning();
  return fetchYahooHelper(path, options);
}

async function syncYahooLeague(leagueKey) {
  const normalizedKey = String(leagueKey || "").trim();

  if (!/^[A-Za-z0-9]+\.l\.\d+$/.test(normalizedKey)) {
    throw new Error("Select a valid Yahoo league first.");
  }

  const result = await requestYahooHelper(
    `/api/sync?leagueKey=${encodeURIComponent(normalizedKey)}`
  );

  await chrome.storage.local.set({
    [STORAGE_KEY_YAHOO_LEAGUE]: result.snapshot,
    [STORAGE_KEY_YAHOO_SELECTED_LEAGUE]: normalizedKey,
  });

  return result.snapshot;
}

async function runAutomaticYahooLeagueSync() {
  try {
    const current = await chrome.storage.local.get([
      STORAGE_KEY_YAHOO_SELECTED_LEAGUE,
    ]);
    const leagueKey = current[STORAGE_KEY_YAHOO_SELECTED_LEAGUE];

    if (leagueKey) await syncYahooLeague(leagueKey);
  } catch (error) {
    console.log(
      "DraftIQ Yahoo auto-sync skipped:",
      error instanceof Error ? error.message : String(error)
    );
  }
}

chrome.runtime.onInstalled.addListener(() => {
  runAutomaticUpdate();
  runAutomaticYahooLeagueSync();

  chrome.alarms.create("draftiq-data-update", {
    periodInMinutes: 360,
  });
  chrome.alarms.create("draftiq-yahoo-league-sync", {
    periodInMinutes: 30,
  });
});

chrome.runtime.onStartup.addListener(() => {
  runAutomaticUpdate();
  runAutomaticYahooLeagueSync();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "draftiq-data-update") {
    runAutomaticUpdate();
  }

  if (alarm.name === "draftiq-yahoo-league-sync") {
    runAutomaticYahooLeagueSync();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (
    message &&
    message.type === "DRAFTIQ_REFRESH_ROTOWIRE"
  ) {
    (async () => {
      const current =
        await chrome.storage.local.get([
          STORAGE_KEY_REMOTE_DATA,
        ]);

      if (
        !Array.isArray(
          current[
            STORAGE_KEY_REMOTE_DATA
          ]?.players
        )
      ) {
        await fetchRemoteDraftIqData({
          force: true,
        });
      }

      return globalThis
        .DraftIQRotoWire
        .refresh();
    })()
      .then((result) => {
        sendResponse({
          ok: true,
          ...result,
        });
      })
      .catch((error) => {
        console.warn(
          "DraftIQ RotoWire refresh failed:",
          error
        );

        sendResponse({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : String(error),
        });
      });

    return true;
  }

  if (message && message.type === "DRAFTIQ_FORCE_UPDATE") {
    fetchRemoteDraftIqData({ force: true })
      .then((result) => {
        sendResponse({
          ok: true,
          ...result,
        });
      })
      .catch((error) => {
        console.warn("DraftIQ manual refresh failed:", error);

        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return true;
  }

  if (message && message.type === "DRAFTIQ_GET_SLEEPER_DRAFT") {
    fetchSleeperDraft(message.draftId)
      .then((result) => {
        sendResponse({ ok: true, ...result });
      })
      .catch((error) => {
        console.warn("DraftIQ Sleeper sync failed:", error);
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return true;
  }

  if (message && message.type === "DRAFTIQ_YAHOO_CONNECT") {
    requestYahooHelper("/api/status")
      .then(() => chrome.tabs.create({ url: `${YAHOO_HELPER_BASE_URL}/connect` }))
      .then(() => sendResponse({ ok: true }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        })
      );

    return true;
  }

  if (message && message.type === "DRAFTIQ_YAHOO_STATUS") {
    requestYahooHelper("/api/status")
      .then((status) => sendResponse(status))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        })
      );

    return true;
  }

  if (message && message.type === "DRAFTIQ_YAHOO_LEAGUES") {
    requestYahooHelper("/api/leagues")
      .then((result) => sendResponse(result))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        })
      );

    return true;
  }

  if (message && message.type === "DRAFTIQ_YAHOO_SYNC") {
    syncYahooLeague(message.leagueKey)
      .then((snapshot) => sendResponse({ ok: true, snapshot }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        })
      );

    return true;
  }

  if (message && message.type === "DRAFTIQ_YAHOO_DISCONNECT") {
    requestYahooHelper("/api/disconnect", { method: "POST" })
      .then((result) => sendResponse(result))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        })
      );

    return true;
  }

  return false;
});
