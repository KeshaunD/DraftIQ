(function () {
  if (document.getElementById("draft-copilot-host")) return;

  const STORAGE_KEY_DRAFTED = "draftCopilotDrafted";
  const STORAGE_KEY_MANUAL_DRAFTED_MIGRATED =
    "draftCopilotManualDraftedMigrationV1";
  const STORAGE_KEY_MY_TEAM = "draftCopilotMyTeam";
  const STORAGE_KEY_POSITION = "draftCopilotPosition";
  const STORAGE_KEY_HIDDEN = "draftCopilotHidden";
  const STORAGE_KEY_REMOTE_DATA = "draftCopilotRemoteData";
  const STORAGE_KEY_REMOTE_DATA_VERSION = "draftCopilotRemoteDataVersion";
  const STORAGE_KEY_LEAGUE_SETTINGS = "draftCopilotLeagueSettings";
  const STORAGE_KEY_DIAGNOSTICS = "draftCopilotDiagnostics";
  const STORAGE_KEY_FAVORITES = "draftCopilotFavorites";
  const STORAGE_KEY_SORT = "draftCopilotSort";
  const STORAGE_KEY_CURRENT_DRAFT_ID = "draftCopilotCurrentDraftId";
  const STORAGE_KEY_DRAFTS_IN_PROGRESS = "draftCopilotMockDraftsInProgress";
  const STORAGE_KEY_MOCK_ADP_ANALYTICS = "draftCopilotMockAdpAnalytics";
  const STORAGE_KEY_RECOMMENDATION_HISTORY =
    "draftCopilotRecommendationHistory";
  const MOCK_DRAFT_GOAL = 25;

  const Core = window.DraftIQCore;
  const historicalFantasyPoints =
    typeof DRAFT_COPILOT_HISTORICAL_POINTS === "object"
      ? DRAFT_COPILOT_HISTORICAL_POINTS
      : {};

  if (!Core) {
    console.error("[DraftIQ] Core utilities failed to load.");
    return;
  }

  let draftPlayers = Array.isArray(DRAFT_COPILOT_PLAYERS)
    ? DRAFT_COPILOT_PLAYERS
    : [];

  let draftDataVersion = "bundled";

  const host = document.createElement("div");
  host.id = "draft-copilot-host";
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  const styleEl = document.createElement("style");
  styleEl.textContent = DRAFT_COPILOT_CSS;
  shadow.appendChild(styleEl);

  const root = document.createElement("div");
  root.className = "dc-root";
  root.innerHTML = `
    <button class="dc-float-tab" id="dc-float-tab">DraftIQ</button>

    <div class="dc-window" id="dc-window">
      <div class="dc-header" id="dc-drag-handle">
        <div class="dc-wordmark">Draft<span>IQ</span></div>

        <div class="dc-header-actions">
          <div class="dc-pick-tracker" id="dc-pick-tracker" aria-live="polite">
            <span>Pick</span>
            <strong>1.01</strong>
            <small>Overall 1</small>
          </div>

          <button
            class="dc-status-btn"
            id="dc-status"
            type="button"
            title="Open sync diagnostics"
            aria-label="Open sync diagnostics"
          >
            <span class="dc-status-dot" id="dc-status-dot" aria-hidden="true"></span>
            <span id="dc-status-label">Sync</span>
          </button>

          <button
            class="dc-icon-btn"
            id="dc-report-button"
            type="button"
            title="Open draft report"
            aria-label="Open draft report"
          >
            &#9638;
          </button>

          <button
            class="dc-refresh-btn"
            id="dc-refresh"
            type="button"
            title="Refresh DraftIQ data"
            aria-label="Refresh DraftIQ data"
          >
            <span class="dc-refresh-icon" aria-hidden="true">&#8635;</span>
          </button>

          <button class="dc-collapse-btn" id="dc-hide" type="button" title="Hide" aria-label="Hide DraftIQ">&times;</button>
        </div>
      </div>

      <div class="dc-left-panel">
        <div class="dc-controls">
          <input class="dc-search" id="dc-search" type="text" placeholder="Search players..." />
          <div class="dc-chips" id="dc-chips">
            ${["ALL", "WR", "RB", "QB", "TE"]
              .map(
                (p) =>
                  `<button class="dc-chip${
                    p === "ALL" ? " dc-chip-active" : ""
                  }" data-pos="${p}" aria-pressed="${
                    p === "ALL" ? "true" : "false"
                  }">${p}</button>`
              )
              .join("")}
          </div>
          <label class="dc-sort-control" for="dc-sort">
            <span>Sort players</span>
            <select class="dc-sort-select" id="dc-sort">
              <option value="favorites">Favorites</option>
              <option value="rank">DraftIQ Rank</option>
              <option value="adp">ADP</option>
              <option value="projection">Projection</option>
            </select>
          </label>
        </div>

        <div class="dc-draft-context" id="dc-draft-context" aria-label="Live draft context"></div>

        <div class="dc-recommendation" id="dc-recommendation"></div>

        <div class="dc-table-header">
          <div>Rank</div>
          <div>Player</div>
          <div>Tier</div>
          <div>ADP</div>
          <div>Proj</div>
          <div>Favorite</div>
        </div>

        <div class="dc-list" id="dc-list"></div>

        <div class="dc-footer" id="dc-footer">Click a player to expand analysis <span>&darr;</span></div>
      </div>

      <section class="dc-drawer dc-drawer-hidden" id="dc-diagnostics-drawer" aria-label="Sync diagnostics">
        <div class="dc-drawer-header">
          <div>
            <div class="dc-drawer-eyebrow">Live draft connection</div>
            <div class="dc-drawer-title">Sync diagnostics</div>
          </div>
          <button class="dc-drawer-close" data-close-drawer type="button" aria-label="Close diagnostics">&times;</button>
        </div>
        <div class="dc-diagnostics-body" id="dc-diagnostics-body"></div>
      </section>

      <section class="dc-drawer dc-drawer-hidden" id="dc-report-drawer" aria-label="Draft report">
        <div class="dc-drawer-header">
          <div>
            <div class="dc-drawer-eyebrow">Roster analysis</div>
            <div class="dc-drawer-title">Draft report</div>
          </div>
          <button class="dc-drawer-close" data-close-drawer type="button" aria-label="Close draft report">&times;</button>
        </div>
        <div class="dc-report-body" id="dc-report-body"></div>
      </section>
    </div>
  `;
  shadow.appendChild(root);

  const activeFilters = new Set();
  let searchTerm = "";
  let draftedIds = new Set();
  let myTeamIds = new Set();
  let favoriteIds = new Set();
  let sortMode = "favorites";
  let selectedPlayer = null;
  let draftDataUpdatedAt = null;
  let refreshInProgress = false;
  let footerStatus = null;
  let footerStatusType = "normal";
  let footerStatusTimer = null;
  let leagueSettings = Core.normalizeLeagueSettings();
  draftPlayers = Core.applyFantasyPointTiers(
    draftPlayers,
    "ppr",
    historicalFantasyPoints
  );
  let diagnostics = null;
  let currentDraftId = "";
  let draftsInProgress = {};
  let mockAdpAnalytics = { drafts: [], players: [] };
  let mockAdpPlayerLookup = new Map();
  let recommendationHistory = [];
  let availabilityCalibrationReport =
    Core.getAvailabilityCalibrationReport([], []);
  let lastRecommendationSnapshotSignature = "";
  let rotowireRefreshInProgress = false;

  const win = shadow.getElementById("dc-window");
  const tab = shadow.getElementById("dc-float-tab");
  const dragHandle = shadow.getElementById("dc-drag-handle");
  const refreshButton = shadow.getElementById("dc-refresh");
  const statusButton = shadow.getElementById("dc-status");
  const reportButton = shadow.getElementById("dc-report-button");
  const diagnosticsDrawer = shadow.getElementById("dc-diagnostics-drawer");
  const reportDrawer = shadow.getElementById("dc-report-drawer");

  function applyRemoteData(remoteData, version = "remote") {
    if (!remoteData || !Array.isArray(remoteData.players)) return false;

    draftPlayers = Core.applyFantasyPointTiers(
      remoteData.players,
      "ppr",
      historicalFantasyPoints
    );
    draftDataVersion = remoteData.version || remoteData.updatedAt || version;
    draftDataUpdatedAt = remoteData.updatedAt || null;

    if (selectedPlayer) {
      selectedPlayer =
        getPlayerById(playerId(selectedPlayer)) || selectedPlayer;
    }

    return true;
  }

  function formatUpdatedAt(value) {
    if (!value) return null;

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return null;

    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function setRefreshButtonState(isRefreshing) {
    refreshInProgress = isRefreshing;

    if (!refreshButton) return;

    refreshButton.disabled = isRefreshing;
    refreshButton.classList.toggle("dc-refreshing", isRefreshing);
    refreshButton.title = isRefreshing
      ? "Refreshing DraftIQ data..."
      : "Refresh DraftIQ data";
  }

  function showFooterStatus(message, type = "normal", duration = 4000) {
    footerStatus = message;
    footerStatusType = type;

    if (footerStatusTimer) {
      clearTimeout(footerStatusTimer);
      footerStatusTimer = null;
    }

    renderFooter();

    if (duration > 0) {
      footerStatusTimer = window.setTimeout(() => {
        footerStatus = null;
        footerStatusType = "normal";
        footerStatusTimer = null;
        renderFooter();
      }, duration);
    }
  }

  function closeDrawers() {
    [diagnosticsDrawer, reportDrawer].forEach((drawer) => {
      drawer?.classList.add("dc-drawer-hidden");
    });
  }

  function openDrawer(drawer) {
    const shouldOpen = drawer?.classList.contains("dc-drawer-hidden");

    closeDrawers();

    if (!drawer || !shouldOpen) return;

    drawer.classList.remove("dc-drawer-hidden");

    if (drawer === diagnosticsDrawer) renderDiagnostics();
    if (drawer === reportDrawer) renderDraftReport();
  }

  function escapeMarkup(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }

        resolve(response || { ok: false, error: "No response from DraftIQ." });
      });
    });
  }

  function formatDiagnosticTime(value) {
    if (!value) return "Not yet";

    const timestamp = new Date(value).getTime();

    if (!Number.isFinite(timestamp)) return "Unknown";

    const seconds = Math.max(
      0,
      Math.round((Date.now() - timestamp) / 1000)
    );

    if (seconds < 5) return "Just now";
    if (seconds < 60) return `${seconds}s ago`;

    return `${Math.floor(seconds / 60)}m ago`;
  }

  function getSyncConfidence() {
    const platformLabel = diagnostics?.platform || "Draft room";
    const lastScan = diagnostics?.lastScanAt
      ? new Date(diagnostics.lastScanAt).getTime()
      : 0;
    const age = lastScan ? Date.now() - lastScan : Number.POSITIVE_INFINITY;

    if (diagnostics?.syncError) {
      return {
        level: "error",
        label: "Sync error",
        detail: String(diagnostics.syncError),
      };
    }

    if (!diagnostics?.connected || !diagnostics?.supported || !lastScan) {
      return {
        level: "waiting",
        label: "Waiting for draft room",
        detail: "Open a supported draft room",
      };
    }

    if (age < 15000) {
      return {
        level: "live",
        label: `${platformLabel} sync live`,
        detail: `Scanned ${formatDiagnosticTime(diagnostics.lastScanAt)}`,
      };
    }

    if (age < 45000) {
      return {
        level: "delayed",
        label: "Sync delayed",
        detail: `Last scan ${formatDiagnosticTime(diagnostics.lastScanAt)}`,
      };
    }

    return {
      level: "stale",
      label: "Sync may be stale",
      detail: `Last scan ${formatDiagnosticTime(diagnostics.lastScanAt)}`,
    };
  }

  function diagnosticsAreHealthy() {
    return getSyncConfidence().level === "live";
  }

  function renderSyncStatus() {
    const dot = shadow.getElementById("dc-status-dot");
    const label = shadow.getElementById("dc-status-label");
    const confidence = getSyncConfidence();
    const healthy = confidence.level === "live";

    if (dot) {
      dot.classList.toggle("dc-status-dot-live", healthy);
      dot.classList.toggle("dc-status-dot-warning", !healthy);
    }

    if (label) {
      label.textContent =
        confidence.level === "live"
          ? `${diagnostics?.platform || "Yahoo"} Live`
          : confidence.level === "delayed"
            ? "Delayed"
            : confidence.level === "stale"
              ? "Stale"
              : "Check";
    }

    if (statusButton) {
      statusButton.title = `${confidence.label} · ${confidence.detail}`;
      statusButton.dataset.syncLevel = confidence.level;
    }

    renderDiagnostics();

    renderDraftContext(
      getCurrentOverallPick(),
      Math.max(2, Number(leagueSettings.teamCount) || 12)
    );
  }

  function getCurrentOverallPick() {
    const liveOverallPick = Number(diagnostics?.currentOverallPick);

    if (Number.isInteger(liveOverallPick) && liveOverallPick >= 1) {
      return liveOverallPick;
    }

    return getDraftedPlayers().length + 1;
  }

  function getYahooPickLabel(overallPick, teamCount) {
    const round = Math.ceil(overallPick / teamCount);
    const roundPick = ((overallPick - 1) % teamCount) + 1;

    return `${round}.${String(roundPick).padStart(2, "0")}`;
  }

  function getMostRecentDraftedPlayer() {
    const draftedCount = getCurrentOverallPick() - 1;
    const latestHistoryPick = getCurrentDraftPicks()
      .filter((pick) => {
        const overall = numberOrNull(pick.overall);
        return overall !== null && overall >= 1 && overall <= draftedCount;
      })
      .sort(
        (a, b) =>
          Number(b.overall) - Number(a.overall)
      )[0];

    if (latestHistoryPick?.name) {
      const historyPlayer = getPlayerById(latestHistoryPick.name);

      if (historyPlayer) return historyPlayer;
    }

    const draftedKeys = Array.from(draftedIds).reverse();

    for (const key of draftedKeys) {
      const player = getPlayerById(key);

      if (player) return player;
    }

    return null;
  }

  function renderDraftContext(overallPick, teamCount) {
    const container = shadow.getElementById("dc-draft-context");

    if (!container) return;

    const previousOverallPick = overallPick - 1;
    const previousPlayer = getMostRecentDraftedPlayer();
    const draftTiming = Core.getUserPickContext(
      overallPick,
      leagueSettings
    );
    const nextTurnPick = draftTiming.nextUserPick;
    const nextTurnLabel = draftTiming.isUserTurn
      ? "On the clock"
      : `Pick ${getYahooPickLabel(nextTurnPick, teamCount)}`;
    const nextTurnDetail = draftTiming.isUserTurn
      ? `Overall ${overallPick} · Your turn now`
      : `Overall ${nextTurnPick} · ${draftTiming.picksUntilNext} ${
          draftTiming.picksUntilNext === 1 ? "pick" : "picks"
        } away`;
    const previousName = previousPlayer?.name ||
      (previousOverallPick > 0 ? "Syncing latest pick" : "Waiting for first pick");
    const previousDetail = previousPlayer
      ? `${previousPlayer.pos || "NFL"} · ${previousPlayer.team || "—"} · Pick ${getYahooPickLabel(
          previousOverallPick,
          teamCount
        )}`
      : previousOverallPick > 0
        ? `Overall ${previousOverallPick}`
        : "Yahoo picks will appear here";

    container.innerHTML = `
      <div class="dc-draft-context-card dc-draft-context-previous">
        <span>Previous Pick</span>
        <strong title="${escapeMarkup(previousName)}">${escapeMarkup(previousName)}</strong>
        <small>${escapeMarkup(previousDetail)}</small>
      </div>
      <div class="dc-draft-context-card dc-draft-context-next${
        draftTiming.isUserTurn ? " dc-draft-context-on-clock" : ""
      }">
        <span>Your Next Turn</span>
        <strong>${escapeMarkup(nextTurnLabel)}</strong>
        <small>${escapeMarkup(nextTurnDetail)}</small>
      </div>
    `;
  }

  function renderCurrentPick() {
    const tracker = shadow.getElementById("dc-pick-tracker");

    if (!tracker) return;

    const teamCount = Math.max(
      2,
      Number(leagueSettings.teamCount) || 12
    );
    const overallPick = getCurrentOverallPick();
    const round = Math.ceil(overallPick / teamCount);
    const roundPick =
      ((overallPick - 1) % teamCount) + 1;
    const yahooPick = getYahooPickLabel(overallPick, teamCount);

    tracker.innerHTML = `
      <span>Pick</span>
      <strong>${yahooPick}</strong>
      <small>Overall ${overallPick}</small>
    `;
    tracker.title =
      `Round ${round}, pick ${roundPick} · Overall pick ${overallPick}`;
    renderDraftContext(overallPick, teamCount);
  }

     function renderDiagnostics() {
    const body = shadow.getElementById("dc-diagnostics-body");

    if (!body) return;

    const healthy = diagnosticsAreHealthy();
    const syncConfidence = getSyncConfidence();
    const platform = diagnostics?.platform || "Waiting";
    const lastScan = formatDiagnosticTime(diagnostics?.lastScanAt);
    const playerCount =
      diagnostics?.playerDataCount ?? draftPlayers.length;

    body.innerHTML = `
      <div class="dc-diagnostic-compact-grid">
        <div class="dc-diagnostic-compact-card dc-diagnostic-status-card ${
          healthy
            ? "dc-diagnostic-status-live"
            : "dc-diagnostic-status-warning"
        }">
          <span class="dc-health-dot" aria-hidden="true"></span>

          <div>
            <span>Status</span>
            <strong>${escapeMarkup(syncConfidence.label)}</strong>
          </div>
        </div>

        <div class="dc-diagnostic-compact-card">
          <span>Platform</span>
          <strong>${platform}</strong>
        </div>

        <div class="dc-diagnostic-compact-card">
          <span>Last scan</span>
          <strong>${lastScan}</strong>
        </div>

        <div class="dc-diagnostic-compact-card">
          <span>Players loaded</span>
          <strong>${playerCount}</strong>
        </div>
      </div>
    `;
  }

  async function requestRotoWireRefresh() {
    if (rotowireRefreshInProgress) {
      return;
    }

    rotowireRefreshInProgress = true;

    try {
      const result =
        await sendRuntimeMessage({
          type:
            "DRAFTIQ_REFRESH_ROTOWIRE",
        });

      if (!result?.ok) {
        console.warn(
          "[DraftIQ] RotoWire refresh skipped:",
          result?.error ||
            "Unknown error"
        );

        return;
      }

      const stored =
        await new Promise(
          (resolve) => {
            chrome.storage.local.get(
              [
                STORAGE_KEY_REMOTE_DATA,
                STORAGE_KEY_REMOTE_DATA_VERSION,
              ],
              resolve
            );
          }
        );

      if (
        applyRemoteData(
          stored[
            STORAGE_KEY_REMOTE_DATA
          ],
          stored[
            STORAGE_KEY_REMOTE_DATA_VERSION
          ] || "remote"
        )
      ) {
        renderList();
        renderProfile();
      }

      console.log(
        "[DraftIQ] RotoWire NFL news checked:",
        `${result.matchedPlayers || 0} player(s) matched`
      );
    } finally {
      rotowireRefreshInProgress = false;
    }
  }

  function requestRemoteRefresh() {
    if (refreshInProgress) return;

    setRefreshButtonState(true);
    showFooterStatus(
      "Refreshing latest DraftIQ data...",
      "loading",
      0
    );

    chrome.runtime.sendMessage(
      {
        type: "DRAFTIQ_FORCE_UPDATE",
      },
      (response) => {
        if (chrome.runtime.lastError) {
          setRefreshButtonState(false);

          showFooterStatus(
            `Refresh failed: ${chrome.runtime.lastError.message}`,
            "error",
            6000
          );

          return;
        }

        if (!response || !response.ok) {
          setRefreshButtonState(false);

          showFooterStatus(
            `Refresh failed: ${response?.error || "Unknown error"}`,
            "error",
            6000
          );

          return;
        }

        chrome.storage.local.get(
          [
            STORAGE_KEY_REMOTE_DATA,
            STORAGE_KEY_REMOTE_DATA_VERSION,
          ],
          (res) => {
            setRefreshButtonState(false);

            if (chrome.runtime.lastError) {
              showFooterStatus(
                `Refresh failed: ${chrome.runtime.lastError.message}`,
                "error",
                6000
              );

              return;
            }

            const remoteData = res[STORAGE_KEY_REMOTE_DATA];

            const remoteVersion =
              res[STORAGE_KEY_REMOTE_DATA_VERSION] ||
              response.version ||
              "remote";

            if (!applyRemoteData(remoteData, remoteVersion)) {
              showFooterStatus(
                "Refresh failed: downloaded data was invalid.",
                "error",
                6000
              );

              return;
            }

            renderList();
            renderProfile();

            showFooterStatus(
              response.updated
                ? "DraftIQ data updated successfully."
                : "DraftIQ data is already current.",
              "success",
              4500
            );
          }
        );
      }
    );
  }

  function playerId(player) {
    return player.id || player.name;
  }

  function normalizeDraftKey(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\./g, "")
      .replace(/'/g, "")
      .replace(/’/g, "")
      .replace(/-/g, " ")
      .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function applyMockAdpAnalytics(value) {
    const analytics = value && typeof value === "object"
      ? value
      : {};
    const players = Array.isArray(analytics.players)
      ? analytics.players
      : [];
    const drafts = Array.isArray(analytics.drafts)
      ? analytics.drafts
      : [];
    const lookup = new Map();

    players.forEach((history) => {
      const keys = [
        history.playerId,
        history.name,
        history.normalizedName,
        normalizeDraftKey(history.name),
      ];

      keys.filter(Boolean).forEach((key) => {
        lookup.set(String(key), history);
      });
    });

    mockAdpAnalytics = {
      ...analytics,
      drafts,
      players,
    };
    mockAdpPlayerLookup = lookup;
    refreshAvailabilityCalibration();
  }

  function refreshAvailabilityCalibration() {
    availabilityCalibrationReport = Core.getAvailabilityCalibrationReport(
      recommendationHistory,
      mockAdpAnalytics.drafts
    );
  }

  function calibrateAvailability(probability) {
    return Core.calibrateAvailabilityProbability(
      probability,
      availabilityCalibrationReport
    );
  }

  function getPersonalDraftMetrics(player, targetPick) {
    const history = playerDraftKeys(player)
      .map((key) => mockAdpPlayerLookup.get(String(key)))
      .find(Boolean);

    return Core.getHistoricalDraftMetrics(
      history,
      mockAdpAnalytics.drafts,
      targetPick,
      {
        teamCount: leagueSettings.teamCount,
        source: diagnostics?.platformKey || null,
        baselineAdp: player.adp,
      }
    );
  }

  function getProjectedAvailability(player, targetPick) {
    const personalMetrics = getPersonalDraftMetrics(player, targetPick);
    const marketAdp = numberOrNull(player.adp);
    const priorAvailableProbability = marketAdp === null
      ? 50
      : clamp(
          50 + (marketAdp - Number(targetPick)) * 3.2,
          3,
          97
        );

    const blendedProbability = Core.blendAvailabilityProbability(
      priorAvailableProbability,
      personalMetrics,
      10
    );

    return {
      pick: Number(targetPick),
      probability: calibrateAvailability(blendedProbability),
      metrics: personalMetrics,
    };
  }

  function getPersonalAvailabilityCurve(player, targetPicks) {
    return (Array.isArray(targetPicks) ? targetPicks : [])
      .map((pick) => getProjectedAvailability(player, pick));
  }

  function getMockDraftProgress() {
    const completedDraftIds = new Set(
      mockAdpAnalytics.drafts
        .filter((draft) => draft?.completed && draft.draftId)
        .map((draft) => String(draft.draftId))
    );
    const completed = completedDraftIds.size;

    return {
      completed,
      goal: MOCK_DRAFT_GOAL,
      percentage: clamp(
        (completed / MOCK_DRAFT_GOAL) * 100,
        0,
        100
      ),
    };
  }

  function getPlayerAdpProfile(
    player,
    targetPick,
    mockDraftProgress = getMockDraftProgress(),
    personalDraftMetrics = null
  ) {
    const personalMetrics = personalDraftMetrics ||
      getPersonalDraftMetrics(player, targetPick);

    return Core.getPrioritizedAdp({
      yahooAdp:
        player.yahooAdp ?? player.sourceAdp?.yahoo,
      espnAdp:
        player.espnAdp ?? player.sourceAdp?.espn,
      sleeperAdp:
        player.sleeperAdp ?? player.sourceAdp?.sleeper,
      fallbackAdp: player.adp,
      personalAdp: personalMetrics.averagePick,
      completedMocks: mockDraftProgress.completed,
      personalSampleSize: personalMetrics.pickSampleSize,
      goal: mockDraftProgress.goal,
    });
  }

  function playerDraftKeys(player) {
    const keys = new Set();

    if (player.id) {
      keys.add(String(player.id));
    }

    if (player.name) {
      keys.add(String(player.name));
      keys.add(normalizeDraftKey(player.name));
    }

    return Array.from(keys).filter(Boolean);
  }

  function isPlayerDrafted(player) {
    return playerDraftKeys(player).some((key) =>
      draftedIds.has(key)
    );
  }

  function isPlayerOnMyTeam(player) {
    return playerDraftKeys(player).some((key) =>
      myTeamIds.has(key)
    );
  }

  function favoriteKey(player) {
    return (
      normalizeDraftKey(player?.name) ||
      String(playerId(player))
    );
  }

  function isPlayerFavorite(player) {
    return favoriteIds.has(favoriteKey(player));
  }

  function saveFavorites() {
    chrome.storage.local.set({
      [STORAGE_KEY_FAVORITES]: Array.from(favoriteIds),
    });
  }

  function toggleFavorite(player) {
    const key = favoriteKey(player);

    if (favoriteIds.has(key)) {
      favoriteIds.delete(key);
    } else {
      favoriteIds.add(key);
    }

    saveFavorites();
    renderList();
  }

  function removeDraftedFavorites() {
    let changed = false;

    draftPlayers.forEach((player) => {
      if (
        isPlayerDrafted(player) &&
        favoriteIds.delete(favoriteKey(player))
      ) {
        changed = true;
      }
    });

    if (changed) {
      saveFavorites();
    }
  }

  function getUniquePlayersByState(predicate) {
    const seen = new Set();

    return draftPlayers.filter((player) => {
      if (!predicate(player)) return false;

      const id = String(playerId(player));

      if (seen.has(id)) return false;

      seen.add(id);
      return true;
    });
  }

  function getDraftedPlayers() {
    return getUniquePlayersByState(isPlayerDrafted);
  }

  function getMyTeamPlayers() {
    return getUniquePlayersByState(isPlayerOnMyTeam);
  }

  function formatValue(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "-";
    }

    return value;
  }

  function getTierLabel(player) {
    return player?.tierLabel || formatValue(player?.tier);
  }

  function getTierTitle(player) {
    const productionPoints = numberOrNull(player?.multiYearProductionPoints);
    const projectedPoints = numberOrNull(player?.projectedSeasonFantasyPoints);
    const tierScore = numberOrNull(player?.tierScore);
    const positionRank = numberOrNull(player?.tierPositionRank);

    if (tierScore === null || positionRank === null) {
      return "2025 totals and 2026 projections positional tier";
    }

    const components = [];

    if (productionPoints !== null) {
      components.push(`2023–25 average: ${productionPoints.toFixed(1)}`);
    }

    if (projectedPoints !== null) {
      components.push(`2026 projection: ${projectedPoints.toFixed(1)}`);
    }

    components.push(`Composite: ${tierScore.toFixed(1)}`);
    components.push(`${player.pos}${positionRank}`);

    return components.join(" · ");
  }

  function formatNumber(value, digits = 1) {
    if (
      value === null ||
      value === undefined ||
      value === "" ||
      value === "-"
    ) {
      return "-";
    }

    const number = Number(value);

    if (Number.isNaN(number)) {
      return "-";
    }

    return number
      .toFixed(digits)
      .replace(/\.0$/, "");
  }

  function getPlayerProjection(player) {
    if (
      player.proj !== null &&
      player.proj !== undefined &&
      player.proj !== "-"
    ) {
      return player.proj;
    }

    if (
      player.stats &&
      player.stats.projection !== null &&
      player.stats.projection !== undefined
    ) {
      return player.stats.projection;
    }

    return "-";
  }

  function getPlayerProjectedPpg(player) {
    if (
      player.projectedPpg !== null &&
      player.projectedPpg !== undefined &&
      player.projectedPpg !== "-"
    ) {
      return player.projectedPpg;
    }

    if (
      player.stats &&
      player.stats.projectedPpg !== null &&
      player.stats.projectedPpg !== undefined &&
      player.stats.projectedPpg !== "-"
    ) {
      return player.stats.projectedPpg;
    }

    const projection = Number(
      getPlayerProjection(player)
    );

    if (!Number.isNaN(projection)) {
      return projection / 17;
    }

    return "-";
  }

  function normalizeSourceBreakdown(player) {
    const breakdown = player.sourceBreakdown || {};

    return {
      yahoo: {
        projection:
          player.yahooProjection ??
          player.sourceProjections?.yahoo ??
          breakdown.yahoo?.projection ??
          null,

        projectedPpg:
          player.yahooProjectedPpg ??
          player.sourceProjectedPpg?.yahoo ??
          breakdown.yahoo?.projectedPpg ??
          null,

        adp:
          player.yahooAdp ??
          player.sourceAdp?.yahoo ??
          breakdown.yahoo?.adp ??
          null,
      },

      espn: {
        projection:
          player.espnProjection ??
          player.sourceProjections?.espn ??
          breakdown.espn?.projection ??
          null,

        projectedPpg:
          player.espnProjectedPpg ??
          player.sourceProjectedPpg?.espn ??
          breakdown.espn?.projectedPpg ??
          null,

        adp:
          player.espnAdp ??
          player.sourceAdp?.espn ??
          breakdown.espn?.adp ??
          null,
      },

      sleeper: {
        projection:
          player.sleeperProjection ??
          player.sourceProjections?.sleeper ??
          breakdown.sleeper?.projection ??
          null,

        projectedPpg:
          player.sleeperProjectedPpg ??
          player.sourceProjectedPpg?.sleeper ??
          breakdown.sleeper?.projectedPpg ??
          null,

        adp:
          player.sleeperAdp ??
          player.sourceAdp?.sleeper ??
          breakdown.sleeper?.adp ??
          null,
      },

      master: {
        projection:
          player.proj ??
          breakdown.master?.projection ??
          null,

        projectedPpg:
          player.projectedPpg ??
          breakdown.master?.projectedPpg ??
          null,

        adp:
          player.adp ??
          breakdown.master?.adp ??
          null,
      },
    };
  }

  function renderSourceBreakdown(player) {
    const breakdown =
      normalizeSourceBreakdown(player);

    const rows = [
      {
        key: "yahoo",
        label: "Yahoo",
      },
      {
        key: "espn",
        label: "ESPN",
      },
      {
        key: "sleeper",
        label: "Sleeper",
      },
      {
        key: "master",
        label: "Combined Avg",
        master: true,
      },
    ];

    return `
      <div class="dc-source-breakdown">
        <div class="dc-profile-section-title">
          Source Breakdown
        </div>

        <div class="dc-source-grid">
          ${rows
            .map((row) => {
              const source =
                breakdown[row.key] || {};

              return `
                <div class="dc-source-card${
                  row.master
                    ? " dc-source-card-master"
                    : ""
                }">
                  <div class="dc-source-name">
                    ${row.label}
                  </div>

                  <div class="dc-source-values">
                    <div>
                      <div class="dc-source-label">
                        Proj
                      </div>

                      <div class="dc-source-value">
                        ${formatNumber(
                          source.projection,
                          1
                        )}
                      </div>
                    </div>

                    <div>
                      <div class="dc-source-label">
                        PPG
                      </div>

                      <div class="dc-source-value">
                        ${formatNumber(
                          source.projectedPpg,
                          2
                        )}
                      </div>
                    </div>

                    <div>
                      <div class="dc-source-label">
                        ADP
                      </div>

                      <div class="dc-source-value">
                        ${formatNumber(
                          source.adp,
                          1
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    `;
  }

  function safeRotoWireUrl(value) {
    if (!value) return null;

    try {
      const parsed = new URL(
        String(value),
        window.location.href
      );

      const allowedProtocol =
        parsed.protocol === "https:" ||
        parsed.protocol === "http:";

      const allowedHost =
        parsed.hostname === "rotowire.com" ||
        parsed.hostname.endsWith(
          ".rotowire.com"
        );

      return allowedProtocol && allowedHost
        ? parsed.href
        : null;
    } catch (error) {
      return null;
    }
  }

  function formatNewsDate(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const options = {
      month: "short",
      day: "numeric",
    };

    if (
      date.getFullYear() !==
      new Date().getFullYear()
    ) {
      options.year = "numeric";
    }

    return date.toLocaleDateString(
      [],
      options
    );
  }

  function truncateNewsSummary(
    value,
    maximumLength = 240
  ) {
    const summary = String(
      value || ""
    )
      .replace(/\s+/g, " ")
      .trim();

    if (
      summary.length <= maximumLength
    ) {
      return summary;
    }

    return `${summary
      .slice(
        0,
        maximumLength - 1
      )
      .trimEnd()}…`;
  }

  function normalizeRotoWireNews(player) {
    const possibleNews =
      player?.news?.rotowire ??
      player?.rotowireNews ??
      player?.newsItems?.rotowire ??
      [];

    if (!Array.isArray(possibleNews)) {
      return [];
    }

    const seen = new Set();

    return possibleNews
      .map((item) => {
        if (
          !item ||
          typeof item !== "object"
        ) {
          return null;
        }

        const headline = String(
          item.headline ||
          item.title ||
          ""
        ).trim();

        if (!headline) return null;

        const summary =
          truncateNewsSummary(
            item.summary ||
            item.description ||
            item.excerpt ||
            ""
          );

        const publishedAt =
          item.publishedAt ||
          item.pubDate ||
          item.date ||
          null;

        const url =
          safeRotoWireUrl(
            item.url ||
            item.link
          );

        const key =
          `${headline.toLowerCase()}|${
            url || ""
          }`;

        if (seen.has(key)) {
          return null;
        }

        seen.add(key);

        return {
          headline,
          summary,
          publishedAt,
          url,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const aTime =
          new Date(
            a.publishedAt || 0
          ).getTime() || 0;

        const bTime =
          new Date(
            b.publishedAt || 0
          ).getTime() || 0;

        return bTime - aTime;
      })
      .slice(0, 1);
  }

  function renderRotoWireNews(player) {
    const news =
      normalizeRotoWireNews(player);

    if (!news.length) {
      return "";
    }

    return `
      <section
        class="dc-player-news"
        aria-label="Latest RotoWire player news"
      >
        <div class="dc-news-section-header">
          <div class="dc-profile-section-title">
            Latest Player News
          </div>

          <span class="dc-news-source-badge">
            RotoWire
          </span>
        </div>

        <div class="dc-news-list">
          ${news
            .map((item, index) => {
              const dateLabel =
                formatNewsDate(
                  item.publishedAt
                );

              return `
                <article class="dc-news-item${
                  index === 0
                    ? " dc-news-item-latest"
                    : ""
                }">
                  <div class="dc-news-topline">
                    <h3 class="dc-news-headline">
                      ${escapeMarkup(
                        item.headline
                      )}
                    </h3>

                    ${
                      dateLabel
                        ? `
                          <time
                            class="dc-news-date"
                            datetime="${escapeMarkup(
                              item.publishedAt
                            )}"
                          >
                            ${escapeMarkup(
                              dateLabel
                            )}
                          </time>
                        `
                        : ""
                    }
                  </div>

                  ${
                    item.summary
                      ? `
                        <p class="dc-news-summary">
                          ${escapeMarkup(
                            item.summary
                          )}
                        </p>
                      `
                      : ""
                  }

                  ${
                    item.url
                      ? `
                        <a
                          class="dc-news-link"
                          href="${escapeMarkup(
                            item.url
                          )}"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Read on RotoWire
                          <span aria-hidden="true">↗</span>
                        </a>
                      `
                      : ""
                  }
                </article>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function getScheduleStrength(player) {
    if (
      player &&
      player.scheduleStrength &&
      typeof player.scheduleStrength === "object"
    ) {
      return {
        rank:
          player.scheduleStrength.rank ??
          null,

        label:
          player.scheduleStrength.label ||
          "Unknown",

        score:
          player.scheduleStrength.score ??
          null,
      };
    }

    return {
      rank: null,
      label: "Unknown",
      score: null,
    };
  }

  function getScheduleText(player) {
    const scheduleStrength =
      getScheduleStrength(player);

    if (
      !scheduleStrength ||
      scheduleStrength.label === "Unknown"
    ) {
      return "SOS ?";
    }

    if (
      scheduleStrength.rank !== null &&
      scheduleStrength.rank !== undefined
    ) {
      return `SOS #${scheduleStrength.rank} ${scheduleStrength.label}`;
    }

    return `SOS ${scheduleStrength.label}`;
  }

  function getPlayerById(id) {
    const normalizedId = normalizeDraftKey(id);

    return draftPlayers.find((player) => {
      if (
        String(playerId(player)) ===
        String(id)
      ) {
        return true;
      }

      return playerDraftKeys(player).some(
        (key) =>
          String(key) === String(id) ||
          (normalizedId && normalizeDraftKey(key) === normalizedId)
      );
    });
  }

  function filteredPlayers() {
    const effectiveAdpByPlayer = new Map();

    if (sortMode === "adp") {
      const mockDraftProgress = getMockDraftProgress();
      const targetPick = getCurrentOverallPick();

      draftPlayers.forEach((player) => {
        effectiveAdpByPlayer.set(
          player,
          getPlayerAdpProfile(
            player,
            targetPick,
            mockDraftProgress
          ).adp
        );
      });
    }

    return draftPlayers
      .filter((player) => {
        if (isPlayerDrafted(player)) {
          return false;
        }

        const matchesPosition =
          activeFilters.size === 0 ||
          activeFilters.has(player.pos);

        const matchesSearch =
          player.name
            .toLowerCase()
            .includes(
              searchTerm.toLowerCase()
            );

        return (
          matchesPosition &&
          matchesSearch
        );
      })
      .sort((a, b) => {
        const favoriteDifference =
          Number(isPlayerFavorite(b)) -
          Number(isPlayerFavorite(a));

        if (favoriteDifference) {
          return favoriteDifference;
        }

        const rankDifference =
          Number(a.rank || 9999) -
          Number(b.rank || 9999);

        if (sortMode === "favorites") {
          return rankDifference;
        }

        if (sortMode === "adp") {
          return (
            Number(effectiveAdpByPlayer.get(a) || 9999) -
              Number(effectiveAdpByPlayer.get(b) || 9999) ||
            rankDifference
          );
        }

        if (sortMode === "projection") {
          return (
            Number(
              getPlayerProjection(b) || -1
            ) -
              Number(
                getPlayerProjection(a) || -1
              ) ||
            rankDifference
          );
        }

        return rankDifference;
      });
  }

  function getStarterRequirements() {
    return {
      QB: leagueSettings.qb,
      RB: leagueSettings.rb,
      WR: leagueSettings.wr,
      TE: leagueSettings.te,
      FLEX: leagueSettings.flex,
    };
  }

  function clamp(value, min, max) {
    return Math.min(
      max,
      Math.max(min, value)
    );
  }

  function numberOrNull(value) {
    if (
      value === null ||
      value === undefined ||
      value === "" ||
      value === "-"
    ) {
      return null;
    }

    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : null;
  }

  function getRosterCounts(
    players = getMyTeamPlayers()
  ) {
    return players.reduce(
      (counts, player) => {
        const position = String(
          player.pos || ""
        ).toUpperCase();

        if (
          Object.prototype.hasOwnProperty.call(
            counts,
            position
          )
        ) {
          counts[position] += 1;
        }

        return counts;
      },
      {
        QB: 0,
        RB: 0,
        WR: 0,
        TE: 0,
      }
    );
  }

  function getRosterNeeds(counts) {
    return Core.getRosterNeeds(
      counts,
      leagueSettings
    );
  }

  function getCurrentDraftPicks() {
    const draft = draftsInProgress?.[currentDraftId];

    return Array.isArray(draft?.picks)
      ? draft.picks
      : [];
  }

  function getRecentDraftedPlayers(draftedCount, limit = 12) {
    return getCurrentDraftPicks()
      .filter((pick) => {
        const overall = numberOrNull(pick?.overall);
        return overall !== null && overall >= 1 && overall <= draftedCount;
      })
      .sort((a, b) => Number(b.overall) - Number(a.overall))
      .slice(0, limit)
      .map((pick) => {
        const matchedPlayer =
          getPlayerById(pick.playerId) ||
          getPlayerById(pick.name);

        return matchedPlayer || {
          name: pick.name,
          pos: pick.pos,
          tier: null,
          tierLabel: null,
        };
      });
  }

  function getPriorityRosterNeeds(counts) {
    const requirements = getStarterRequirements();
    const needs = getRosterNeeds(counts);

    return ["RB", "WR", "TE", "QB"]
      .filter((position) => needs.baseNeeds[position] > 0)
      .sort((a, b) => {
        const aRequired = Math.max(1, requirements[a] || 0);
        const bRequired = Math.max(1, requirements[b] || 0);
        const aPressure = needs.baseNeeds[a] / aRequired;
        const bPressure = needs.baseNeeds[b] / bRequired;

        return bPressure - aPressure;
      })
      .slice(0, 2);
  }

  function getBetweenPicksIntelligence(currentPick, draftTiming) {
    const schedule = Core.getInterveningDraftSlots(
      currentPick,
      leagueSettings
    );
    const draftedCount = Math.max(0, currentPick - 1);
    const countsBySlot = new Map();
    const positionsBySlot = new Map();
    let trackedPickCount = 0;

    getCurrentDraftPicks().forEach((pick) => {
      const overall = numberOrNull(pick.overall);
      const position = String(pick.pos || "").toUpperCase();

      if (
        overall === null ||
        overall < 1 ||
        overall > draftedCount ||
        !["QB", "RB", "WR", "TE"].includes(position)
      ) {
        return;
      }

      const slot = Core.getSnakeDraftSlot(
        overall,
        leagueSettings.teamCount
      );
      const counts = countsBySlot.get(slot) || {
        QB: 0,
        RB: 0,
        WR: 0,
        TE: 0,
      };

      counts[position] += 1;
      countsBySlot.set(slot, counts);
      const positions = positionsBySlot.get(slot) || [];

      positions.push({ overall, position });
      positionsBySlot.set(slot, positions);
      trackedPickCount += 1;
    });

    positionsBySlot.forEach((positions, slot) => {
      positionsBySlot.set(
        slot,
        positions
          .sort((a, b) => a.overall - b.overall)
          .map((pick) => pick.position)
      );
    });

    const draftSlotTendencies = Core.getDraftSlotPositionTendencies(
      mockAdpAnalytics.drafts,
      {
        teamCount: leagueSettings.teamCount,
        source: diagnostics?.platformKey || "yahoo",
        openingRounds: 3,
      }
    );
    const draftSlotPlayerTendencies = Core.getDraftSlotPlayerTendencies(
      mockAdpAnalytics.drafts,
      {
        teamCount: leagueSettings.teamCount,
        source: diagnostics?.platformKey || "yahoo",
      }
    );
    const opponentBehavior = Core.getOpponentRosterBehavior(
      mockAdpAnalytics.drafts,
      {
        teamCount: leagueSettings.teamCount,
        source: diagnostics?.platformKey || "yahoo",
      }
    );

    const teams = schedule.slots.map((slot) => {
      const counts = countsBySlot.get(slot) || {
        QB: 0,
        RB: 0,
        WR: 0,
        TE: 0,
      };

      return {
        slot,
        counts,
        positions: positionsBySlot.get(slot) || [],
        needs: getPriorityRosterNeeds(counts),
      };
    });
    const positionPressure = {
      QB: 0,
      RB: 0,
      WR: 0,
      TE: 0,
    };

    teams.forEach((team) => {
      const rosterNeeds = getRosterNeeds(team.counts);
      const needs = rosterNeeds.baseNeeds;

      Object.keys(positionPressure).forEach((position) => {
        const canFillFlex =
          rosterNeeds.flexNeed > 0 &&
          ["RB", "WR", "TE"].includes(position);

        if (needs[position] > 0 || canFillFlex) {
          positionPressure[position] += 1;
        }
      });
    });

    const tendencyPressure = {
      QB: 0,
      RB: 0,
      WR: 0,
      TE: 0,
    };

    schedule.pickSlots.forEach(({ overall, slot }) => {
      const positions = positionsBySlot.get(slot) || [];
      const prediction = Core.getDraftSlotNextPositionProbabilities(
        draftSlotTendencies,
        slot,
        positions,
        Math.ceil(overall / leagueSettings.teamCount)
      );
      const behaviorPrediction = Core.getOpponentPositionProbabilities(
        opponentBehavior,
        countsBySlot.get(slot) || {},
        Math.ceil(overall / leagueSettings.teamCount)
      );
      const behaviorWeight = opponentBehavior.sampleDrafts >= 3
        ? clamp(opponentBehavior.sampleDrafts / MOCK_DRAFT_GOAL, 0.1, 0.35)
        : 0;

      Object.keys(tendencyPressure).forEach((position) => {
        tendencyPressure[position] +=
          (
            (prediction.probabilities[position] || 0) * (1 - behaviorWeight) +
            (behaviorPrediction.probabilities[position] || 0) * behaviorWeight
          ) / 100;
      });
    });

    const tendencyConfidence = draftSlotTendencies.sampleDrafts >= 3
      ? clamp(
          (draftSlotTendencies.sampleDrafts / MOCK_DRAFT_GOAL) * 0.65,
          0.1,
          0.65
        )
      : 0;

    Object.keys(positionPressure).forEach((position) => {
      positionPressure[position] = Number((
        positionPressure[position] * (1 - tendencyConfidence) +
        tendencyPressure[position] * tendencyConfidence
      ).toFixed(2));
    });

    return {
      ...schedule,
      teams,
      positionPressure,
      tendencyPressure,
      tendencyConfidence,
      draftSlotTendencies,
      draftSlotPlayerTendencies,
      opponentBehavior,
      pickCount: schedule.pickSlots.length,
      historyCoverage: draftedCount
        ? clamp(trackedPickCount / draftedCount, 0, 1)
        : 1,
      isUserTurn: draftTiming.isUserTurn,
    };
  }

  function getRosterConstructionWarnings(players, roundNumber) {
    const counts = getRosterCounts(players);
    const requirements = getStarterRequirements();
    const needs = getRosterNeeds(counts);
    const warnings = [];

    if (!players.length) {
      return [{
        tone: "neutral",
        text: "Roster tracking starts with your first pick",
      }];
    }

    if (roundNumber >= 5 && needs.baseNeeds.RB > 0) {
      warnings.push({
        tone: "warning",
        text: `Need ${needs.baseNeeds.RB} starting RB${needs.baseNeeds.RB > 1 ? "s" : ""}`,
      });
    }

    if (roundNumber >= 6 && needs.baseNeeds.WR > 0) {
      warnings.push({
        tone: "warning",
        text: `Need ${needs.baseNeeds.WR} starting WR${needs.baseNeeds.WR > 1 ? "s" : ""}`,
      });
    }

    if (roundNumber >= 9 && needs.baseNeeds.TE > 0) {
      warnings.push({ tone: "warning", text: "Starting TE still open" });
    }

    if (roundNumber >= 10 && needs.baseNeeds.QB > 0) {
      warnings.push({ tone: "warning", text: "Starting QB still open" });
    }

    if (
      counts.QB > Math.max(1, requirements.QB) &&
      (needs.baseNeeds.RB > 0 || needs.baseNeeds.WR > 0)
    ) {
      warnings.push({ tone: "danger", text: "Extra QB before core starters" });
    }

    if (
      counts.TE > Math.max(1, requirements.TE) &&
      (needs.baseNeeds.RB > 0 || needs.baseNeeds.WR > 0)
    ) {
      warnings.push({ tone: "danger", text: "Extra TE before core starters" });
    }

    const byeCounts = players.reduce((result, player) => {
      const rawBye = player.bye;
      const bye =
        rawBye === null ||
        rawBye === undefined ||
        rawBye === "" ||
        rawBye === "-"
          ? null
          : numberOrNull(rawBye);

      if (bye !== null) {
        result[bye] = (result[bye] || 0) + 1;
      }

      return result;
    }, {});
    const crowdedBye = Object.entries(byeCounts)
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])[0];

    if (crowdedBye) {
      warnings.push({
        tone: "warning",
        text: `${crowdedBye[1]} players share Week ${crowdedBye[0]} bye`,
      });
    }

    if (!warnings.length) {
      warnings.push({ tone: "good", text: "Roster construction on track" });
    }

    return warnings.slice(0, 3);
  }

  function getAvailableSkillPlayers() {
    return draftPlayers.filter((player) => {
      const position = String(
        player.pos || ""
      ).toUpperCase();

      return (
        ["QB", "RB", "WR", "TE"].includes(
          position
        ) &&
        !isPlayerDrafted(player)
      );
    });
  }

  function getPositionScarcity(
    player,
    availablePlayers
  ) {
    const position = String(
      player.pos || ""
    ).toUpperCase();

    const samePosition =
      availablePlayers
        .filter(
          (candidate) =>
            String(
              candidate.pos || ""
            ).toUpperCase() === position
        )
        .sort((a, b) => {
          const aRank =
            numberOrNull(a.rank) ??
            numberOrNull(a.adp) ??
            9999;

          const bRank =
            numberOrNull(b.rank) ??
            numberOrNull(b.adp) ??
            9999;

          return aRank - bRank;
        });

    const index = samePosition.findIndex(
      (candidate) =>
        String(playerId(candidate)) ===
        String(playerId(player))
    );

    if (index < 0) {
      return 0;
    }

    const comparisonIndex = Math.min(
      index + 4,
      samePosition.length - 1
    );

    const currentRank =
      numberOrNull(player.rank) ??
      numberOrNull(player.adp) ??
      9999;

    const comparisonRank =
      numberOrNull(
        samePosition[comparisonIndex]?.rank
      ) ??
      numberOrNull(
        samePosition[comparisonIndex]?.adp
      ) ??
      currentRank;

    return clamp(
      comparisonRank - currentRank,
      0,
      24
    );
  }

  function getByeWeekPenalty(
    player,
    myTeamPlayers
  ) {
    const bye = numberOrNull(player.bye);

    if (bye === null) {
      return 0;
    }

    const overlap =
      myTeamPlayers.filter(
        (teammate) =>
          numberOrNull(teammate.bye) ===
          bye
      ).length;

    return overlap * 4.5;
  }

  function getNeedScore(
    player,
    counts,
    needs,
    roundNumber
  ) {
    const position = String(
      player.pos || ""
    ).toUpperCase();

    const baseNeed =
      needs.baseNeeds[position] || 0;

    if (baseNeed > 0) {
      if (
        position === "QB" &&
        roundNumber <= 2
      ) {
        return 22;
      }

      return 48 + baseNeed * 5;
    }

    if (
      ["RB", "WR", "TE"].includes(
        position
      ) &&
      needs.flexNeed > 0
    ) {
      return position === "TE"
        ? 18
        : 28;
    }

    if (position === "QB") {
      if (counts.QB >= 2) {
        return -42;
      }

      return roundNumber < 8
        ? -24
        : 5;
    }

    if (position === "TE") {
      if (counts.TE >= 2) {
        return -26;
      }

      return roundNumber < 7
        ? -12
        : 4;
    }

    if (
      position === "RB" ||
      position === "WR"
    ) {
      return needs.startersFilled
        ? 12
        : 4;
    }

    return 0;
  }

  function getScoringAdjustment(player) {
    const position = String(
      player.pos || ""
    ).toUpperCase();

    if (leagueSettings.scoring === "ppr") {
      if (position === "WR") return 6;
      if (position === "TE") return 4;
      if (position === "RB") return 3;
    }

    if (
      leagueSettings.scoring ===
      "standard"
    ) {
      if (position === "RB") return 3;
      if (position === "WR") return -2;
    }

    return 0;
  }

  function scoreRecommendation(
    player,
    context
  ) {
    const personalDraftMetrics = getPersonalDraftMetrics(
      player,
      context.draftTiming.lookaheadPick
    );
    const adpProfile = getPlayerAdpProfile(
      player,
      context.draftTiming.lookaheadPick,
      context.mockDraftProgress,
      personalDraftMetrics
    );
    const adp = numberOrNull(adpProfile.adp);
    const replacementValue = Core.getPlayerReplacementValue(
      player,
      context.replacementSnapshot
    );
    const vorpScore = replacementValue.valueOverReplacement === null
      ? 0
      : clamp(
          replacementValue.valueOverReplacement / 10,
          -4,
          18
        );
    const rank =
      numberOrNull(player.rank) ??
      adp ??
      999;

    const projectedPpg =
      numberOrNull(
        getPlayerProjectedPpg(player)
      );

    const scarcity =
      getPositionScarcity(
        player,
        context.availablePlayers
      );

    const needScore =
      getNeedScore(
        player,
        context.counts,
        context.needs,
        context.roundNumber
      );

    const adpUrgency =
      adp === null
        ? 0
        : clamp(
            (
              context.currentPick +
              4 -
              adp
            ) * 1.6,
            -12,
            24
          );

    const availability =
      Core.getAvailabilityUrgency(
        {
          ...player,
          adp,
        },
        context.draftTiming.lookaheadPick
      );

    const tierWarning =
      Core.getTierDropWarning(
        player,
        context.availablePlayers
      );

    const tierDropScore = tierWarning
      ? tierWarning.severity === "high"
        ? 15
        : 7
      : 0;

    const tierValueScore =
      Core.getTierRecommendationValue(player);

    const marketPressureScore =
      Core.getPlayerMarketPressure(
        player,
        context.tierMarket
      );
    const pprRbScarcityScore =
      String(player.pos || "").toUpperCase() === "RB"
        ? context.pprRbScarcity.adjustment
        : 0;
    const stackInfo = Core.getPlayerStackBonus(
      player,
      context.stackTargets
    );
    const stackScore = stackInfo.bonus;
    const offenseExposurePenalty = Core.getOffenseExposurePenalty(
      player,
      context.myTeamPlayers,
      { stackBonus: stackScore }
    );
    const handcuffInfo = Core.getPlayerHandcuffBonus(
      player,
      context.handcuffTargets
    );
    const handcuffScore = handcuffInfo.bonus;
    const remainingAfterPick = context.availablePlayers.filter(
      (candidate) => String(playerId(candidate)) !== String(playerId(player))
    );
    const completionAfterPick = Core.getStarterCompletionOutlook(
      [...context.myTeamPlayers, player],
      remainingAfterPick,
      leagueSettings
    );
    const starterCompletionScore = clamp(
      (completionAfterPick.probability -
        context.starterCompletionOutlook.probability) * 0.35,
      -4,
      10
    );
    const benchAllocationScore = Core.getBenchAllocationAdjustment(
      player,
      context.myTeamPlayers,
      leagueSettings,
      context.roundNumber
    );
    const tierCliffScore = Core.getTierCliffOpportunityCost(
      player,
      context.availablePlayers,
      context.nextTurnGap
    );
    const availabilityCurve = getPersonalAvailabilityCurve(
      player,
      context.upcomingUserPicks
    );

    const projectionScore =
      projectedPpg === null
        ? 0
        : clamp(
            (projectedPpg - 8) * 1.2,
            -5,
            20
          );

    const byePenalty =
      getByeWeekPenalty(
        player,
        context.myTeamPlayers
      );

    const rankScore =
      360 - rank * 2.6;

    const scoringAdjustment =
      getScoringAdjustment(player);

    return {
      player,
      effectiveAdp: adp,
      adpProfile,
      personalDraftMetrics,

      score:
        rankScore +
        needScore +
        scarcity * 1.25 +
        adpUrgency +
        availability.score +
        tierDropScore +
        tierValueScore +
        marketPressureScore +
        pprRbScarcityScore +
        stackScore +
        handcuffScore +
        starterCompletionScore +
        benchAllocationScore +
        tierCliffScore +
        vorpScore +
        scoringAdjustment +
        projectionScore -
        offenseExposurePenalty -
        byePenalty,

      needScore,
      scarcity,
      adpUrgency,
      availability,
      tierWarning,
      tierScore: tierDropScore,
      tierDropScore,
      tierValueScore,
      marketPressureScore,
      pprRbScarcityScore,
      stackScore,
      stackTarget: stackInfo.target,
      handcuffScore,
      handcuffTarget: handcuffInfo.target,
      offenseExposurePenalty,
      starterCompletionScore,
      completionAfterPick,
      benchAllocationScore,
      tierCliffScore,
      replacementValue,
      vorpScore,
      availabilityCurve,
      projectionScore,
      scoringAdjustment,
      byePenalty,
    };
  }

  function getRecommendationGrade(scored) {
    const rank =
      numberOrNull(scored.player.rank) ??
      numberOrNull(scored.player.adp) ??
      150;

    return Math.round(
      clamp(
        80 +
          clamp((60 - rank) * 0.13, -8, 8) +
          scored.needScore * 0.1 +
          scored.scarcity * 0.25 +
          scored.adpUrgency * 0.14 +
          scored.tierScore * 0.18 +
          scored.tierValueScore * 0.08 +
          scored.marketPressureScore * 0.06 -
          scored.offenseExposurePenalty * 0.12 +
          scored.starterCompletionScore * 0.12 +
          scored.benchAllocationScore * 0.1 +
          scored.tierCliffScore * 0.15 -
          scored.byePenalty * 0.2,
        58,
        99
      )
    );
  }

  function getGoneProbability(scored, context) {
    const personalMetrics = scored.personalDraftMetrics ||
      getPersonalDraftMetrics(
        scored.player,
        context.draftTiming.lookaheadPick
      );
    const slotSelectionRisk = Core.getPlayerDraftSlotSelectionRisk(
      context.betweenPicks?.draftSlotPlayerTendencies,
      scored.player,
      context.betweenPicks?.pickSlots || []
    );

    scored.personalDraftMetrics = personalMetrics;
    scored.slotSelectionRisk = slotSelectionRisk;

    if (context.betweenPicks?.pickCount === 0) {
      return 0;
    }

    const adp = numberOrNull(scored.effectiveAdp);

    if (adp === null) {
      const slotSelectionBoost = Math.min(
        14,
        (slotSelectionRisk?.goneProbability || 0) * 0.35
      );
      const blendedAvailableProbability =
        Core.blendAvailabilityProbability(
          50 - slotSelectionBoost,
          personalMetrics,
          10
        );

      return 100 - calibrateAvailability(blendedAvailableProbability);
    }

    const gap =
      Number(context.draftTiming.lookaheadPick) - adp;
    const position = String(scored.player.pos || "").toUpperCase();
    const teamsNeedingPosition =
      context.betweenPicks?.positionPressure?.[position] || 0;
    const pressureBoost =
      context.betweenPicks?.historyCoverage >= 0.45
        ? Math.min(16, teamsNeedingPosition * 2.2)
        : 0;
    const marketBoost = Math.min(
      18,
      Math.max(0, scored.marketPressureScore || 0) * 0.6
    );
    const slotSelectionBoost = Math.min(
      18,
      (slotSelectionRisk?.goneProbability || 0) * 0.45
    );

    const priorGoneProbability = Math.round(
      clamp(
        48 +
          gap * 3.2 +
          scored.scarcity * 0.45 +
          pressureBoost +
          marketBoost +
          slotSelectionBoost,
        6,
        97
      )
    );

    const blendedAvailableProbability =
      Core.blendAvailabilityProbability(
        100 - priorGoneProbability,
        personalMetrics,
        10
      );

    return 100 - calibrateAvailability(blendedAvailableProbability);
  }

  function getDraftUrgency(scored, context) {
    const adp = numberOrNull(scored.effectiveAdp);
    const goneProbability =
      getGoneProbability(scored, context);

    if (
      adp !== null &&
      context.currentPick - adp >= 7
    ) {
      return "Steal";
    }

    if (
      scored.tierWarning?.severity === "high" &&
      goneProbability >= 75
    ) {
      return "Must Draft";
    }

    if (goneProbability >= 70) return "Take Now";
    if (scored.availability?.canWait) return "Can Wait";
    if (
      adp !== null &&
      adp - context.currentPick >= 12
    ) {
      return "Reach";
    }

    return "Take Now";
  }

  function getFuturePlayerValue(player, pick, roster, context) {
    const counts = getRosterCounts(roster);
    const needs = getRosterNeeds(counts);
    const roundNumber = Math.ceil(
      Number(pick) / leagueSettings.teamCount
    );
    const projectedPpg = numberOrNull(
      getPlayerProjectedPpg(player)
    );
    const replacementValue = Core.getPlayerReplacementValue(
      player,
      context.replacementSnapshot
    ).valueOverReplacement;
    const stackBonus = Core.getPlayerStackBonus(
      player,
      Core.getStackTargets(roster, [player])
    ).bonus;
    const handcuffBonus = Core.getPlayerHandcuffBonus(
      player,
      Core.getRbHandcuffTargets(
        roster,
        [player],
        roundNumber
      )
    ).bonus;
    const offenseExposurePenalty = Core.getOffenseExposurePenalty(
      player,
      roster,
      { stackBonus }
    );
    const benchAllocationScore = Core.getBenchAllocationAdjustment(
      player,
      roster,
      leagueSettings,
      roundNumber
    );
    const tierCliffScore = Core.getTierCliffOpportunityCost(
      player,
      context.availablePlayers,
      Math.max(0, Number(pick) - context.recommendationPick)
    );

    return (
      70 +
      Core.getTierRecommendationValue(player) +
      getNeedScore(player, counts, needs, roundNumber) * 0.55 +
      clamp((replacementValue ?? 0) / 10, -4, 18) +
      (projectedPpg === null
        ? 0
        : clamp((projectedPpg - 8) * 0.8, -4, 14)) +
      stackBonus +
      handcuffBonus +
      benchAllocationScore +
      tierCliffScore * 0.65 -
      offenseExposurePenalty
    );
  }

  function applyDraftPathSimulation(scored, context) {
    const futurePicks = context.upcomingUserPicks
      .filter((pick) => pick > context.recommendationPick)
      .slice(0, 2);

    if (!futurePicks.length) return [];

    const availabilityCache = new Map();

    const paths = Core.simulateDraftPaths({
      candidates: scored,
      availablePlayers: context.availablePlayers,
      currentRoster: context.myTeamPlayers,
      futurePicks,
      maxCandidates: 8,
      getPlayerKey: (player) => String(playerId(player)),
      getAvailability: (player, pick) => {
        const key = `${String(playerId(player))}:${pick}`;

        if (!availabilityCache.has(key)) {
          availabilityCache.set(
            key,
            getProjectedAvailability(player, pick).probability
          );
        }

        return availabilityCache.get(key);
      },
      getFutureValue: (player, pick, roster) =>
        getFuturePlayerValue(player, pick, roster, context),
    });

    paths.forEach((path) => {
      path.candidate.pathSimulation = path;
      path.candidate.pathAdjustment = path.pathAdjustment;
      path.candidate.decisionScore += path.pathAdjustment;
    });

    return paths;
  }

  function buildConditionalPivotPlan(pool, primary) {
    const alternatives = (Array.isArray(pool) ? pool : [])
      .filter((item) => item !== primary);
    const primaryPosition = String(
      primary?.player?.pos || ""
    ).toUpperCase();
    const used = new Set();
    const pivots = [];
    const addPivot = (item, condition, reason) => {
      if (!item) return;

      const key = String(playerId(item.player));

      if (used.has(key)) return;
      used.add(key);
      pivots.push({ item, condition, reason });
    };
    const direct = alternatives[0];
    const samePosition = alternatives.find(
      (item) =>
        item !== direct &&
        String(item.player?.pos || "").toUpperCase() === primaryPosition
    );
    const differentPosition = alternatives.find(
      (item) =>
        item !== direct &&
        String(item.player?.pos || "").toUpperCase() !== primaryPosition
    );

    addPivot(
      direct,
      "If sniped",
      "Next-highest complete recommendation score"
    );
    addPivot(
      samePosition,
      "Hold position",
      `Best remaining ${primaryPosition} without forcing the original player`
    );
    addPivot(
      differentPosition,
      "Pivot position",
      "Best alternate roster path if the position dries up"
    );

    alternatives.forEach((item) => {
      if (pivots.length >= 3) return;
      addPivot(
        item,
        "Value fallback",
        "Highest remaining tier, replacement value, and availability"
      );
    });

    return pivots.slice(0, 3);
  }

  function buildRecommendation() {
    const availablePlayers =
      getAvailableSkillPlayers();

    if (!availablePlayers.length) {
      return null;
    }

    const myTeamPlayers =
      getMyTeamPlayers();

    const counts =
      getRosterCounts(myTeamPlayers);

    const needs =
      getRosterNeeds(counts);

    const draftedCount =
      getDraftedPlayers().length;

    const currentPick =
      getCurrentOverallPick();

    const boardPickCount = Math.max(
      draftedCount,
      currentPick - 1
    );

    const draftTiming =
      Core.getUserPickContext(
        currentPick,
        leagueSettings
      );

    const recommendationPick = draftTiming.isUserTurn
      ? currentPick
      : draftTiming.nextUserPick;
    const isForecast = !draftTiming.isUserTurn;
    const roundNumber = Math.ceil(
      recommendationPick / leagueSettings.teamCount
    );

    const betweenPicks =
      getBetweenPicksIntelligence(
        currentPick,
        draftTiming
      );

    const tierMarket = Core.getTierMarketSnapshot(
      getRecentDraftedPlayers(boardPickCount, 12),
      availablePlayers,
      betweenPicks.positionPressure
    );
    const mockDraftProgress = getMockDraftProgress();
    const pprRbScarcity = Core.getPprEarlyRbScarcity({
      scoring: leagueSettings.scoring,
      roundNumber,
      availablePlayers,
      rbNeed: needs.baseNeeds.RB,
      flexNeed: needs.flexNeed,
    });
    const stackTargets = Core.getStackTargets(
      myTeamPlayers,
      availablePlayers
    );
    const handcuffTargets = Core.getRbHandcuffTargets(
      myTeamPlayers,
      availablePlayers,
      roundNumber
    );
    const replacementSnapshot = Core.getReplacementValueSnapshot(
      draftPlayers,
      leagueSettings
    );
    const upcomingUserPicks = Core.getUpcomingUserPicks(
      recommendationPick,
      leagueSettings,
      3
    );
    const nextTurnGap = upcomingUserPicks.length > 1
      ? upcomingUserPicks[1] - recommendationPick
      : draftTiming.picksUntilNext;
    const starterCompletionOutlook = Core.getStarterCompletionOutlook(
      myTeamPlayers,
      availablePlayers,
      leagueSettings
    );
    const benchAllocationPlan = Core.getBenchAllocationPlan(
      myTeamPlayers,
      leagueSettings,
      roundNumber
    );

    const context = {
      availablePlayers,
      myTeamPlayers,
      counts,
      needs,
      draftedCount,
      boardPickCount,
      currentPick,
      roundNumber,
      recommendationPick,
      isForecast,
      draftTiming,
      betweenPicks,
      tierMarket,
      mockDraftProgress,
      pprRbScarcity,
      stackTargets,
      handcuffTargets,
      replacementSnapshot,
      upcomingUserPicks,
      nextTurnGap,
      starterCompletionOutlook,
      benchAllocationPlan,
      rosterWarnings:
        getRosterConstructionWarnings(
          myTeamPlayers,
          roundNumber
        ),
    };

    const scored =
      availablePlayers
        .map((player) =>
          scoreRecommendation(
            player,
            context
          )
        )
        .sort(
          (a, b) =>
            b.score - a.score
        );

    scored.forEach((item) => {
      item.goneProbability = getGoneProbability(item, context);
      item.availableProbability = 100 - item.goneProbability;

      const decision = Core.getNowVsLaterScore({
        baseScore: item.score,
        goneProbability: item.goneProbability,
        tierValueScore: item.tierValueScore,
        needScore: item.needScore,
        marketPressureScore: item.marketPressureScore,
        scarcity: item.scarcity,
        pprRbScarcityScore: item.pprRbScarcityScore,
        stackScore: item.stackScore,
        handcuffScore: item.handcuffScore,
        projectionScore: item.projectionScore,
      });

      item.decisionScore = decision.decisionScore;
      item.waitCost = decision.waitCost;
      item.valueAtRisk = decision.valueAtRisk;
    });

    const draftPaths = applyDraftPathSimulation(scored, context);

    scored.sort(
      (a, b) => b.decisionScore - a.decisionScore
    );

    let recommendationPool = scored;

    if (isForecast) {
      const adpWindow = clamp(recommendationPick * 0.08, 1.25, 10);
      const realistic = scored.filter((item) => {
        const adp = numberOrNull(item.effectiveAdp);

        return (
          adp !== null &&
          adp >= recommendationPick - adpWindow &&
          item.availableProbability >= 30
        );
      });
      const probabilityFallback = scored.filter(
        (item) => item.availableProbability >= 35
      );

      recommendationPool = realistic.length >= 4
        ? realistic
        : probabilityFallback.length >= 4
          ? probabilityFallback
          : scored;

      recommendationPool = [...recommendationPool].sort(
        (a, b) =>
          b.decisionScore + b.availableProbability * 0.45 -
          (a.decisionScore + a.availableProbability * 0.45)
      );
    }

    const primary = recommendationPool[0];
    const primaryPosition = String(primary?.player?.pos || "").toUpperCase();
    const bestAlternate = recommendationPool.find(
      (item) =>
        item !== primary &&
        String(item?.player?.pos || "").toUpperCase() !== primaryPosition
    ) || recommendationPool.find((item) => item !== primary) || null;
    const pivotPlan = buildConditionalPivotPlan(
      recommendationPool,
      primary
    );

    return {
      context,
      primary,
      bestAlternate,
      alternatives: pivotPlan.map((pivot) => pivot.item),
      pivotPlan,
      draftPaths: draftPaths
        .sort((a, b) => b.pathScore - a.pathScore)
        .slice(0, 3),
    };
  }

  function recordRecommendationSnapshot(
    recommendation,
    predictedAvailableProbability
  ) {
    const { context, primary, bestAlternate } = recommendation || {};

    if (
      !currentDraftId ||
      !context?.isForecast ||
      !primary?.player ||
      context.recommendationPick <= context.currentPick
    ) {
      return;
    }

    const snapshot = {
      draftId: currentDraftId,
      targetPick: context.recommendationPick,
      boardPick: context.currentPick,
      teamCount: leagueSettings.teamCount,
      scoring: leagueSettings.scoring,
      source: diagnostics?.platformKey || "yahoo",
      playerId: String(playerId(primary.player)),
      playerName: primary.player.name,
      position: primary.player.pos,
      alternateId: bestAlternate?.player
        ? String(playerId(bestAlternate.player))
        : "",
      alternateName: bestAlternate?.player?.name || "",
      predictedAvailableProbability: Math.round(
        clamp(predictedAvailableProbability, 1, 99)
      ),
      recordedAt: new Date().toISOString(),
    };
    const signature = [
      snapshot.draftId,
      snapshot.targetPick,
      snapshot.boardPick,
      snapshot.playerId,
      snapshot.alternateId,
      snapshot.predictedAvailableProbability,
    ].join(":");

    if (signature === lastRecommendationSnapshotSignature) return;
    lastRecommendationSnapshotSignature = signature;

    const nextHistory = recommendationHistory.filter(
      (record) =>
        !(
          String(record?.draftId || "") === snapshot.draftId &&
          Number(record?.targetPick) === snapshot.targetPick
        )
    );

    nextHistory.push(snapshot);
    recommendationHistory = nextHistory;
    refreshAvailabilityCalibration();
    chrome.storage.local.set({
      [STORAGE_KEY_RECOMMENDATION_HISTORY]: nextHistory,
    });
  }

  function renderRecommendation() {
    const recommendationElement =
      shadow.getElementById(
        "dc-recommendation"
      );

    if (!recommendationElement) {
      return;
    }

    const recommendation =
      buildRecommendation();

    if (!recommendation) {
      recommendationElement.innerHTML = `
        <div class="dc-rec-empty">
          No recommendation available.
        </div>
      `;

      return;
    }

    const { context, primary, bestAlternate } = recommendation;

    const player = primary.player;

    const grade = getRecommendationGrade(primary);
    const goneProbability =
      getGoneProbability(primary, context);
    const availableProbability = 100 - goneProbability;
    const urgency = context.isForecast
      ? availableProbability >= 60
        ? "Likely There"
        : "Target"
      : getDraftUrgency(primary, context);
    const displayedProbability = context.isForecast
      ? availableProbability
      : goneProbability;
    const betweenPicks = context.betweenPicks;
    const personalMetrics = primary.personalDraftMetrics ||
      getPersonalDraftMetrics(player, context.draftTiming.lookaheadPick);
    const personalAveragePick = personalMetrics.averagePick === null
      ? null
      : Number(personalMetrics.averagePick.toFixed(1));
    const personalRangeStart = personalMetrics.rangeStart === null
      ? null
      : Math.round(personalMetrics.rangeStart);
    const personalRangeEnd = personalMetrics.rangeEnd === null
      ? null
      : Math.round(personalMetrics.rangeEnd);
    const mockDraftProgress = getMockDraftProgress();
    const personalAdpWeight = Math.round(
      (primary.adpProfile?.personalWeight || 0) * 100
    );
    const effectiveAdp = numberOrNull(primary.effectiveAdp);
    const valueOverReplacement = numberOrNull(
      primary.replacementValue?.valueOverReplacement
    );
    const availabilityCurve = Array.isArray(primary.availabilityCurve)
      ? primary.availabilityCurve
      : [];
    const alternatePlayer = bestAlternate?.player || null;
    const alternateGrade = bestAlternate
      ? getRecommendationGrade(bestAlternate)
      : null;
    const alternateVorp = numberOrNull(
      bestAlternate?.replacementValue?.valueOverReplacement
    );

    recordRecommendationSnapshot(recommendation, availableProbability);

    recommendationElement.innerHTML = `
      <div class="dc-rec-heading">
        <span class="dc-rec-kicker">&#9733; ${
          context.isForecast ? "Projected Best Pick" : "Best Pick"
        }</span>
        <span>${
          context.isForecast
            ? `Forecast for ${getYahooPickLabel(
                context.recommendationPick,
                leagueSettings.teamCount
              )}`
            : `Round ${context.roundNumber} · Pick ${context.currentPick}`
        }</span>
      </div>

      <button class="dc-rec-primary" id="dc-rec-view" type="button">
        <span class="dc-rec-avatar" aria-hidden="true">
          ${
            player.image
              ? `<img src="${escapeMarkup(player.image)}" alt="" />`
              : escapeMarkup(
                  player.name
                    .split(" ")
                    .map((part) => part.charAt(0))
                    .slice(0, 2)
                    .join("")
                )
          }
        </span>
        <span class="dc-rec-player">
          <strong>${player.name}</strong>
          <span>
            <span class="dc-pos dc-pos-${player.pos}">${player.pos}</span>
            ${player.team} · Tier ${getTierLabel(player)}${
              valueOverReplacement === null
                ? ""
                : ` · VORP ${valueOverReplacement >= 0 ? "+" : ""}${valueOverReplacement.toFixed(1)}`
            }
          </span>
        </span>
        <span class="dc-rec-grade">
          <strong>${grade}</strong>
          <span>Draft Grade</span>
        </span>
      </button>

      ${alternatePlayer ? `
        <button
          class="dc-rec-best-alternate"
          id="dc-rec-alternate-view"
          type="button"
          data-id="${playerId(alternatePlayer)}"
        >
          <span>
            <small>Best Alternate · Different Position</small>
            <strong>${escapeMarkup(alternatePlayer.name)}</strong>
          </span>
          <span class="dc-rec-best-alternate-meta">
            <span class="dc-pos dc-pos-${escapeMarkup(alternatePlayer.pos)}">${escapeMarkup(alternatePlayer.pos)}</span>
            ${escapeMarkup(alternatePlayer.team)}
            ${alternateVorp === null
              ? ""
              : ` · VORP ${alternateVorp >= 0 ? "+" : ""}${alternateVorp.toFixed(1)}`}
          </span>
          <em>${alternateGrade} grade</em>
        </button>
      ` : ""}

      <div class="dc-between-picks-panel">
        <div class="dc-between-picks-heading">
          <span>${context.isForecast ? "Before Your Pick" : "Between Your Picks"}</span>
          <small>${betweenPicks.pickCount} pick${betweenPicks.pickCount === 1 ? "" : "s"} · ${betweenPicks.teams.length} team${betweenPicks.teams.length === 1 ? "" : "s"}</small>
        </div>

        <div class="dc-rec-decision-row">
          <span class="dc-rec-urgency dc-rec-urgency-${urgency
            .toLowerCase()
            .replace(/\s+/g, "-")}">${urgency}</span>
          <div class="dc-rec-probability">
            <strong>${displayedProbability}%</strong>
            <span>${
              context.isForecast
                ? `Chance ${player.name.split(" ")[0]} is available at pick ${getYahooPickLabel(
                    context.recommendationPick,
                    leagueSettings.teamCount
                  )}`
                : `Chance ${player.name.split(" ")[0]} is gone before pick ${getYahooPickLabel(
                    betweenPicks.nextUserPick,
                    leagueSettings.teamCount
                  )}`
            }</span>
            <span class="dc-rec-probability-track" aria-hidden="true">
              <i style="width:${displayedProbability}%"></i>
            </span>
          </div>
        </div>

        <div class="dc-personal-adp ${
          personalMetrics.pickSampleSize ? "" : "dc-personal-adp-building"
        }">
          <span class="dc-personal-adp-title">
            Personal Mock Trend
            <em>${mockDraftProgress.completed}/${mockDraftProgress.goal} mocks</em>
            <i class="dc-mock-goal-track" aria-hidden="true">
              <b style="width:${mockDraftProgress.percentage}%"></b>
            </i>
          </span>
          <strong>${personalAveragePick !== null
              ? `Avg pick ${personalAveragePick}`
              : personalMetrics.probabilitySampleSize
                ? `Still available in ${personalMetrics.probabilitySampleSize} eligible mock${personalMetrics.probabilitySampleSize === 1 ? "" : "s"}`
                : "Building your draft sample"}
          </strong>
          <small>${personalAveragePick !== null
              ? `Likely ${personalRangeStart}–${personalRangeEnd} · ${personalMetrics.pickSampleSize} pick${personalMetrics.pickSampleSize === 1 ? "" : "s"} · ${personalMetrics.probabilitySampleSize} odds sample${personalMetrics.probabilitySampleSize === 1 ? "" : "s"}`
              : "Matching mocks update these odds after every recorded pick"}${
                effectiveAdp !== null
                  ? ` · Effective ADP ${effectiveAdp.toFixed(1)} · ${personalAdpWeight}% personal history weight`
                  : ""
              }
          </small>
          ${availabilityCurve.length ? `
            <div class="dc-availability-curve" aria-label="Personal Yahoo availability by upcoming pick">
              ${availabilityCurve.map((entry) => `
                <span>
                  <strong>${getYahooPickLabel(entry.pick, leagueSettings.teamCount)}</strong>
                  <small>${entry.probability}% available</small>
                </span>
              `).join("")}
            </div>
            <em class="dc-personal-volatility">
              ${personalMetrics.volatility || "Building"} volatility
              ${personalMetrics.fallPastBaselineProbability === null
                ? ""
                : ` · Falls past baseline ${Math.round(personalMetrics.fallPastBaselineProbability)}%`}
              ${personalMetrics.earliestPick === null
                ? ""
                : ` · Full range ${Math.round(personalMetrics.earliestPick)}–${Math.round(personalMetrics.latestPick)}`}
            </em>
          ` : ""}
        </div>

      </div>
    `;

    const viewButton =
      shadow.getElementById(
        "dc-rec-view"
      );

    if (viewButton) {
      viewButton.addEventListener(
        "click",
        () => openProfile(player)
      );
    }

    const alternateButton = shadow.getElementById(
      "dc-rec-alternate-view"
    );

    if (alternateButton && alternatePlayer) {
      alternateButton.addEventListener(
        "click",
        () => openProfile(alternatePlayer)
      );
    }

  }

  function buildDraftReport() {
    const players =
      getMyTeamPlayers();
    const currentDraftPicks = getCurrentDraftPicks();
    const picksByPlayerId = new Map();

    currentDraftPicks.forEach((pick) => {
      const historyPlayer = getPlayerById(pick.name);

      if (historyPlayer) {
        picksByPlayerId.set(String(playerId(historyPlayer)), pick);
      }
    });

    const pickValues = players
      .map((player) => {
        const pick = picksByPlayerId.get(String(playerId(player)));
        const selectedAt = numberOrNull(pick?.overall);
        const adp = numberOrNull(player.adp);

        if (selectedAt === null || adp === null || adp <= 0) {
          return null;
        }

        const valueDelta = selectedAt - adp;
        const tolerance = clamp(adp * 0.08, 4, 12);
        let classification;
        let valueScore;

        if (valueDelta > tolerance) {
          classification = "Steal";
          valueScore = 88 + Math.min(
            12,
            ((valueDelta - tolerance) / Math.max(8, tolerance)) * 5
          );
        } else if (valueDelta < -tolerance) {
          classification = "Reach";
          valueScore = 76 - Math.min(
            41,
            ((Math.abs(valueDelta) - tolerance) / Math.max(8, tolerance)) * 8
          );
        } else {
          classification = "At ADP";
          valueScore = 82 + (valueDelta / tolerance) * 4;
        }

        return {
          player,
          selectedAt,
          adp,
          valueDelta,
          classification,
          valueScore: Math.round(clamp(valueScore, 35, 100)),
          estimated: Boolean(pick?.estimatedOverall),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.selectedAt - b.selectedAt);

    const exactPickValues = pickValues.filter((pick) => !pick.estimated);
    const gradedPickValues = exactPickValues.length
      ? exactPickValues
      : pickValues;
    const pickValueCounts = gradedPickValues.reduce(
      (counts, pick) => {
        if (pick.classification === "Steal") counts.steals += 1;
        else if (pick.classification === "Reach") counts.reaches += 1;
        else counts.atAdp += 1;

        return counts;
      },
      { steals: 0, atAdp: 0, reaches: 0 }
    );
    const draftValueScore = gradedPickValues.length
      ? Math.round(
          gradedPickValues.reduce(
            (sum, pick) => sum + pick.valueScore,
            0
          ) / gradedPickValues.length
        )
      : null;

    const requirements =
      getStarterRequirements();

    const counts =
      getRosterCounts(players);

    const needs =
      getRosterNeeds(counts);

    const requiredBase =
      requirements.QB +
      requirements.RB +
      requirements.WR +
      requirements.TE;

    const filledBase =
      Math.min(
        counts.QB,
        requirements.QB
      ) +
      Math.min(
        counts.RB,
        requirements.RB
      ) +
      Math.min(
        counts.WR,
        requirements.WR
      ) +
      Math.min(
        counts.TE,
        requirements.TE
      );

    const starterTotal =
      requiredBase +
      requirements.FLEX;

    const startersFilled =
      filledBase +
      needs.flexFilled;

    const completion =
      starterTotal
        ? startersFilled /
          starterTotal
        : 1;

    const targetRosterSize =
      starterTotal +
      leagueSettings.bench;

    const depth =
      targetRosterSize
        ? Math.min(
            1,
            players.length /
              targetRosterSize
          )
        : 1;

    const valueNumbers =
      players
        .map((player) => {
          const explicit =
            numberOrNull(
              player.valueScore ??
                player.value_score
            );

          if (explicit !== null) {
            return explicit;
          }

          const rank =
            numberOrNull(player.rank);

          const adp =
            numberOrNull(player.adp);

          return (
            rank !== null &&
            adp !== null
              ? adp - rank
              : null
          );
        })
        .filter(
          (value) =>
            value !== null
        );

    const averageValue =
      valueNumbers.length
        ? valueNumbers.reduce(
            (sum, value) =>
              sum + value,
            0
          ) / valueNumbers.length
        : 0;

    const byeCounts =
      players.reduce(
        (map, player) => {
          const bye =
            numberOrNull(player.bye);

          if (bye !== null) {
            map.set(
              bye,
              (map.get(bye) || 0) + 1
            );
          }

          return map;
        },
        new Map()
      );

    const byeCollisions =
      Array.from(
        byeCounts.values()
      ).reduce(
        (sum, count) =>
          sum +
          Math.max(0, count - 2),
        0
      );

    const constructionScore = players.length
      ? Math.round(
          clamp(
            42 +
              completion * 35 +
              depth * 12 +
              clamp(
                averageValue,
                -10,
                18
              ) *
                0.55 -
              byeCollisions * 2.5,
            35,
            98
          )
        )
      : 0;

    /* Pick value drives the grade; construction only breaks close ties. */
    const score = players.length
      ? draftValueScore !== null
        ? Math.round(
            clamp(
              draftValueScore * 0.9 + constructionScore * 0.1,
              35,
              99
            )
          )
        : constructionScore
      : 0;

    const grade =
      score >= 93
        ? "A+"
        : score >= 88
          ? "A"
          : score >= 82
            ? "B+"
            : score >= 76
              ? "B"
              : score >= 70
                ? "C+"
                : score >= 64
                  ? "C"
                  : score
                    ? "D"
                    : "—";

    const strengths = [];
    const concerns = [];

    if (completion >= 1) {
      strengths.push(
        "All configured starting spots are covered"
      );
    }

    if (pickValueCounts.steals > 0) {
      strengths.push(
        `${pickValueCounts.steals} pick${
          pickValueCounts.steals === 1 ? "" : "s"
        } landed after market ADP`
      );
    }

    if (
      counts.RB >=
      requirements.RB + 2
    ) {
      strengths.push(
        "Useful RB depth"
      );
    }

    if (
      counts.WR >=
      requirements.WR + 2
    ) {
      strengths.push(
        "Useful WR depth"
      );
    }

    if (
      byeCollisions === 0 &&
      players.length >= 6
    ) {
      strengths.push(
        "Bye weeks are well distributed"
      );
    }

    Object.entries(
      needs.baseNeeds
    ).forEach(
      ([position, missing]) => {
        if (missing > 0) {
          concerns.push(
            `Still needs ${missing} ${position} starter${
              missing > 1 ? "s" : ""
            }`
          );
        }
      }
    );

    if (needs.flexNeed > 0) {
      concerns.push(
        `Still needs ${needs.flexNeed} FLEX player${
          needs.flexNeed > 1
            ? "s"
            : ""
        }`
      );
    }

    if (byeCollisions > 0) {
      concerns.push(
        `${byeCollisions} avoidable bye-week overlap${
          byeCollisions > 1
            ? "s"
            : ""
        }`
      );
    }

    if (
      depth < 0.75 &&
      players.length
    ) {
      concerns.push(
        "Bench depth is still developing"
      );
    }

    if (
      !strengths.length &&
      players.length
    ) {
      strengths.push(
        "Roster foundation is in progress"
      );
    }

    if (
      !concerns.length &&
      players.length
    ) {
      concerns.push(
        "No major roster construction concerns detected"
      );
    }

    if (pickValueCounts.reaches > 0) {
      concerns.push(
        `${pickValueCounts.reaches} pick${
          pickValueCounts.reaches === 1 ? " was" : "s were"
        } made meaningfully ahead of ADP`
      );
    }

    const byRank = (a, b) =>
      (numberOrNull(a.rank) ?? 9999) -
      (numberOrNull(b.rank) ?? 9999);
    const remaining = [...players].sort(byRank);
    const projectedStarters = [];

    ["QB", "RB", "WR", "TE"].forEach((position) => {
      let slots = requirements[position] || 0;

      for (let index = 0; index < remaining.length && slots > 0; ) {
        if (remaining[index].pos === position) {
          projectedStarters.push(remaining.splice(index, 1)[0]);
          slots -= 1;
        } else {
          index += 1;
        }
      }
    });

    let flexSlots = requirements.FLEX || 0;
    for (let index = 0; index < remaining.length && flexSlots > 0; ) {
      if (["RB", "WR", "TE"].includes(remaining[index].pos)) {
        projectedStarters.push(remaining.splice(index, 1)[0]);
        flexSlots -= 1;
      } else {
        index += 1;
      }
    }

    const benchPlayers = remaining.sort(byRank);
    const positionGrades = Object.fromEntries(
      ["QB", "RB", "WR", "TE"].map((position) => {
        const positionPlayers = players
          .filter((player) => player.pos === position)
          .sort(byRank);
        const required = requirements[position] || 1;
        const coverage = Math.min(1, positionPlayers.length / required);
        const averageRank = positionPlayers.length
          ? positionPlayers.reduce(
              (sum, player) =>
                sum + (numberOrNull(player.rank) ?? 150),
              0
            ) / positionPlayers.length
          : 150;
        const positionScore = Math.round(
          clamp(
            coverage * 65 +
              clamp(102 - averageRank * 0.85, 25, 35),
            45,
            98
          )
        );

        return [
          position,
          {
            score: positionScore,
            grade: getLetterGrade(positionScore),
            count: positionPlayers.length,
            required,
          },
        ];
      })
    );

    const byeConflicts = Array.from(byeCounts.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => a[0] - b[0])
      .map(([week]) => ({
        week,
        players: players
          .filter((player) => numberOrNull(player.bye) === week)
          .map((player) => player.name),
      }));

    const needsList = concerns.filter((item) =>
      item.startsWith("Still needs")
    );
    const weaknesses = concerns.filter(
      (item) => !item.startsWith("Still needs")
    );
    const rosterBalance = Math.round(
      clamp(
        completion * 78 +
          Math.min(22, benchPlayers.length * 4) -
          byeCollisions * 3,
        0,
        100
      )
    );
    const replacementSnapshot = Core.getReplacementValueSnapshot(
      draftPlayers,
      leagueSettings
    );
    const strategyDrafts = mockAdpAnalytics.drafts.map((draft) => ({
      ...draft,
      userPicks: (Array.isArray(draft.userPicks) ? draft.userPicks : [])
        .map((pick) =>
          getPlayerById(pick.playerId || pick.name)
        )
        .filter(Boolean),
    }));
    const mockStrategyReport = Core.getMockDraftStrategyReport(
      strategyDrafts,
      leagueSettings,
      replacementSnapshot
    );
    const recommendationCalibration =
      Core.getAvailabilityCalibrationReport(
        recommendationHistory,
        mockAdpAnalytics.drafts
      );

    return {
      players,
      counts,
      needs,
      completion,
      depth,
      averageValue,
      constructionScore,
      draftValueScore,
      pickValues,
      gradedPickValues,
      pickValueCounts,
      byeCollisions,
      score,
      grade,
      strengths,
      concerns,
      weaknesses,
      needsList,
      positionGrades,
      rosterBalance,
      byeConflicts,
      projectedStarters,
      benchPlayers,
      targetRosterSize,
      replacementSnapshot,
      mockStrategyReport,
      recommendationCalibration,
    };
  }

  function renderDraftReport() {
    const body =
      shadow.getElementById(
        "dc-report-body"
      );

    if (!body) return;

    const report =
      buildDraftReport();

    if (!report.players.length) {
      body.innerHTML = `
        <div class="dc-empty-state">
          <strong>
            No roster detected yet
          </strong>

          <span>
            DraftIQ will build this report as your draft platform identifies players on your team.
          </span>
        </div>
      `;

      return;
    }

    const rosterRows =
      [...report.players]
        .sort(
          (a, b) =>
            (
              numberOrNull(a.rank) ??
              9999
            ) -
            (
              numberOrNull(b.rank) ??
              9999
            )
        )
        .map(
          (player) => `
            <div class="dc-report-player">
              <span class="dc-pos dc-pos-${player.pos}">
                ${player.pos}
              </span>

              <strong>
                ${player.name}
              </strong>

              <span>
                ${player.team || "—"}
              </span>

              <span>
                Rank ${formatValue(
                  player.rank
                )}
              </span>
            </div>
          `
        )
        .join("");

    const renderLineupPlayer = (player) => `
      <div class="dc-report-lineup-player">
        <span class="dc-pos dc-pos-${player.pos}">${player.pos}</span>
        <strong>${player.name}</strong>
        <span>${player.team || "—"}</span>
        <small>Rank ${formatValue(player.rank)}</small>
      </div>
    `;

    const starterRows = report.projectedStarters
      .map(renderLineupPlayer)
      .join("");
    const benchRows = report.benchPlayers.length
      ? report.benchPlayers.map(renderLineupPlayer).join("")
      : `<div class="dc-report-empty-line">No bench players detected yet.</div>`;
    const byeConflictRows = report.byeConflicts.length
      ? report.byeConflicts
          .map(
            (conflict) => `
              <div class="dc-report-bye-row">
                <strong>Week ${conflict.week}</strong>
                <span>${conflict.players.join(", ")}</span>
              </div>
            `
          )
          .join("")
      : `<div class="dc-report-positive">No meaningful bye-week conflicts.</div>`;
    const pickValueRows = report.pickValues.length
      ? report.pickValues
          .map((pick) => {
            const className = pick.classification
              .toLowerCase()
              .replace(/\s+/g, "-");
            const deltaText = Math.abs(pick.valueDelta) < 0.05
              ? "At market"
              : pick.valueDelta > 0
                ? `${formatNumber(pick.valueDelta, 1)} picks after ADP`
                : `${formatNumber(Math.abs(pick.valueDelta), 1)} picks early`;

            return `
              <div class="dc-report-value-row">
                <span class="dc-pos dc-pos-${pick.player.pos}">${pick.player.pos}</span>
                <strong>${pick.player.name}</strong>
                <span>Pick ${formatNumber(pick.selectedAt, 0)}</span>
                <span>ADP ${formatNumber(pick.adp, 1)}</span>
                <small>${deltaText}</small>
                <b class="dc-report-value-badge dc-report-value-${className}">${pick.classification}</b>
              </div>
            `;
          })
          .join("")
      : `<div class="dc-report-empty-line">Exact pick values will appear as Yahoo board selections are recorded.</div>`;
    const strategyRows = report.mockStrategyReport.openings.length
      ? report.mockStrategyReport.openings
          .slice(0, 6)
          .map((opening, index) => `
            <div class="dc-report-strategy-row${index === 0 ? " dc-report-strategy-best" : ""}">
              <strong>${escapeMarkup(opening.opening)}</strong>
              <span>${opening.sampleSize} mock${opening.sampleSize === 1 ? "" : "s"}</span>
              <span>${formatNumber(opening.averageStarterProjection, 1)} projected starter pts</span>
              <span>${formatNumber(opening.averageTotalVorp, 1)} total VORP</span>
            </div>
          `)
          .join("")
      : `<div class="dc-report-empty-line">Historical roster builds will appear as completed mocks are backfilled with your snake slot.</div>`;
    const calibration = report.recommendationCalibration;
    const calibrationScore = calibration.brierScore === null
      ? null
      : Math.round((1 - calibration.brierScore) * 100);
    const calibrationBias = calibration.bias === null
      ? "Building"
      : Math.abs(calibration.bias) < 4
        ? "Well calibrated"
        : calibration.bias > 0
          ? "Too conservative"
          : "Too optimistic";
    const calibrationRows = calibration.buckets
      .filter((bucket) => bucket.sampleSize > 0)
      .map((bucket) => `
        <div class="dc-report-calibration-row">
          <strong>${bucket.min}â€“${bucket.max}%</strong>
          <span>${bucket.sampleSize} forecast${bucket.sampleSize === 1 ? "" : "s"}</span>
          <span>${formatNumber(bucket.averagePredicted, 0)}% predicted</span>
          <span>${formatNumber(bucket.actualRate, 0)}% available</span>
        </div>
      `)
      .join("");

    body.innerHTML = `
      <div class="dc-report-score-card">
        <div class="dc-report-grade">
          <strong>
            ${report.grade}
          </strong>

          <span>
            ${report.score}/100
          </span>
        </div>

        <div>
          <div class="dc-report-score-title">
            DraftIQ draft grade
          </div>

          <div class="dc-report-score-copy">
            ${report.pickValueCounts.steals} steals ·
            ${report.pickValueCounts.atAdp} at ADP ·
            ${report.pickValueCounts.reaches} reaches ·
            ${report.gradedPickValues.length} picks graded
          </div>
        </div>
      </div>

      <div class="dc-report-value-summary">
        <div><span>ADP Value</span><strong>${report.draftValueScore ?? "—"}</strong></div>
        <div><span>Steals</span><strong class="dc-report-value-positive">${report.pickValueCounts.steals}</strong></div>
        <div><span>At ADP</span><strong>${report.pickValueCounts.atAdp}</strong></div>
        <div><span>Reaches</span><strong class="dc-report-value-negative">${report.pickValueCounts.reaches}</strong></div>
      </div>

      <div class="dc-report-position-grid">
        ${["QB", "RB", "WR", "TE"]
          .map(
            (position) => `
              <div class="dc-report-position-card">
                <span>${position}</span>
                <strong>${report.positionGrades[position].grade}</strong>
                <small>${report.positionGrades[position].count}/${report.positionGrades[position].required} rostered</small>
              </div>
            `
          )
          .join("")}
      </div>

      <div class="dc-report-balance-card">
        <div>
          <span>Roster Balance</span>
          <strong>${report.rosterBalance}</strong>
        </div>
        <div class="dc-report-balance-track"><i style="width:${report.rosterBalance}%"></i></div>
        <span>${report.benchPlayers.length} bench player${report.benchPlayers.length === 1 ? "" : "s"} · ${Math.round(report.depth * 100)}% roster depth</span>
      </div>

      <section class="dc-report-pick-values">
        <div class="dc-report-roster-title">Pick Value vs ADP</div>
        <div class="dc-report-value-list">${pickValueRows}</div>
      </section>

      <section class="dc-report-strategies">
        <div class="dc-report-roster-title">Mock Strategy Lab</div>
        <p>${
          report.mockStrategyReport.bestOpening
            ? `Best opening so far: <strong>${escapeMarkup(report.mockStrategyReport.bestOpening.opening)}</strong> across ${report.mockStrategyReport.draftCount} eligible completed mocks.`
            : `Building strategy comparisons from ${report.mockStrategyReport.draftCount} eligible completed mocks.`
        }</p>
        <div class="dc-report-strategy-list">${strategyRows}</div>
      </section>

      <section class="dc-report-calibration">
        <div class="dc-report-roster-title">Recommendation Calibration</div>
        ${calibration.sampleSize ? `
          <div class="dc-report-calibration-metrics">
            <div><span>Forecast score</span><strong>${calibrationScore}</strong></div>
            <div><span>Predicted</span><strong>${formatNumber(calibration.averagePredicted, 0)}%</strong></div>
            <div><span>Actually there</span><strong>${formatNumber(calibration.actualRate, 0)}%</strong></div>
            <div><span>Used rec/alt</span><strong>${calibration.recommendationSelections}/${calibration.alternateSelections}</strong></div>
          </div>
          <p>${calibrationBias} across ${calibration.sampleSize} evaluated forecast${calibration.sampleSize === 1 ? "" : "s"}. DraftIQ automatically corrects future availability odds as this sample grows.</p>
          <div class="dc-report-calibration-list">${calibrationRows}</div>
        ` : `
          <div class="dc-report-empty-line">DraftIQ is saving recommendation forecasts now. Calibration results appear after those target picks finish in completed mocks.</div>
        `}
      </section>

      <div class="dc-report-columns">
        <section>
          <h3>Strengths</h3>

          <ul>
            ${report.strengths
              .map(
                (item) =>
                  `<li>${item}</li>`
              )
              .join("")}
          </ul>
        </section>

        <section>
          <h3>Weaknesses</h3>

          <ul>
            ${(report.weaknesses.length
              ? report.weaknesses
              : ["No major weaknesses detected"])
              .map(
                (item) =>
                  `<li>${item}</li>`
              )
              .join("")}
          </ul>
        </section>

        <section>
          <h3>Needs</h3>
          <ul>
            ${(report.needsList.length
              ? report.needsList
              : ["Starting lineup needs are covered"])
              .map((item) => `<li>${item}</li>`)
              .join("")}
          </ul>
        </section>
      </div>

      <div class="dc-report-lineup-grid">
        <section>
          <div class="dc-report-roster-title">Projected Starters</div>
          <div class="dc-report-lineup-list">${starterRows}</div>
        </section>
        <section>
          <div class="dc-report-roster-title">Bench Depth</div>
          <div class="dc-report-lineup-list">${benchRows}</div>
        </section>
      </div>

      <div class="dc-report-bye-card">
        <div class="dc-report-roster-title">Bye Week Conflicts</div>
        ${byeConflictRows}
      </div>

      <details class="dc-report-all-roster">
        <summary>All detected players (${report.players.length})</summary>
        <div class="dc-report-roster">${rosterRows}</div>
      </details>

      <div class="dc-report-disclaimer">
        Draft grade is weighted 90% by where each player was selected versus market ADP and 10% by roster construction. ADP tolerance grows slightly in later rounds.
      </div>
    `;
  }

  function getGraphBarClass(points) {
    if (points < 7) {
      return "dc-graph-bar-bad";
    }

    if (points < 13) {
      return "dc-graph-bar-mid";
    }

    return "dc-graph-bar-good";
  }

  function renderMiniGraph(gameLog, season = {}) {
    if (
      !Array.isArray(gameLog) ||
      gameLog.length === 0
    ) {
      return `
        <div class="dc-profile-note">
          No 2025 season game log available yet.
        </div>
      `;
    }

    const regularSeasonGames =
      gameLog
        .filter((game) => {
          const week = Number(
            game?.week
          );

          return (
            Number.isInteger(week) &&
            week >= 1 &&
            week <= 18
          );
        })
        .sort(
          (a, b) =>
            Number(a.week) -
            Number(b.week)
        );

    if (
      regularSeasonGames.length === 0
    ) {
      return `
        <div class="dc-profile-note">
          No 2025 season game log available yet.
        </div>
      `;
    }

    const points = regularSeasonGames.map(
      (game) => Number(game.fantasyPoints || 0)
    );
    const maxPoints = Math.max(...points, 1);
    const average =
      points.reduce((sum, value) => sum + value, 0) /
      points.length;

    const rows = regularSeasonGames
      .map((game) => {
        const fantasyPoints = Number(game.fantasyPoints || 0);
        const outcome =
          fantasyPoints >= average * 1.25
            ? "Boom"
            : fantasyPoints <= average * 0.6
              ? "Bust"
              : "Steady";
        const barWidth = Math.max(
          5,
          Math.round((fantasyPoints / maxPoints) * 100)
        );

        return `
          <div class="dc-game-row">
            <span>W${formatValue(game.week)}</span>
            <strong>${escapeMarkup(game.opponent || "-")}</strong>
            <span>${formatNumber(fantasyPoints, 1)}</span>
            <span class="dc-game-outcome dc-game-outcome-${outcome.toLowerCase()}">${outcome}</span>
            <span class="dc-game-bar"><i class="${getGraphBarClass(fantasyPoints)}" style="width:${barWidth}%"></i></span>
          </div>
        `;
      })
      .join("");

    return `
      <div class="dc-profile-section-title dc-profile-section-title-row">
        <span>2025 Season Game Log</span>
      </div>

      <div class="dc-performance-grid">
        <div><span>Boom</span><strong>${Math.round(Number(season.boomRate || 0) * 100)}%</strong></div>
        <div><span>Bust</span><strong>${Math.round(Number(season.bustRate || 0) * 100)}%</strong></div>
        <div><span>Consistency</span><strong>${Math.round(Number(season.consistency || 0) * 100)}%</strong></div>
        <div><span>Floor</span><strong>${formatNumber(season.floor, 1)}</strong></div>
        <div><span>Ceiling</span><strong>${formatNumber(season.ceiling, 1)}</strong></div>
      </div>

      <div class="dc-game-log" aria-label="2025 season fantasy points by week">
        <div class="dc-game-row dc-game-header">
          <span>Week</span><span>Opp</span><span>FP</span><span>Result</span><span>Performance</span>
        </div>
        ${rows}
      </div>
    `;
  }

  function renderProfileMetric(label, value) {
    return `
      <div class="dc-profile-summary-pill">
        <span>${escapeMarkup(label)}</span>
        <strong>${escapeMarkup(value)}</strong>
      </div>
    `;
  }

  function getPlayerDraftScore(player, effectiveAdp = null) {
    const rank = numberOrNull(player.rank) ?? 150;
    const adp = numberOrNull(effectiveAdp) ??
      numberOrNull(player.adp) ??
      rank;
    const tier = numberOrNull(player.tier) ?? 8;
    const scheduleScore =
      numberOrNull(getScheduleStrength(player).score) ?? 70;

    return Math.round(
      clamp(
        96 -
          Math.max(0, rank - 1) * 0.28 +
          clamp(adp - rank, -12, 12) * 0.35 -
          Math.max(0, tier - 1) * 1.4 +
          (scheduleScore - 70) * 0.08,
        55,
        99
      )
    );
  }

  function getLetterGrade(score) {
    if (score >= 95) return "A+";
    if (score >= 90) return "A";
    if (score >= 86) return "A-";
    if (score >= 82) return "B+";
    if (score >= 78) return "B";
    if (score >= 74) return "B-";
    if (score >= 68) return "C+";
    if (score >= 62) return "C";
    return "D";
  }

  function closeProfile() {
    selectedPlayer = null;
    renderList();
  }

  function openProfile(player) {
    const isSamePlayer =
      selectedPlayer &&
      String(playerId(selectedPlayer)) ===
        String(playerId(player));

    selectedPlayer = isSamePlayer ? null : player;
    renderList();
  }

  function renderProfile() {
    const profileElement =
      shadow.getElementById(
        "dc-inline-profile"
      );

    if (!profileElement) return;

    if (!selectedPlayer) {
      profileElement.innerHTML = "";
      return;
    }

    const player = selectedPlayer;

    if (isPlayerDrafted(player)) {
      selectedPlayer = null;
      profileElement.innerHTML = "";
      renderList();
      return;
    }

    const stats = player.stats || {};
    const season = stats.season || {};
    const gameLog = stats.gameLog || [];
    const image = player.image || "";

    const projection =
      getPlayerProjection(player);

    const projectedPpg =
      getPlayerProjectedPpg(player);

    const adpProfile = getPlayerAdpProfile(
      player,
      getCurrentOverallPick()
    );

    const scheduleStrength =
      getScheduleStrength(player);

    const draftScore =
      getPlayerDraftScore(player, adpProfile.adp);

    const letterGrade =
      getLetterGrade(draftScore);
    const newsMarkup =
      renderRotoWireNews(player);
    const sourceBreakdownMarkup =
      renderSourceBreakdown(player);

    profileElement.innerHTML = `
      <div class="dc-profile-header">
        ${
          image
            ? `
              <img
                class="dc-profile-image"
                src="${image}"
                alt="${player.name}"
              />
            `
            : `
              <div class="dc-profile-image"></div>
            `
        }

        <div class="dc-profile-player">
          <div class="dc-profile-name">
            ${player.name}
          </div>

          <div class="dc-profile-meta">
            <span class="dc-pos dc-pos-${player.pos}">
              ${player.pos}
            </span>

            ${player.team} ·
            Bye ${formatValue(player.bye)} ·
            Tier ${getTierLabel(player)} ·
            Rank ${formatValue(player.rank)}
          </div>

          <div class="dc-profile-meta">
            Proj ${formatNumber(
              projection,
              1
            )} ·
            Proj PPG ${formatNumber(
              projectedPpg,
              2
            )} ·
            ${getScheduleText(player)}
          </div>
        </div>

        <div class="dc-profile-grade-badge" title="DraftIQ player score ${draftScore} out of 100">
          <strong>${letterGrade}</strong>
          <span>${draftScore}</span>
        </div>

        <button
          class="dc-profile-close"
          id="dc-profile-close"
          title="Close"
        >
          ×
        </button>
      </div>

      <div class="dc-profile-summary-strip" aria-label="Quick player profile stats">
        ${renderProfileMetric("Prev PPG", formatValue(season.ppg))}
        ${renderProfileMetric("Games", formatValue(season.games))}
        ${renderProfileMetric("Proj PPG", formatNumber(projectedPpg, 2))}
        ${renderProfileMetric("ADP", formatNumber(adpProfile.adp, 1))}
        ${renderProfileMetric("SOS", formatValue(scheduleStrength.label))}
        ${renderProfileMetric("Bye", `W${formatValue(player.bye)}`)}
      </div>

      ${renderMiniGraph(gameLog, season)}

      <div class="dc-profile-details" aria-label="More player profile details">
        <details class="dc-profile-disclosure">
          <summary>
            <span>Draft Outlook</span>
            <small>Projection, ADP, schedule</small>
          </summary>

          <div class="dc-outlook dc-profile-disclosure-body">
            <div class="dc-outlook-grid">
              <div>
                <div class="dc-outlook-label">
                  Projection
                </div>

                <div class="dc-outlook-value">
                  ${formatNumber(
                    projection,
                    1
                  )}
                </div>
              </div>

              <div>
                <div class="dc-outlook-label">
                  Proj PPG
                </div>

                <div class="dc-outlook-value">
                  ${formatNumber(
                    projectedPpg,
                    2
                  )}
                </div>
              </div>

              <div>
                <div class="dc-outlook-label">
                  ADP
                </div>

                <div class="dc-outlook-value">
                  ${formatNumber(
                    adpProfile.adp,
                    1
                  )}
                </div>
              </div>

              <div>
                <div class="dc-outlook-label">
                  Bye Week
                </div>

                <div class="dc-outlook-value">
                  Week ${formatValue(
                    player.bye
                  )}
                </div>
              </div>

              <div>
                <div class="dc-outlook-label">
                  SOS
                </div>

                <div class="dc-outlook-value">
                  ${formatValue(
                    scheduleStrength.label
                  )}
                </div>
              </div>

              <div>
                <div class="dc-outlook-label">
                  SOS Rank
                </div>

                <div class="dc-outlook-value">
                  ${
                    scheduleStrength.rank !== null &&
                    scheduleStrength.rank !== undefined
                      ? `#${scheduleStrength.rank}`
                      : "-"
                  }
                </div>
              </div>

              <div>
                <div class="dc-outlook-label">
                  Schedule Score
                </div>

                <div class="dc-outlook-value">
                  ${formatNumber(scheduleStrength.score, 0)}
                </div>
              </div>
            </div>
          </div>
        </details>

        ${
          newsMarkup
            ? `
              <details class="dc-profile-disclosure">
                <summary>
                  <span>Latest News</span>
                  <small>RotoWire note</small>
                </summary>

                <div class="dc-profile-disclosure-body">
                  ${newsMarkup}
                </div>
              </details>
            `
            : ""
        }

        <details class="dc-profile-disclosure">
          <summary>
            <span>Source Breakdown</span>
            <small>Yahoo, ESPN, Sleeper</small>
          </summary>

          <div class="dc-profile-disclosure-body">
            ${sourceBreakdownMarkup}
          </div>
        </details>
      </div>
    `;

    shadow
      .getElementById(
        "dc-profile-close"
      )
      .addEventListener(
        "click",
        closeProfile
      );

  }

  function renderFooter() {
    const footerElement =
      shadow.getElementById(
        "dc-footer"
      );

    if (!footerElement) return;

    footerElement.classList.remove(
      "dc-footer-loading",
      "dc-footer-success",
      "dc-footer-error"
    );

    if (footerStatus) {
      footerElement.classList.add(
        `dc-footer-${footerStatusType}`
      );

      footerElement.textContent =
        footerStatus;

      return;
    }

    const updatedLabel =
      formatUpdatedAt(
        draftDataUpdatedAt
      );

    const sourceText =
      draftDataVersion === "bundled"
        ? "Bundled data"
        : updatedLabel
          ? `Updated ${updatedLabel}`
          : "Remote data";

    const availableCount =
      filteredPlayers().length;

    footerElement.innerHTML = `
      ${sourceText} ·
      ${availableCount} available ·
      Click player to expand analysis
      <span>↓</span>
    `;
  }

  function renderList() {
    const listElement =
      shadow.getElementById(
        "dc-list"
      );

    let players =
      filteredPlayers();

    if (
      selectedPlayer &&
      !isPlayerDrafted(selectedPlayer) &&
      !players.some(
        (player) =>
          String(playerId(player)) ===
          String(playerId(selectedPlayer))
      )
    ) {
      players = [selectedPlayer, ...players];
    }

    let html = "";
    const favoriteCount = players.filter(
      isPlayerFavorite
    ).length;
    let favoriteHeadingRendered = false;
    let rankingsHeadingRendered = false;
    const mockDraftProgress = getMockDraftProgress();
    const adpTargetPick = getCurrentOverallPick();
    const stackTargetLookup = new Map(
      Core.getStackTargets(
        getMyTeamPlayers(),
        getAvailableSkillPlayers()
      ).map((target) => [
        String(playerId(target.player)),
        target,
      ])
    );

    players.forEach((player) => {
      const isSelected =
        selectedPlayer &&
        String(
          playerId(selectedPlayer)
        ) ===
          String(playerId(player));

      const isFavorite =
        isPlayerFavorite(player);

      const projection =
        getPlayerProjection(player);

      const projectedPpg =
        getPlayerProjectedPpg(player);
      const adpProfile = getPlayerAdpProfile(
        player,
        adpTargetPick,
        mockDraftProgress
      );
      const stackTarget = stackTargetLookup.get(
        String(playerId(player))
      );
      const stackAnchor = stackTarget?.anchor || null;
      const stackAnchorName = stackAnchor?.name || "rostered teammate";
      const stackAnchorInitials = String(stackAnchor?.name || "")
        .split(" ")
        .map((part) => part.charAt(0))
        .slice(0, 2)
        .join("");

      if (isFavorite && !favoriteHeadingRendered) {
        html += `<div class="dc-list-section-label dc-list-section-favorites">&#9733; Pinned Favorites</div>`;
        favoriteHeadingRendered = true;
      }

      if (
        !isFavorite &&
        favoriteCount > 0 &&
        !rankingsHeadingRendered
      ) {
        html += `<div class="dc-list-section-label">Rankings</div>`;
        rankingsHeadingRendered = true;
      }

      html += `
        <div
          class="dc-card${
            isSelected
              ? " dc-selected"
              : ""
          }"
          data-id="${playerId(player)}"
          role="button"
          tabindex="0"
          aria-expanded="${Boolean(isSelected)}"
        >
          <div class="dc-card-rank">
            ${formatValue(player.rank)}
          </div>

          <div class="dc-card-main${stackTarget ? " dc-card-main-stack" : ""}">
            <div class="dc-card-name">
              ${player.name}
              <span class="dc-card-chevron" aria-hidden="true">${isSelected ? "&#9652;" : "&#9662;"}</span>
            </div>

            <div class="dc-card-meta">
              <span class="dc-pos dc-pos-${player.pos}">
                ${player.pos}
              </span>
              ${player.team} ·
              ${getScheduleStrength(player).label} ·
              ${formatNumber(projectedPpg, 2)} PPG
            </div>

            ${stackTarget ? `
              <span
                class="dc-card-stack-target"
                title="Stack target: ${escapeMarkup(player.name)} with ${escapeMarkup(stackAnchorName)}"
                aria-label="Stack target: ${escapeMarkup(player.name)} with ${escapeMarkup(stackAnchorName)}"
              >
                ${stackAnchor?.image
                  ? `<img src="${escapeMarkup(stackAnchor.image)}" alt="" />`
                  : escapeMarkup(stackAnchorInitials)}
              </span>
            ` : ""}
          </div>

          <div class="dc-card-tier" title="${escapeMarkup(getTierTitle(player))}">${getTierLabel(player)}</div>

          <div class="dc-card-adp">
            ${formatNumber(
              adpProfile.adp,
              1
            )}
          </div>

          <div class="dc-card-proj">
            ${formatNumber(
              projection,
              1
            )}
          </div>

          <div class="dc-card-actions">
            <button
              class="dc-star${isFavorite ? " dc-star-active" : ""}"
              type="button"
              aria-label="${isFavorite ? "Remove" : "Add"} ${player.name} ${isFavorite ? "from" : "to"} favorites"
              aria-pressed="${isFavorite}"
              title="${isFavorite ? "Remove favorite" : "Favorite player"}"
            >${isFavorite ? "&#9733;" : "&#9734;"}</button>
          </div>
        </div>

        ${
          isSelected
            ? `<section class="dc-inline-profile" id="dc-inline-profile" data-id="${playerId(player)}"></section>`
            : ""
        }
      `;
    });

    listElement.innerHTML =
      html ||
      `
        <div class="dc-no-results">
          No available matching players
        </div>
      `;

    listElement
      .querySelectorAll(".dc-star")
      .forEach((star) => {
        star.addEventListener(
          "click",
          (event) => {
            event.preventDefault();
            event.stopPropagation();

            const card =
              star.closest(".dc-card");

            const player = card
              ? getPlayerById(
                  card.getAttribute(
                    "data-id"
                  )
                )
              : null;

            if (player) {
              toggleFavorite(player);
            }
          }
        );
      });

    listElement
      .querySelectorAll(".dc-card")
      .forEach((card) => {
        card.addEventListener(
          "click",
          () => {
            const id =
              card.getAttribute(
                "data-id"
              );

            const player =
              getPlayerById(id);

            if (!player) return;

            openProfile(player);
          }
        );

        card.addEventListener("keydown", (event) => {
          if (
            event.key !== "Enter" &&
            event.key !== " "
          ) {
            return;
          }

          if (event.target.closest("button")) return;

          event.preventDefault();
          const player = getPlayerById(
            card.getAttribute("data-id")
          );
          if (player) openProfile(player);
        });
      });

    renderProfile();
    renderRecommendation();
    renderCurrentPick();
    renderFooter();
  }

  function setHidden(
    hidden,
    save = true
  ) {
    root.classList.toggle(
      "dc-hidden",
      hidden
    );

    if (hidden) {
      closeDrawers();

    }

    if (save) {
      chrome.storage.local.set({
        [STORAGE_KEY_HIDDEN]:
          hidden,
      });
    }
  }

  function renderDraftStateViews() {
    renderList();
    renderProfile();
    renderSyncStatus();
    renderCurrentPick();
    renderDraftReport();
  }

  function openDraftIQ() {
    setHidden(false);
    renderDraftStateViews();
    requestRotoWireRefresh();
  }

  function loadState() {
    chrome.storage.local.get(
      [
        STORAGE_KEY_DRAFTED,
        STORAGE_KEY_MANUAL_DRAFTED_MIGRATED,
        STORAGE_KEY_MY_TEAM,
        STORAGE_KEY_POSITION,
        STORAGE_KEY_HIDDEN,
        STORAGE_KEY_REMOTE_DATA,
        STORAGE_KEY_REMOTE_DATA_VERSION,
        STORAGE_KEY_LEAGUE_SETTINGS,
        STORAGE_KEY_DIAGNOSTICS,
        STORAGE_KEY_FAVORITES,
        STORAGE_KEY_SORT,
        STORAGE_KEY_CURRENT_DRAFT_ID,
        STORAGE_KEY_DRAFTS_IN_PROGRESS,
        STORAGE_KEY_MOCK_ADP_ANALYTICS,
        STORAGE_KEY_RECOMMENDATION_HISTORY,
      ],
      (result) => {
        leagueSettings =
          Core.normalizeLeagueSettings(
            result[
              STORAGE_KEY_LEAGUE_SETTINGS
            ]
          );

        draftPlayers = Core.applyFantasyPointTiers(
          draftPlayers,
          "ppr",
          historicalFantasyPoints
        );

        diagnostics =
          result[
            STORAGE_KEY_DIAGNOSTICS
          ] || null;

        currentDraftId = String(
          result[STORAGE_KEY_CURRENT_DRAFT_ID] || ""
        );

        draftsInProgress =
          result[STORAGE_KEY_DRAFTS_IN_PROGRESS] || {};

        recommendationHistory = Array.isArray(
          result[STORAGE_KEY_RECOMMENDATION_HISTORY]
        )
          ? result[STORAGE_KEY_RECOMMENDATION_HISTORY]
          : [];

        applyMockAdpAnalytics(
          result[STORAGE_KEY_MOCK_ADP_ANALYTICS]
        );

        if (
          result[
            STORAGE_KEY_REMOTE_DATA
          ]
        ) {
          applyRemoteData(
            result[
              STORAGE_KEY_REMOTE_DATA
            ],
            result[
              STORAGE_KEY_REMOTE_DATA_VERSION
            ] || "remote"
          );
        }

        if (
          !result[
            STORAGE_KEY_MANUAL_DRAFTED_MIGRATED
          ]
        ) {
          draftedIds = new Set();

          chrome.storage.local.set({
            [STORAGE_KEY_DRAFTED]: [],
            [STORAGE_KEY_MANUAL_DRAFTED_MIGRATED]: true,
          });
        } else if (
          result[
            STORAGE_KEY_DRAFTED
          ]
        ) {
          draftedIds = new Set(
            result[
              STORAGE_KEY_DRAFTED
            ]
          );
        }

        if (
          result[
            STORAGE_KEY_MY_TEAM
          ]
        ) {
          myTeamIds = new Set(
            result[
              STORAGE_KEY_MY_TEAM
            ]
          );
        }

        favoriteIds = new Set(
          result[
            STORAGE_KEY_FAVORITES
          ] || []
        );

        sortMode = [
          "favorites",
          "rank",
          "adp",
          "projection",
        ].includes(
          result[STORAGE_KEY_SORT]
        )
          ? result[STORAGE_KEY_SORT]
          : "favorites";

        shadow.getElementById(
          "dc-sort"
        ).value = sortMode;

        removeDraftedFavorites();

        if (
          result[
            STORAGE_KEY_POSITION
          ]
        ) {
          win.style.left =
            result[
              STORAGE_KEY_POSITION
            ].left;

          win.style.top =
            result[
              STORAGE_KEY_POSITION
            ].top;

          win.style.right = "auto";
        }

        const shouldStartHidden =
          !!result[
            STORAGE_KEY_HIDDEN
          ];

        setHidden(
          shouldStartHidden,
          false
        );

        renderDraftStateViews();

        if (!shouldStartHidden) {
          openDraftIQ();
        }
      }
    );
  }

  shadow
    .getElementById("dc-search")
    .addEventListener(
      "input",
      (event) => {
        searchTerm =
          event.target.value;

        renderList();
      }
    );

  shadow
    .getElementById("dc-sort")
    .addEventListener(
      "change",
      (event) => {
        sortMode =
          event.target.value;

        chrome.storage.local.set({
          [STORAGE_KEY_SORT]:
            sortMode,
        });

        renderList();
      }
    );

  shadow
    .getElementById("dc-chips")
    .addEventListener(
      "click",
      (event) => {
        const chip =
          event.target.closest(
            ".dc-chip"
          );

        if (!chip) return;

        const position =
          chip.getAttribute(
            "data-pos"
          );

        if (position === "ALL") {
          activeFilters.clear();
        } else if (
          activeFilters.has(position)
        ) {
          activeFilters.delete(
            position
          );
        } else {
          activeFilters.add(position);
        }

        shadow
          .querySelectorAll(".dc-chip")
          .forEach(
            (currentChip) => {
              const chipPosition =
                currentChip.getAttribute(
                  "data-pos"
                );

              const isActive =
                chipPosition === "ALL"
                  ? activeFilters.size === 0
                  : activeFilters.has(
                      chipPosition
                    );

              currentChip.classList.toggle(
                "dc-chip-active",
                isActive
              );

              currentChip.setAttribute(
                "aria-pressed",
                String(isActive)
              );
            }
          );

        renderList();
      }
    );

  refreshButton.addEventListener(
    "click",
    requestRemoteRefresh
  );

  statusButton.addEventListener(
    "click",
    () =>
      openDrawer(
        diagnosticsDrawer
      )
  );

  reportButton.addEventListener(
    "click",
    () =>
      openDrawer(reportDrawer)
  );

  shadow
    .querySelectorAll(
      "[data-close-drawer]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        closeDrawers
      );
    });

  shadow.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        closeDrawers();
      }
    }
  );

  shadow
    .getElementById("dc-hide")
    .addEventListener(
      "click",
      () => setHidden(true)
    );

  tab.addEventListener(
    "click",
    openDraftIQ
  );

  let draggingMain = false;
  let mainOffsetX = 0;
  let mainOffsetY = 0;

  dragHandle.addEventListener(
    "mousedown",
    (event) => {
      if (
        event.target.closest(
          "button"
        )
      ) {
        return;
      }

      draggingMain = true;

      const rect =
        win.getBoundingClientRect();

      mainOffsetX =
        event.clientX - rect.left;

      mainOffsetY =
        event.clientY - rect.top;

      event.preventDefault();
    }
  );

  window.addEventListener(
    "mousemove",
    (event) => {
      if (draggingMain) {
        const left = Math.max(
          0,
          Math.min(
            window.innerWidth -
              win.offsetWidth,
            event.clientX -
              mainOffsetX
          )
        );

        const top = Math.max(
          0,
          Math.min(
            window.innerHeight -
              win.offsetHeight,
            event.clientY -
              mainOffsetY
          )
        );

        win.style.left = `${left}px`;
        win.style.top = `${top}px`;
        win.style.right = "auto";
      }

    }
  );

  window.addEventListener(
    "mouseup",
    () => {
      if (draggingMain) {
        draggingMain = false;

        chrome.storage.local.set({
          [STORAGE_KEY_POSITION]: {
            left: win.style.left,
            top: win.style.top,
          },
        });
      }

    }
  );

  chrome.storage.onChanged.addListener(
    (changes, area) => {
      if (area !== "local") return;

      if (
        changes[
          STORAGE_KEY_HIDDEN
        ]
      ) {
        setHidden(
          !!changes[
            STORAGE_KEY_HIDDEN
          ].newValue,
          false
        );
      }

      if (
        changes[
          STORAGE_KEY_DRAFTED
        ]
      ) {
        draftedIds = new Set(
          changes[
            STORAGE_KEY_DRAFTED
          ].newValue || []
        );

        removeDraftedFavorites();
        renderList();
        renderProfile();
        renderDraftReport();
      }

      if (
        changes[
          STORAGE_KEY_MY_TEAM
        ]
      ) {
        myTeamIds = new Set(
          changes[
            STORAGE_KEY_MY_TEAM
          ].newValue || []
        );

        renderList();
        renderProfile();
        renderDraftReport();
      }

      if (
        changes[
          STORAGE_KEY_FAVORITES
        ]
      ) {
        favoriteIds = new Set(
          changes[
            STORAGE_KEY_FAVORITES
          ].newValue || []
        );

        renderList();
      }

      if (
        changes[
          STORAGE_KEY_SORT
        ]
      ) {
        const nextSort =
          changes[
            STORAGE_KEY_SORT
          ].newValue;

        sortMode = [
          "favorites",
          "rank",
          "adp",
          "projection",
        ].includes(nextSort)
          ? nextSort
          : "favorites";

        shadow.getElementById(
          "dc-sort"
        ).value = sortMode;

        renderList();
      }

      if (
        changes[
          STORAGE_KEY_LEAGUE_SETTINGS
        ]
      ) {
        leagueSettings =
          Core.normalizeLeagueSettings(
            changes[
              STORAGE_KEY_LEAGUE_SETTINGS
            ].newValue
          );

        draftPlayers = Core.applyFantasyPointTiers(
          draftPlayers,
          "ppr",
          historicalFantasyPoints
        );

        if (selectedPlayer) {
          selectedPlayer =
            getPlayerById(playerId(selectedPlayer)) || selectedPlayer;
        }

        renderList();
        renderProfile();
        renderRecommendation();
        renderCurrentPick();
        renderDraftReport();
      }

      if (
        changes[
          STORAGE_KEY_DIAGNOSTICS
        ]
      ) {
        diagnostics =
          changes[
            STORAGE_KEY_DIAGNOSTICS
          ].newValue || null;

        renderSyncStatus();
        renderCurrentPick();
        renderRecommendation();
      }

      if (changes[STORAGE_KEY_CURRENT_DRAFT_ID]) {
        currentDraftId = String(
          changes[STORAGE_KEY_CURRENT_DRAFT_ID].newValue || ""
        );
        lastRecommendationSnapshotSignature = "";

        renderRecommendation();
      }

      if (changes[STORAGE_KEY_DRAFTS_IN_PROGRESS]) {
        draftsInProgress =
          changes[STORAGE_KEY_DRAFTS_IN_PROGRESS].newValue || {};

        renderRecommendation();

        if (!reportDrawer.classList.contains("dc-drawer-hidden")) {
          renderDraftReport();
        }
      }

      if (changes[STORAGE_KEY_MOCK_ADP_ANALYTICS]) {
        applyMockAdpAnalytics(
          changes[STORAGE_KEY_MOCK_ADP_ANALYTICS].newValue
        );

        renderRecommendation();

        if (!reportDrawer.classList.contains("dc-drawer-hidden")) {
          renderDraftReport();
        }
      }

      if (changes[STORAGE_KEY_RECOMMENDATION_HISTORY]) {
        recommendationHistory = Array.isArray(
          changes[STORAGE_KEY_RECOMMENDATION_HISTORY].newValue
        )
          ? changes[STORAGE_KEY_RECOMMENDATION_HISTORY].newValue
          : [];
        refreshAvailabilityCalibration();

        if (!reportDrawer.classList.contains("dc-drawer-hidden")) {
          renderDraftReport();
        }
      }

      if (
        changes[
          STORAGE_KEY_REMOTE_DATA
        ]
      ) {
        const remoteData =
          changes[
            STORAGE_KEY_REMOTE_DATA
          ].newValue;

        if (
          applyRemoteData(
            remoteData,
            "remote"
          )
        ) {
          renderList();
          renderProfile();
        }
      }
    }
  );

  window.setInterval(
    renderSyncStatus,
    5000
  );

  loadState();
})();
