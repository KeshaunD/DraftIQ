const DRAFTIQ_REMOTE_DATA_URL =
  "https://raw.githubusercontent.com/KeshaunD/draftiq-public-data/main/draftiq-data-2026.json";

const STORAGE_KEY_REMOTE_DATA = "draftCopilotRemoteData";
const STORAGE_KEY_REMOTE_DATA_VERSION = "draftCopilotRemoteDataVersion";
const STORAGE_KEY_LAST_UPDATE_CHECK = "draftCopilotLastUpdateCheck";

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

chrome.runtime.onInstalled.addListener(() => {
  runAutomaticUpdate();

  chrome.alarms.create("draftiq-data-update", {
    periodInMinutes: 360,
  });
});

chrome.runtime.onStartup.addListener(() => {
  runAutomaticUpdate();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "draftiq-data-update") {
    runAutomaticUpdate();
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

  return false;
});