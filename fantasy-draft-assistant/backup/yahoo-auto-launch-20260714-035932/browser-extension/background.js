const DRAFTIQ_REMOTE_DATA_URL =
  "https://raw.githubusercontent.com/KeshaunD/draftiq-public-data/main/draftiq-data-2026.json";

const STORAGE_KEY_REMOTE_DATA = "draftCopilotRemoteData";
const STORAGE_KEY_REMOTE_DATA_VERSION = "draftCopilotRemoteDataVersion";
const STORAGE_KEY_LAST_UPDATE_CHECK = "draftCopilotLastUpdateCheck";
const STORAGE_KEY_YAHOO_LEAGUE = "draftCopilotYahooLeague";
const STORAGE_KEY_YAHOO_SELECTED_LEAGUE = "draftCopilotYahooSelectedLeague";
const YAHOO_HELPER_BASE_URL = "http://127.0.0.1:3210";

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

async function requestYahooHelper(path, options = {}) {
  let response;

  try {
    response = await fetch(`${YAHOO_HELPER_BASE_URL}${path}`, {
      cache: "no-store",
      ...options,
    });
  } catch (_error) {
    throw new Error(
      "DraftIQ Yahoo helper is not running. Start yahoo-sync-helper/start.ps1 first."
    );
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
    Promise.resolve(
      chrome.tabs.create({ url: `${YAHOO_HELPER_BASE_URL}/connect` })
    )
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
