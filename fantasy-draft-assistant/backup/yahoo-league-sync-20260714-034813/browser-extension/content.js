(function () {
  if (document.getElementById("draft-copilot-host")) return;

  const STORAGE_KEY_DRAFTED = "draftCopilotDrafted";
  const STORAGE_KEY_MY_TEAM = "draftCopilotMyTeam";
  const STORAGE_KEY_POSITION = "draftCopilotPosition";
  const STORAGE_KEY_PROFILE_POSITION = "draftCopilotProfilePosition";
  const STORAGE_KEY_HIDDEN = "draftCopilotHidden";
  const STORAGE_KEY_REMOTE_DATA = "draftCopilotRemoteData";
  const STORAGE_KEY_REMOTE_DATA_VERSION = "draftCopilotRemoteDataVersion";
  const STORAGE_KEY_LEAGUE_SETTINGS = "draftCopilotLeagueSettings";
  const STORAGE_KEY_DIAGNOSTICS = "draftCopilotDiagnostics";
  const STORAGE_KEY_FAVORITES = "draftCopilotFavorites";
  const STORAGE_KEY_SORT = "draftCopilotSort";

  const Core = window.DraftIQCore;

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
            class="dc-icon-btn"
            id="dc-settings-button"
            type="button"
            title="League settings"
            aria-label="League settings"
          >
            &#9881;
          </button>

          <button
            class="dc-reset-btn"
            id="dc-reset"
            type="button"
            title="Reset current draft"
            aria-label="Reset current draft"
          >
            Reset
          </button>

          <button
            class="dc-refresh-btn"
            id="dc-refresh"
            type="button"
            title="Refresh DraftIQ data"
            aria-label="Refresh DraftIQ data"
          >
            <span class="dc-refresh-icon" aria-hidden="true">↻</span>
          </button>

          <button class="dc-collapse-btn" id="dc-hide" type="button" title="Hide">×</button>
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

        <div class="dc-recommendation" id="dc-recommendation"></div>

        <div class="dc-roster-dock" aria-label="Pinned draft lists">
          <section class="dc-compact-row" aria-label="Favorite queue">
            <div class="dc-compact-label">
              <span><span class="dc-compact-label-icon" aria-hidden="true">&#9733;</span> Favorites</span>
              <strong id="dc-favorite-count">0</strong>
            </div>
            <div class="dc-compact-items" id="dc-favorite-queue"></div>
          </section>
          <section class="dc-compact-row" aria-label="Current team">
            <div class="dc-compact-label">
              <span>Current team</span>
              <strong id="dc-team-count">0</strong>
            </div>
            <div class="dc-compact-items" id="dc-current-team"></div>
          </section>
        </div>

        <div class="dc-table-header">
          <div>Players</div>
          <div>ADP</div>
          <div>Proj</div>
        </div>

        <div class="dc-list" id="dc-list"></div>

        <div class="dc-footer" id="dc-footer">Click player to open profile <span>→</span></div>
      </div>

      <section class="dc-drawer dc-drawer-hidden" id="dc-settings-drawer" aria-label="League settings">
        <div class="dc-drawer-header">
          <div>
            <div class="dc-drawer-eyebrow">Draft configuration</div>
            <div class="dc-drawer-title">League settings</div>
          </div>
          <button class="dc-drawer-close" data-close-drawer type="button" aria-label="Close settings">&times;</button>
        </div>

        <form class="dc-settings-form" id="dc-settings-form">
          <div class="dc-settings-grid">
            <label><span>Teams</span><input type="number" name="teamCount" min="2" max="20" required /></label>
            <label><span>Your draft slot</span><input type="number" name="draftSlot" min="1" max="20" required /></label>
            <label>
              <span>Scoring</span>
              <select name="scoring">
                <option value="standard">Standard</option>
                <option value="half-ppr">Half PPR</option>
                <option value="ppr">Full PPR</option>
              </select>
            </label>
            <label><span>Bench</span><input type="number" name="bench" min="0" max="16" required /></label>
          </div>

          <div class="dc-settings-subtitle">Starting roster</div>
          <div class="dc-settings-grid dc-settings-roster-grid">
            ${["qb", "rb", "wr", "te", "flex"]
              .map(
                (position) => `
                  <label>
                    <span>${position.toUpperCase()}</span>
                    <input type="number" name="${position}" min="0" max="8" required />
                  </label>
                `
              )
              .join("")}
          </div>

          <div class="dc-settings-note">
            DraftIQ auto-detects Yahoo settings when they are exposed in the draft room. Values you save here take priority.
          </div>

          <button class="dc-primary-button" type="submit">Save league settings</button>
        </form>
      </section>

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

    <div class="dc-profile-window dc-profile-hidden" id="dc-profile-window">
      <div class="dc-profile" id="dc-profile"></div>
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
  let diagnostics = null;

  const win = shadow.getElementById("dc-window");
  const profileWin = shadow.getElementById("dc-profile-window");
  const tab = shadow.getElementById("dc-float-tab");
  const dragHandle = shadow.getElementById("dc-drag-handle");
  const refreshButton = shadow.getElementById("dc-refresh");
  const resetButton = shadow.getElementById("dc-reset");
  const statusButton = shadow.getElementById("dc-status");
  const settingsButton = shadow.getElementById("dc-settings-button");
  const reportButton = shadow.getElementById("dc-report-button");
  const settingsDrawer = shadow.getElementById("dc-settings-drawer");
  const diagnosticsDrawer = shadow.getElementById("dc-diagnostics-drawer");
  const reportDrawer = shadow.getElementById("dc-report-drawer");

  function applyRemoteData(remoteData, version = "remote") {
    if (!remoteData || !Array.isArray(remoteData.players)) return false;

    draftPlayers = remoteData.players;
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
    [settingsDrawer, diagnosticsDrawer, reportDrawer].forEach((drawer) => {
      drawer?.classList.add("dc-drawer-hidden");
    });
  }

  function openDrawer(drawer) {
    const shouldOpen = drawer?.classList.contains("dc-drawer-hidden");

    closeDrawers();

    if (!drawer || !shouldOpen) return;

    drawer.classList.remove("dc-drawer-hidden");

    if (drawer === settingsDrawer) populateSettingsForm();
    if (drawer === diagnosticsDrawer) renderDiagnostics();
    if (drawer === reportDrawer) renderDraftReport();
  }

  function populateSettingsForm() {
    const form = shadow.getElementById("dc-settings-form");

    if (!form) return;

    Object.entries(leagueSettings).forEach(([key, value]) => {
      const field = form.elements.namedItem(key);

      if (field) field.value = value;
    });

    const slotField = form.elements.namedItem("draftSlot");

    if (slotField) slotField.max = String(leagueSettings.teamCount);
  }

  function saveLeagueSettings(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());

    leagueSettings = Core.normalizeLeagueSettings(values);
    const savedSettings = {
      ...leagueSettings,
      manualOverrides: [
        "teamCount",
        "draftSlot",
        "scoring",
        "bench",
        "qb",
        "rb",
        "wr",
        "te",
        "flex",
      ],
    };

    chrome.storage.local.set(
      { [STORAGE_KEY_LEAGUE_SETTINGS]: savedSettings },
      () => {
        populateSettingsForm();
        renderRecommendation();
        renderDraftReport();
        closeDrawers();
        showFooterStatus("League settings saved.", "success", 3500);
      }
    );
  }

  function formatDiagnosticTime(value) {
    if (!value) return "Not yet";

    const timestamp = new Date(value).getTime();

    if (!Number.isFinite(timestamp)) return "Unknown";

    const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));

    if (seconds < 5) return "Just now";
    if (seconds < 60) return `${seconds}s ago`;

    return `${Math.floor(seconds / 60)}m ago`;
  }

  function diagnosticsAreHealthy() {
    const lastScan = diagnostics?.lastScanAt
      ? new Date(diagnostics.lastScanAt).getTime()
      : 0;

    return Boolean(
      diagnostics?.connected &&
        diagnostics?.supported &&
        !diagnostics?.syncError &&
        lastScan &&
        Date.now() - lastScan < 15000
    );
  }

  function renderSyncStatus() {
    const dot = shadow.getElementById("dc-status-dot");
    const label = shadow.getElementById("dc-status-label");
    const healthy = diagnosticsAreHealthy();

    if (dot) {
      dot.classList.toggle("dc-status-dot-live", healthy);
      dot.classList.toggle("dc-status-dot-warning", !healthy);
    }

    if (label) label.textContent = healthy ? "Live" : "Check";

    if (statusButton) {
      statusButton.title = healthy
        ? `Sync healthy · scanned ${formatDiagnosticTime(diagnostics?.lastScanAt)}`
        : "Open sync diagnostics";
    }

    renderDiagnostics();
  }

  function renderDiagnostics() {
    const body = shadow.getElementById("dc-diagnostics-body");

    if (!body) return;

    const healthy = diagnosticsAreHealthy();
    const platform = diagnostics?.platform || "Waiting for draft room";
    const activeView = diagnostics?.activeView || "Unknown";
    const lastScan = formatDiagnosticTime(diagnostics?.lastScanAt);
    const lastPick = formatDiagnosticTime(diagnostics?.lastPickAt);
    const draftedCount = diagnostics?.draftedCount ?? draftedIds.size;
    const rosterCount = diagnostics?.myTeamCount ?? getMyTeamPlayers().length;
    const playerCount = diagnostics?.playerDataCount ?? draftPlayers.length;
    const adapter = diagnostics?.adapter || "page";
    const syncError = diagnostics?.syncError;

    const platformTip =
      diagnostics?.platformKey === "sleeper"
        ? "Sleeper picks sync from its read-only draft feed. Set your correct draft slot in League settings so DraftIQ can identify your roster."
        : diagnostics?.platformKey === "espn"
          ? "Keep the ESPN draft board or pick-history panel loaded so DraftIQ can see completed picks and your roster."
          : "Keep the Yahoo draft tab open. DraftIQ can scan while you view other tabs, but Yahoo must remain loaded.";

    const warning = !diagnostics
      ? "DraftIQ has not received a sync heartbeat yet. Refresh the draft page if this persists."
      : !diagnostics.supported
        ? `${platform} is visible, but automatic pick detection is not available on this platform.`
        : syncError
          ? `${platform} live sync fell back to page scanning: ${syncError}`
        : !healthy
          ? "The last scan is stale. Refresh the draft page and check that the draft room is open."
          : "Live scanning is healthy and DraftIQ is monitoring the board.";

    body.innerHTML = `
      <div class="dc-health-card ${healthy ? "dc-health-card-live" : "dc-health-card-warning"}">
        <span class="dc-health-dot"></span>
        <div>
          <strong>${healthy ? "Sync healthy" : "Sync needs attention"}</strong>
          <span>${warning}</span>
        </div>
      </div>

      <div class="dc-diagnostic-grid">
        <div><span>Platform</span><strong>${platform}</strong></div>
        <div><span>Sync method</span><strong>${adapter}</strong></div>
        <div><span>Active view</span><strong>${activeView}</strong></div>
        <div><span>Last scan</span><strong>${lastScan}</strong></div>
        <div><span>Last pick</span><strong>${lastPick}</strong></div>
        <div><span>Players loaded</span><strong>${playerCount}</strong></div>
        <div><span>Drafted detected</span><strong>${draftedCount}</strong></div>
        <div><span>Your roster</span><strong>${rosterCount}</strong></div>
        <div><span>Draft ID</span><strong>${diagnostics?.draftId || "Waiting"}</strong></div>
      </div>

      <div class="dc-diagnostics-tip">
        Tip: ${platformTip}
      </div>
    `;
  }

  function requestRemoteRefresh() {
    if (refreshInProgress) return;

    setRefreshButtonState(true);
    showFooterStatus("Refreshing latest DraftIQ data...", "loading", 0);

    chrome.runtime.sendMessage(
      { type: "DRAFTIQ_FORCE_UPDATE" },
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
          [STORAGE_KEY_REMOTE_DATA, STORAGE_KEY_REMOTE_DATA_VERSION],
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

  function playerId(p) {
    return p.id || p.name;
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

  function playerDraftKeys(p) {
    const keys = new Set();

    if (p.id) keys.add(String(p.id));
    if (p.name) keys.add(String(p.name));
    if (p.name) keys.add(normalizeDraftKey(p.name));

    return Array.from(keys).filter(Boolean);
  }

  function isPlayerDrafted(p) {
    return playerDraftKeys(p).some((key) => draftedIds.has(key));
  }

  function isPlayerOnMyTeam(p) {
    return playerDraftKeys(p).some((key) => myTeamIds.has(key));
  }

  function favoriteKey(p) {
    return normalizeDraftKey(p?.name) || String(playerId(p));
  }

  function isPlayerFavorite(p) {
    return favoriteIds.has(favoriteKey(p));
  }

  function saveFavorites() {
    chrome.storage.local.set({
      [STORAGE_KEY_FAVORITES]: Array.from(favoriteIds),
    });
  }

  function toggleFavorite(p) {
    const key = favoriteKey(p);

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
      if (isPlayerDrafted(player) && favoriteIds.delete(favoriteKey(player))) {
        changed = true;
      }
    });

    if (changed) saveFavorites();
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
    if (value === null || value === undefined || value === "") return "-";
    return value;
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

    if (Number.isNaN(number)) return "-";

    return number.toFixed(digits).replace(/\.0$/, "");
  }

  function getPlayerProjection(p) {
    if (p.proj !== null && p.proj !== undefined && p.proj !== "-") {
      return p.proj;
    }

    if (
      p.stats &&
      p.stats.projection !== null &&
      p.stats.projection !== undefined
    ) {
      return p.stats.projection;
    }

    return "-";
  }

  function getPlayerProjectedPpg(p) {
    if (
      p.projectedPpg !== null &&
      p.projectedPpg !== undefined &&
      p.projectedPpg !== "-"
    ) {
      return p.projectedPpg;
    }

    if (
      p.stats &&
      p.stats.projectedPpg !== null &&
      p.stats.projectedPpg !== undefined &&
      p.stats.projectedPpg !== "-"
    ) {
      return p.stats.projectedPpg;
    }

    const projection = Number(getPlayerProjection(p));

    if (!Number.isNaN(projection)) {
      return projection / 17;
    }

    return "-";
  }

  function normalizeSourceBreakdown(p) {
    const breakdown = p.sourceBreakdown || {};

    return {
      yahoo: {
        projection:
          p.yahooProjection ??
          p.sourceProjections?.yahoo ??
          breakdown.yahoo?.projection ??
          null,
        projectedPpg:
          p.yahooProjectedPpg ??
          p.sourceProjectedPpg?.yahoo ??
          breakdown.yahoo?.projectedPpg ??
          null,
        adp:
          p.yahooAdp ??
          p.sourceAdp?.yahoo ??
          breakdown.yahoo?.adp ??
          null,
      },
      espn: {
        projection:
          p.espnProjection ??
          p.sourceProjections?.espn ??
          breakdown.espn?.projection ??
          null,
        projectedPpg:
          p.espnProjectedPpg ??
          p.sourceProjectedPpg?.espn ??
          breakdown.espn?.projectedPpg ??
          null,
        adp:
          p.espnAdp ??
          p.sourceAdp?.espn ??
          breakdown.espn?.adp ??
          null,
      },
      sleeper: {
        projection:
          p.sleeperProjection ??
          p.sourceProjections?.sleeper ??
          breakdown.sleeper?.projection ??
          null,
        projectedPpg:
          p.sleeperProjectedPpg ??
          p.sourceProjectedPpg?.sleeper ??
          breakdown.sleeper?.projectedPpg ??
          null,
        adp:
          p.sleeperAdp ??
          p.sourceAdp?.sleeper ??
          breakdown.sleeper?.adp ??
          null,
      },
      master: {
        projection: p.proj ?? breakdown.master?.projection ?? null,
        projectedPpg:
          p.projectedPpg ?? breakdown.master?.projectedPpg ?? null,
        adp: p.adp ?? breakdown.master?.adp ?? null,
      },
    };
  }

  function renderSourceBreakdown(p) {
    const breakdown = normalizeSourceBreakdown(p);

    const rows = [
      { key: "yahoo", label: "Yahoo" },
      { key: "espn", label: "ESPN" },
      { key: "sleeper", label: "Sleeper" },
      { key: "master", label: "Combined Avg", master: true },
    ];

    return `
      <div class="dc-source-breakdown">
        <div class="dc-profile-section-title">Source Breakdown</div>

        <div class="dc-source-grid">
          ${rows
            .map((row) => {
              const source = breakdown[row.key] || {};

              return `
              <div class="dc-source-card${
                row.master ? " dc-source-card-master" : ""
              }">
                <div class="dc-source-name">${row.label}</div>

                <div class="dc-source-values">
                  <div>
                    <div class="dc-source-label">Proj</div>
                    <div class="dc-source-value">${formatNumber(
                      source.projection,
                      1
                    )}</div>
                  </div>

                  <div>
                    <div class="dc-source-label">PPG</div>
                    <div class="dc-source-value">${formatNumber(
                      source.projectedPpg,
                      2
                    )}</div>
                  </div>

                  <div>
                    <div class="dc-source-label">ADP</div>
                    <div class="dc-source-value">${formatNumber(
                      source.adp,
                      1
                    )}</div>
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

  function getScheduleStrength(p) {
    if (
      p &&
      p.scheduleStrength &&
      typeof p.scheduleStrength === "object"
    ) {
      return {
        rank: p.scheduleStrength.rank ?? null,
        label: p.scheduleStrength.label || "Unknown",
        score: p.scheduleStrength.score ?? null,
      };
    }

    return {
      rank: null,
      label: "Unknown",
      score: null,
    };
  }

  function getScheduleText(p) {
    const sos = getScheduleStrength(p);

    if (!sos || sos.label === "Unknown") {
      return "SOS ?";
    }

    if (sos.rank !== null && sos.rank !== undefined) {
      return `SOS #${sos.rank} ${sos.label}`;
    }

    return `SOS ${sos.label}`;
  }

  function getPlayerById(id) {
    return draftPlayers.find((p) => {
      if (String(playerId(p)) === String(id)) return true;

      return playerDraftKeys(p).some(
        (key) => String(key) === String(id)
      );
    });
  }

  function filteredPlayers() {
    return draftPlayers
      .filter((p) => {
        if (isPlayerDrafted(p)) return false;

        const matchesPos =
          activeFilters.size === 0 || activeFilters.has(p.pos);

        const matchesSearch = p.name
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

        return matchesPos && matchesSearch;
      })
      .sort((a, b) => {
        const rankDifference =
          Number(a.rank || 9999) - Number(b.rank || 9999);

        if (sortMode === "favorites") {
          const favoriteDifference =
            Number(isPlayerFavorite(b)) - Number(isPlayerFavorite(a));

          return favoriteDifference || rankDifference;
        }

        if (sortMode === "adp") {
          return (
            Number(a.adp || 9999) - Number(b.adp || 9999) ||
            rankDifference
          );
        }

        if (sortMode === "projection") {
          return (
            Number(getPlayerProjection(b) || -1) -
              Number(getPlayerProjection(a) || -1) ||
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
    return Math.min(max, Math.max(min, value));
  }

  function numberOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function getRosterCounts(players = getMyTeamPlayers()) {
    return players.reduce(
      (counts, player) => {
        const pos = String(player.pos || "").toUpperCase();

        if (Object.prototype.hasOwnProperty.call(counts, pos)) {
          counts[pos] += 1;
        }

        return counts;
      },
      { QB: 0, RB: 0, WR: 0, TE: 0 }
    );
  }

  function getRosterNeeds(counts) {
    return Core.getRosterNeeds(counts, leagueSettings);
  }

  function getAvailableSkillPlayers() {
    return draftPlayers.filter((player) => {
      const pos = String(player.pos || "").toUpperCase();

      return (
        ["QB", "RB", "WR", "TE"].includes(pos) &&
        !isPlayerDrafted(player)
      );
    });
  }

  function getPositionScarcity(player, availablePlayers) {
    const pos = String(player.pos || "").toUpperCase();

    const samePosition = availablePlayers
      .filter(
        (candidate) =>
          String(candidate.pos || "").toUpperCase() === pos
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
        String(playerId(candidate)) === String(playerId(player))
    );

    if (index < 0) return 0;

    const comparisonIndex = Math.min(
      index + 4,
      samePosition.length - 1
    );

    const currentRank =
      numberOrNull(player.rank) ??
      numberOrNull(player.adp) ??
      9999;

    const comparisonRank =
      numberOrNull(samePosition[comparisonIndex]?.rank) ??
      numberOrNull(samePosition[comparisonIndex]?.adp) ??
      currentRank;

    return clamp(comparisonRank - currentRank, 0, 24);
  }

  function getByeWeekPenalty(player, myTeamPlayers) {
    const bye = numberOrNull(player.bye);

    if (bye === null) return 0;

    const overlap = myTeamPlayers.filter(
      (teammate) => numberOrNull(teammate.bye) === bye
    ).length;

    return overlap * 4.5;
  }

  function getNeedScore(player, counts, needs, roundNumber) {
    const pos = String(player.pos || "").toUpperCase();
    const baseNeed = needs.baseNeeds[pos] || 0;

    if (baseNeed > 0) {
      if (pos === "QB" && roundNumber <= 2) return 22;

      return 48 + baseNeed * 5;
    }

    if (
      ["RB", "WR", "TE"].includes(pos) &&
      needs.flexNeed > 0
    ) {
      return pos === "TE" ? 18 : 28;
    }

    if (pos === "QB") {
      if (counts.QB >= 2) return -42;

      return roundNumber < 8 ? -24 : 5;
    }

    if (pos === "TE") {
      if (counts.TE >= 2) return -26;

      return roundNumber < 7 ? -12 : 4;
    }

    if (pos === "RB" || pos === "WR") {
      return needs.startersFilled ? 12 : 4;
    }

    return 0;
  }

  function getScoringAdjustment(player) {
    const pos = String(player.pos || "").toUpperCase();

    if (leagueSettings.scoring === "ppr") {
      if (pos === "WR") return 6;
      if (pos === "TE") return 4;
      if (pos === "RB") return 3;
    }

    if (leagueSettings.scoring === "standard") {
      if (pos === "RB") return 3;
      if (pos === "WR") return -2;
    }

    return 0;
  }

  function scoreRecommendation(player, context) {
    const rank =
      numberOrNull(player.rank) ??
      numberOrNull(player.adp) ??
      999;

    const adp = numberOrNull(player.adp);
    const projectedPpg = numberOrNull(
      getPlayerProjectedPpg(player)
    );

    const scarcity = getPositionScarcity(
      player,
      context.availablePlayers
    );

    const needScore = getNeedScore(
      player,
      context.counts,
      context.needs,
      context.roundNumber
    );

    const adpUrgency =
      adp === null
        ? 0
        : clamp(
            (context.currentPick + 4 - adp) * 1.6,
            -12,
            24
          );

    const availability = Core.getAvailabilityUrgency(
      player,
      context.draftTiming.lookaheadPick
    );

    const tierWarning = Core.getTierDropWarning(
      player,
      context.availablePlayers
    );

    const tierScore = tierWarning
      ? tierWarning.severity === "high"
        ? 15
        : 7
      : 0;

    const projectionScore =
      projectedPpg === null
        ? 0
        : clamp((projectedPpg - 8) * 1.2, -5, 20);

    const byePenalty = getByeWeekPenalty(
      player,
      context.myTeamPlayers
    );

    const rankScore = 360 - rank * 2.6;
    const scoringAdjustment = getScoringAdjustment(player);

    return {
      player,
      score:
        rankScore +
        needScore +
        scarcity * 1.25 +
        adpUrgency +
        availability.score +
        tierScore +
        scoringAdjustment +
        projectionScore -
        byePenalty,
      needScore,
      scarcity,
      adpUrgency,
      availability,
      tierWarning,
      tierScore,
      scoringAdjustment,
      byePenalty,
    };
  }

  function getRecommendationReason(scored, context) {
    const player = scored.player;
    const pos = String(player.pos || "").toUpperCase();
    const reasons = [];

    if ((context.needs.baseNeeds[pos] || 0) > 0) {
      reasons.push(`fills an open ${pos} starter`);
    } else if (
      ["RB", "WR", "TE"].includes(pos) &&
      context.needs.flexNeed > 0
    ) {
      reasons.push("helps fill a flex spot");
    } else if (pos === "RB" || pos === "WR") {
      reasons.push("adds high-value depth");
    }

    if (scored.tierWarning) {
      reasons.push(scored.tierWarning.message.toLowerCase());
    } else if (scored.scarcity >= 10) {
      reasons.push(`${pos} drops off soon`);
    }

    if (scored.availability?.likelyGone) {
      reasons.push("is unlikely to reach your next pick");
    } else if (scored.adpUrgency >= 10) {
      reasons.push("is slipping past ADP");
    }

    if (scored.byePenalty >= 9) {
      reasons.push("despite a bye-week overlap");
    }

    if (!reasons.length) {
      reasons.push("is the strongest overall value available");
    }

    const reasonText = reasons.slice(0, 2).join(" and ");

    return reasonText.charAt(0).toUpperCase() + reasonText.slice(1);
  }

  function buildRecommendation() {
    const availablePlayers = getAvailableSkillPlayers();

    if (!availablePlayers.length) return null;

    const myTeamPlayers = getMyTeamPlayers();
    const counts = getRosterCounts(myTeamPlayers);
    const needs = getRosterNeeds(counts);
    const draftedCount = getDraftedPlayers().length;
    const currentPick = draftedCount + 1;
    const draftTiming = Core.getUserPickContext(
      currentPick,
      leagueSettings
    );
    const roundNumber = draftTiming.currentRound;

    const context = {
      availablePlayers,
      myTeamPlayers,
      counts,
      needs,
      draftedCount,
      currentPick,
      roundNumber,
      draftTiming,
    };

    const scored = availablePlayers
      .map((player) => scoreRecommendation(player, context))
      .sort((a, b) => b.score - a.score);

    return {
      context,
      primary: scored[0],
      alternatives: scored.slice(1, 3),
    };
  }

  function renderRecommendation() {
    const recommendationEl =
      shadow.getElementById("dc-recommendation");

    if (!recommendationEl) return;

    const recommendation = buildRecommendation();

    if (!recommendation) {
      recommendationEl.innerHTML = `
        <div class="dc-rec-empty">No recommendation available.</div>
      `;

      return;
    }

    const { context, primary, alternatives } = recommendation;
    const player = primary.player;
    const requirements = getStarterRequirements();

    const rosterSummary = ["QB", "RB", "WR", "TE"]
      .map((pos) => {
        const required = requirements[pos];

        return `${pos} ${context.counts[pos]}/${required}`;
      })
      .join(" · ");

    const flexBaseFilled =
      Math.max(
        0,
        context.counts.RB - requirements.RB
      ) +
      Math.max(
        0,
        context.counts.WR - requirements.WR
      ) +
      Math.max(
        0,
        context.counts.TE - requirements.TE
      );

    const flexFilled = Math.min(
      requirements.FLEX,
      flexBaseFilled
    );

    recommendationEl.innerHTML = `
      <div class="dc-rec-topline">
        <div>
          <div class="dc-rec-eyebrow">
            Round ${context.roundNumber} · Pick ${context.currentPick}
          </div>

          <div class="dc-rec-title">
            Best pick: ${player.name}
          </div>
        </div>

        <button
          class="dc-rec-view"
          id="dc-rec-view"
          type="button"
        >
          View
        </button>
      </div>

      <div class="dc-rec-player-line">
        <span class="dc-pos dc-pos-${player.pos}">
          ${player.pos}
        </span>

        <span>
          ${player.team} · Rank ${formatValue(
            player.rank
          )} · ADP ${formatNumber(player.adp, 1)}
        </span>
      </div>

      <div class="dc-rec-turn">
        ${
          context.draftTiming.isUserTurn
            ? `You are on the clock · next turn at pick ${context.draftTiming.followingUserPick}`
            : `Your next pick: ${context.draftTiming.nextUserPick} · ${context.draftTiming.picksUntilNext} picks away`
        }
      </div>

      <div class="dc-rec-reason">
        ${getRecommendationReason(primary, context)}.
      </div>

      ${
        primary.tierWarning
          ? `<div class="dc-rec-alert">${primary.tierWarning.message}</div>`
          : ""
      }

      <div class="dc-rec-roster">
        ${rosterSummary} · FLEX ${flexFilled}/${requirements.FLEX}
      </div>

      ${
        alternatives.length
          ? `
            <div class="dc-rec-alternatives">
              Also consider:

              ${alternatives
                .map(
                  (item) => `
                    <button
                      class="dc-rec-alt"
                      data-id="${playerId(item.player)}"
                      type="button"
                    >
                      ${item.player.name}
                    </button>
                  `
                )
                .join("")}
            </div>
          `
          : ""
      }
    `;

    const viewButton =
      shadow.getElementById("dc-rec-view");

    if (viewButton) {
      viewButton.addEventListener("click", () =>
        openProfile(player)
      );
    }

    recommendationEl
      .querySelectorAll(".dc-rec-alt")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const alternative = getPlayerById(
            button.getAttribute("data-id")
          );

          if (alternative) {
            openProfile(alternative);
          }
        });
      });
  }

  function buildDraftReport() {
    const players = getMyTeamPlayers();
    const requirements = getStarterRequirements();
    const counts = getRosterCounts(players);
    const needs = getRosterNeeds(counts);
    const requiredBase =
      requirements.QB +
      requirements.RB +
      requirements.WR +
      requirements.TE;
    const filledBase =
      Math.min(counts.QB, requirements.QB) +
      Math.min(counts.RB, requirements.RB) +
      Math.min(counts.WR, requirements.WR) +
      Math.min(counts.TE, requirements.TE);
    const starterTotal = requiredBase + requirements.FLEX;
    const startersFilled = filledBase + needs.flexFilled;
    const completion = starterTotal
      ? startersFilled / starterTotal
      : 1;
    const targetRosterSize = starterTotal + leagueSettings.bench;
    const depth = targetRosterSize
      ? Math.min(1, players.length / targetRosterSize)
      : 1;

    const valueNumbers = players
      .map((player) => {
        const explicit = numberOrNull(player.valueScore ?? player.value_score);

        if (explicit !== null) return explicit;

        const rank = numberOrNull(player.rank);
        const adp = numberOrNull(player.adp);

        return rank !== null && adp !== null ? adp - rank : null;
      })
      .filter((value) => value !== null);

    const averageValue = valueNumbers.length
      ? valueNumbers.reduce((sum, value) => sum + value, 0) /
        valueNumbers.length
      : 0;

    const byeCounts = players.reduce((map, player) => {
      const bye = numberOrNull(player.bye);

      if (bye !== null) map.set(bye, (map.get(bye) || 0) + 1);

      return map;
    }, new Map());

    const byeCollisions = Array.from(byeCounts.values()).reduce(
      (sum, count) => sum + Math.max(0, count - 2),
      0
    );

    const score = players.length
      ? Math.round(
          clamp(
            42 +
              completion * 35 +
              depth * 12 +
              clamp(averageValue, -10, 18) * 0.55 -
              byeCollisions * 2.5,
            35,
            98
          )
        )
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

    if (completion >= 1) strengths.push("All configured starting spots are covered");
    if (averageValue >= 5) strengths.push("Strong value versus market ADP");
    if (counts.RB >= requirements.RB + 2) strengths.push("Useful RB depth");
    if (counts.WR >= requirements.WR + 2) strengths.push("Useful WR depth");
    if (byeCollisions === 0 && players.length >= 6) strengths.push("Bye weeks are well distributed");

    Object.entries(needs.baseNeeds).forEach(([pos, missing]) => {
      if (missing > 0) concerns.push(`Still needs ${missing} ${pos} starter${missing > 1 ? "s" : ""}`);
    });

    if (needs.flexNeed > 0) concerns.push(`Still needs ${needs.flexNeed} FLEX player${needs.flexNeed > 1 ? "s" : ""}`);
    if (byeCollisions > 0) concerns.push(`${byeCollisions} avoidable bye-week overlap${byeCollisions > 1 ? "s" : ""}`);
    if (depth < 0.75 && players.length) concerns.push("Bench depth is still developing");

    if (!strengths.length && players.length) strengths.push("Roster foundation is in progress");
    if (!concerns.length && players.length) concerns.push("No major roster construction concerns detected");

    return {
      players,
      counts,
      needs,
      completion,
      depth,
      averageValue,
      byeCollisions,
      score,
      grade,
      strengths,
      concerns,
      targetRosterSize,
    };
  }

  function renderDraftReport() {
    const body = shadow.getElementById("dc-report-body");

    if (!body) return;

    const report = buildDraftReport();

    if (!report.players.length) {
      body.innerHTML = `
        <div class="dc-empty-state">
          <strong>No roster detected yet</strong>
          <span>DraftIQ will build this report as your draft platform identifies players on your team.</span>
        </div>
      `;
      return;
    }

    const rosterRows = [...report.players]
      .sort(
        (a, b) =>
          (numberOrNull(a.rank) ?? 9999) -
          (numberOrNull(b.rank) ?? 9999)
      )
      .map(
        (player) => `
          <div class="dc-report-player">
            <span class="dc-pos dc-pos-${player.pos}">${player.pos}</span>
            <strong>${player.name}</strong>
            <span>${player.team || "—"}</span>
            <span>Rank ${formatValue(player.rank)}</span>
          </div>
        `
      )
      .join("");

    body.innerHTML = `
      <div class="dc-report-score-card">
        <div class="dc-report-grade"><strong>${report.grade}</strong><span>${report.score}/100</span></div>
        <div>
          <div class="dc-report-score-title">DraftIQ roster score</div>
          <div class="dc-report-score-copy">
            ${report.players.length}/${report.targetRosterSize} roster spots filled · ${Math.round(report.completion * 100)}% of starters covered
          </div>
        </div>
      </div>

      <div class="dc-report-position-grid">
        ${["QB", "RB", "WR", "TE"]
          .map(
            (pos) => `<div><span>${pos}</span><strong>${report.counts[pos]}</strong></div>`
          )
          .join("")}
      </div>

      <div class="dc-report-columns">
        <section>
          <h3>Strengths</h3>
          <ul>${report.strengths.map((item) => `<li>${item}</li>`).join("")}</ul>
        </section>
        <section>
          <h3>Watch list</h3>
          <ul>${report.concerns.map((item) => `<li>${item}</li>`).join("")}</ul>
        </section>
      </div>

      <div class="dc-report-roster-title">Detected roster</div>
      <div class="dc-report-roster">${rosterRows}</div>
      <div class="dc-report-disclaimer">Score is a roster-construction estimate based on your configured league, projections, ADP value, depth, and bye-week balance.</div>
    `;
  }

  function saveDrafted() {
    chrome.storage.local.set({
      [STORAGE_KEY_DRAFTED]: Array.from(draftedIds),
    });
  }

  function toggleDrafted(p) {
    const keys = playerDraftKeys(p);
    const isDrafted = isPlayerDrafted(p);

    if (isDrafted) {
      keys.forEach((key) => draftedIds.delete(key));
    } else {
      keys.forEach((key) => draftedIds.add(key));
    }

    saveDrafted();
    renderList();
    renderProfile();
    renderRecommendation();
    renderDraftReport();
  }

  function resetCurrentDraft() {
    const confirmed = window.confirm(
      "Reset DraftIQ for this draft? This clears drafted players and your tracked roster."
    );

    if (!confirmed) return;

    draftedIds = new Set();
    myTeamIds = new Set();
    selectedPlayer = null;

    chrome.storage.local.set(
      {
        [STORAGE_KEY_DRAFTED]: [],
        [STORAGE_KEY_MY_TEAM]: [],
      },
      () => {
        renderList();
        renderProfile();
        renderRecommendation();
        renderDraftReport();

        showFooterStatus(
          "Draft reset successfully.",
          "success",
          4000
        );
      }
    );
  }

  function getGraphBarClass(points) {
    if (points < 7) return "dc-graph-bar-bad";
    if (points < 13) return "dc-graph-bar-mid";

    return "dc-graph-bar-good";
  }

  function renderMiniGraph(gameLog) {
    if (!gameLog || gameLog.length === 0) {
      return `
        <div class="dc-profile-note">
          No previous-season game log available yet.
        </div>
      `;
    }

    const sortedGames = gameLog
      .filter(
        (game) =>
          game.week !== null &&
          game.week !== undefined
      )
      .sort(
        (a, b) =>
          Number(a.week) - Number(b.week)
      );

    const recentGames = sortedGames.slice(-10);

    if (recentGames.length === 0) {
      return `
        <div class="dc-profile-note">
          No previous-season game log available yet.
        </div>
      `;
    }

    const maxPoints = Math.max(
      ...recentGames.map((game) =>
        Number(game.fantasyPoints || 0)
      ),
      1
    );

    const bars = recentGames
      .map((game) => {
        const fp = Number(game.fantasyPoints || 0);

        const height = Math.max(
          8,
          Math.round((fp / maxPoints) * 170)
        );

        const tierClass = getGraphBarClass(fp);

        return `
          <div
            class="dc-graph-item"
            title="Week ${formatValue(
              game.week
            )}: ${formatNumber(fp, 1)} pts"
          >
            <div class="dc-graph-value">
              ${formatNumber(fp, 1)}
            </div>

            <div
              class="dc-graph-bar ${tierClass}"
              style="height:${height}px"
            ></div>

            <div class="dc-graph-week">
              Wk ${formatValue(game.week)}
            </div>
          </div>
        `;
      })
      .join("");

    return `
      <div class="dc-profile-section-title">
        Last 10 Games
      </div>

      <div class="dc-profile-graph">
        ${bars}
      </div>
    `;
  }

  function closeProfile() {
    selectedPlayer = null;
    profileWin.classList.add("dc-profile-hidden");
    renderList();
  }

  function openProfile(p) {
    selectedPlayer = p;
    profileWin.classList.remove("dc-profile-hidden");
    renderProfile();
    renderList();
  }

  function renderProfile() {
    const profileEl =
      shadow.getElementById("dc-profile");

    if (!profileEl) return;

    if (!selectedPlayer) {
      profileEl.innerHTML = "";
      profileWin.classList.add("dc-profile-hidden");
      return;
    }

    const p = selectedPlayer;

    if (isPlayerDrafted(p)) {
      selectedPlayer = null;
      profileEl.innerHTML = "";
      profileWin.classList.add("dc-profile-hidden");
      renderList();
      return;
    }

    const stats = p.stats || {};
    const season = stats.season || {};
    const gameLog = stats.gameLog || [];
    const image = p.image || "";
    const projection = getPlayerProjection(p);
    const projectedPpg = getPlayerProjectedPpg(p);
    const sos = getScheduleStrength(p);

    profileEl.innerHTML = `
      <div
        class="dc-profile-header"
        id="dc-profile-drag-handle"
      >
        ${
          image
            ? `
              <img
                class="dc-profile-image"
                src="${image}"
                alt="${p.name}"
              />
            `
            : `<div class="dc-profile-image"></div>`
        }

        <div class="dc-profile-player">
          <div class="dc-profile-name">
            ${p.name}
          </div>

          <div class="dc-profile-meta">
            <span class="dc-pos dc-pos-${p.pos}">
              ${p.pos}
            </span>

            ${p.team} · Bye ${formatValue(
              p.bye
            )} · Rank ${formatValue(p.rank)}
          </div>

          <div class="dc-profile-meta">
            Proj ${formatNumber(
              projection,
              1
            )} · Proj PPG ${formatNumber(
              projectedPpg,
              2
            )} · ${getScheduleText(p)}
          </div>
        </div>

        <button
          class="dc-profile-close"
          id="dc-profile-close"
          title="Close"
        >
          ×
        </button>
      </div>

      <div class="dc-profile-section-title">
        Season Snapshot
      </div>

      <div class="dc-profile-grid">
        <div class="dc-profile-stat">
          <div class="dc-profile-stat-value">
            ${formatValue(season.ppg)}
          </div>

          <div class="dc-profile-stat-label">
            Prev PPG
          </div>
        </div>

        <div class="dc-profile-stat">
          <div class="dc-profile-stat-value">
            ${formatValue(season.games)}
          </div>

          <div class="dc-profile-stat-label">
            Games
          </div>
        </div>

        <div class="dc-profile-stat">
          <div class="dc-profile-stat-value">
            ${formatNumber(projectedPpg, 2)}
          </div>

          <div class="dc-profile-stat-label">
            Proj PPG
          </div>
        </div>

        <div class="dc-profile-stat">
          <div class="dc-profile-stat-value">
            ${formatValue(
              season.rushYardsPerGame
            )}
          </div>

          <div class="dc-profile-stat-label">
            Rush Y/G
          </div>
        </div>

        <div class="dc-profile-stat">
          <div class="dc-profile-stat-value">
            ${formatValue(
              season.receivingYardsPerGame
            )}
          </div>

          <div class="dc-profile-stat-label">
            Rec Y/G
          </div>
        </div>

        <div class="dc-profile-stat">
          <div class="dc-profile-stat-value">
            ${formatValue(
              season.touchdownsPerGame
            )}
          </div>

          <div class="dc-profile-stat-label">
            TD/G
          </div>
        </div>
      </div>

      ${renderMiniGraph(gameLog)}

      <div class="dc-outlook">
        <div class="dc-profile-section-title">
          Draft Outlook
        </div>

        <div class="dc-outlook-grid">
          <div>
            <div class="dc-outlook-label">
              Projection
            </div>

            <div class="dc-outlook-value">
              ${formatNumber(projection, 1)}
            </div>
          </div>

          <div>
            <div class="dc-outlook-label">
              Proj PPG
            </div>

            <div class="dc-outlook-value">
              ${formatNumber(projectedPpg, 2)}
            </div>
          </div>

          <div>
            <div class="dc-outlook-label">
              ADP
            </div>

            <div class="dc-outlook-value">
              ${formatNumber(p.adp, 1)}
            </div>
          </div>

          <div>
            <div class="dc-outlook-label">
              Bye Week
            </div>

            <div class="dc-outlook-value">
              Week ${formatValue(p.bye)}
            </div>
          </div>

          <div>
            <div class="dc-outlook-label">
              SOS
            </div>

            <div class="dc-outlook-value">
              ${formatValue(sos.label)}
            </div>
          </div>

          <div>
            <div class="dc-outlook-label">
              SOS Rank
            </div>

            <div class="dc-outlook-value">
              ${
                sos.rank !== null &&
                sos.rank !== undefined
                  ? `#${sos.rank}`
                  : "-"
              }
            </div>
          </div>
        </div>

        ${renderSourceBreakdown(p)}
      </div>
    `;

    shadow
      .getElementById("dc-profile-close")
      .addEventListener("click", closeProfile);

    attachProfileDrag();
  }

  function renderFooter() {
    const footerEl =
      shadow.getElementById("dc-footer");

    if (!footerEl) return;

    footerEl.classList.remove(
      "dc-footer-loading",
      "dc-footer-success",
      "dc-footer-error"
    );

    if (footerStatus) {
      footerEl.classList.add(
        `dc-footer-${footerStatusType}`
      );

      footerEl.textContent = footerStatus;
      return;
    }

    const updatedLabel =
      formatUpdatedAt(draftDataUpdatedAt);

    const sourceText =
      draftDataVersion === "bundled"
        ? "Bundled data"
        : updatedLabel
          ? `Updated ${updatedLabel}`
          : "Remote data";

    const availableCount = filteredPlayers().length;

    footerEl.innerHTML = `
      ${sourceText} · ${availableCount} available ·
      Click player to open profile <span>→</span>
    `;
  }

  function renderCompactLists() {
    const favoriteQueue = shadow.getElementById("dc-favorite-queue");
    const currentTeam = shadow.getElementById("dc-current-team");
    const favoriteCount = shadow.getElementById("dc-favorite-count");
    const teamCount = shadow.getElementById("dc-team-count");
    const positionOrder = ["QB", "RB", "WR", "TE", "FLEX", "K", "DEF"];
    const byRank = (a, b) =>
      Number(a.rank || 9999) - Number(b.rank || 9999);
    const favoritePlayers = getUniquePlayersByState(
      (player) => isPlayerFavorite(player) && !isPlayerDrafted(player)
    ).sort(byRank);
    const teamPlayers = getUniquePlayersByState(isPlayerOnMyTeam).sort(
      (a, b) => {
        const positionDifference =
          positionOrder.indexOf(a.pos) - positionOrder.indexOf(b.pos);

        return positionDifference || byRank(a, b);
      }
    );

    favoriteCount.textContent = String(favoritePlayers.length);
    teamCount.textContent = String(teamPlayers.length);

    favoriteQueue.innerHTML = favoritePlayers.length
      ? favoritePlayers
          .map(
            (player) => `
              <button class="dc-mini-player dc-mini-favorite" type="button" data-id="${playerId(
                player
              )}" title="Open ${player.name}">
                <span class="dc-mini-star" aria-hidden="true">&#9733;</span>
                <span class="dc-pos dc-pos-${player.pos}">${player.pos}</span>
                <span class="dc-mini-name">${player.name}</span>
              </button>
            `
          )
          .join("")
      : '<span class="dc-compact-empty">Star players to pin them here</span>';

    currentTeam.innerHTML = teamPlayers.length
      ? teamPlayers
          .map(
            (player) => `
              <button class="dc-mini-player" type="button" data-id="${playerId(
                player
              )}" title="Open ${player.name}">
                <span class="dc-pos dc-pos-${player.pos}">${player.pos}</span>
                <span class="dc-mini-name">${player.name}</span>
              </button>
            `
          )
          .join("")
      : '<span class="dc-compact-empty">Your picks will appear here</span>';

    shadow.querySelectorAll(".dc-mini-player").forEach((button) => {
      button.addEventListener("click", () => {
        const player = getPlayerById(button.getAttribute("data-id"));
        if (player) openProfile(player);
      });
    });
  }

  function renderList() {
    const listEl =
      shadow.getElementById("dc-list");

    const players = filteredPlayers();
    let html = "";

    players.forEach((p) => {
      const isSelected =
        selectedPlayer &&
        String(playerId(selectedPlayer)) ===
          String(playerId(p));
      const isFavorite = isPlayerFavorite(p);

      const projection =
        getPlayerProjection(p);

      const projectedPpg =
        getPlayerProjectedPpg(p);

      html += `
        <div
          class="dc-card${
            isSelected ? " dc-selected" : ""
          }"
          data-id="${playerId(p)}"
        >
          <div class="dc-card-rank">
            <button
              class="dc-star${isFavorite ? " dc-star-active" : ""}"
              type="button"
              aria-label="${isFavorite ? "Remove" : "Add"} ${p.name} ${
                isFavorite ? "from" : "to"
              } favorites"
              aria-pressed="${isFavorite}"
              title="${isFavorite ? "Remove favorite" : "Favorite player"}"
            >
              ${isFavorite ? "&#9733;" : "&#9734;"}
            </button>
            <span>${p.rank}</span>
          </div>

          <div class="dc-card-main">
            <div class="dc-card-name">
              ${p.name}
            </div>

            <div class="dc-card-meta">
              <span class="dc-pos dc-pos-${p.pos}">
                ${p.pos}
              </span>

              ${p.team} · Bye ${formatValue(
                p.bye
              )} · ${getScheduleText(p)}
            </div>

            <div class="dc-card-meta">
              Proj PPG ${formatNumber(
                projectedPpg,
                2
              )}
            </div>
          </div>

          <div class="dc-card-adp">
            ${formatNumber(p.adp, 1)}
          </div>

          <div class="dc-card-proj">
            ${formatNumber(projection, 1)}
          </div>

          <div class="dc-card-arrow">
            ↗
          </div>
        </div>
      `;
    });

    listEl.innerHTML =
      html ||
      `
        <div class="dc-no-results">
          No available matching players
        </div>
      `;

    listEl
      .querySelectorAll(".dc-star")
      .forEach((star) => {
        star.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();

          const card = star.closest(".dc-card");
          const player = card
            ? getPlayerById(card.getAttribute("data-id"))
            : null;

          if (player) toggleFavorite(player);
        });
      });

    listEl
      .querySelectorAll(".dc-card")
      .forEach((card) => {
        card.addEventListener("click", () => {
          const id = card.getAttribute("data-id");
          const p = getPlayerById(id);

          if (!p) return;

          openProfile(p);
        });
      });

    renderCompactLists();
    renderRecommendation();
    renderFooter();
  }

  function setHidden(hidden, save = true) {
    root.classList.toggle(
      "dc-hidden",
      hidden
    );

    if (hidden) {
      closeDrawers();
      profileWin.classList.add(
        "dc-profile-hidden"
      );
    } else if (selectedPlayer) {
      profileWin.classList.remove(
        "dc-profile-hidden"
      );
    }

    if (save) {
      chrome.storage.local.set({
        [STORAGE_KEY_HIDDEN]: hidden,
      });
    }
  }

  function loadState() {
    chrome.storage.local.get(
      [
        STORAGE_KEY_DRAFTED,
        STORAGE_KEY_MY_TEAM,
        STORAGE_KEY_POSITION,
        STORAGE_KEY_PROFILE_POSITION,
        STORAGE_KEY_HIDDEN,
        STORAGE_KEY_REMOTE_DATA,
        STORAGE_KEY_REMOTE_DATA_VERSION,
        STORAGE_KEY_LEAGUE_SETTINGS,
        STORAGE_KEY_DIAGNOSTICS,
        STORAGE_KEY_FAVORITES,
        STORAGE_KEY_SORT,
      ],
      (res) => {
        leagueSettings = Core.normalizeLeagueSettings(
          res[STORAGE_KEY_LEAGUE_SETTINGS]
        );
        diagnostics = res[STORAGE_KEY_DIAGNOSTICS] || null;

        if (res[STORAGE_KEY_REMOTE_DATA]) {
          applyRemoteData(
            res[STORAGE_KEY_REMOTE_DATA],
            res[
              STORAGE_KEY_REMOTE_DATA_VERSION
            ] || "remote"
          );
        }

        if (res[STORAGE_KEY_DRAFTED]) {
          draftedIds = new Set(
            res[STORAGE_KEY_DRAFTED]
          );
        }

        if (res[STORAGE_KEY_MY_TEAM]) {
          myTeamIds = new Set(
            res[STORAGE_KEY_MY_TEAM]
          );
        }

        favoriteIds = new Set(
          res[STORAGE_KEY_FAVORITES] || []
        );
        sortMode = ["favorites", "rank", "adp", "projection"].includes(
          res[STORAGE_KEY_SORT]
        )
          ? res[STORAGE_KEY_SORT]
          : "favorites";
        shadow.getElementById("dc-sort").value = sortMode;
        removeDraftedFavorites();

        if (res[STORAGE_KEY_POSITION]) {
          win.style.left =
            res[STORAGE_KEY_POSITION].left;

          win.style.top =
            res[STORAGE_KEY_POSITION].top;

          win.style.right = "auto";
        }

        if (res[STORAGE_KEY_PROFILE_POSITION]) {
          profileWin.style.left =
            res[
              STORAGE_KEY_PROFILE_POSITION
            ].left;

          profileWin.style.top =
            res[
              STORAGE_KEY_PROFILE_POSITION
            ].top;

          profileWin.style.right = "auto";
        }

        setHidden(
          !!res[STORAGE_KEY_HIDDEN],
          false
        );

        renderList();
        renderProfile();
        renderSyncStatus();
        renderDraftReport();
      }
    );
  }

  shadow
    .getElementById("dc-search")
    .addEventListener("input", (e) => {
      searchTerm = e.target.value;
      renderList();
    });

  shadow.getElementById("dc-sort").addEventListener("change", (event) => {
    sortMode = event.target.value;
    chrome.storage.local.set({ [STORAGE_KEY_SORT]: sortMode });
    renderList();
  });

  shadow
    .getElementById("dc-chips")
    .addEventListener("click", (e) => {
      const chip = e.target.closest(".dc-chip");

      if (!chip) return;

      const position = chip.getAttribute("data-pos");

      if (position === "ALL") {
        activeFilters.clear();
      } else if (activeFilters.has(position)) {
        activeFilters.delete(position);
      } else {
        activeFilters.add(position);
      }

      shadow
        .querySelectorAll(".dc-chip")
        .forEach((c) => {
          const chipPosition = c.getAttribute("data-pos");
          const isActive =
            chipPosition === "ALL"
              ? activeFilters.size === 0
              : activeFilters.has(chipPosition);

          c.classList.toggle("dc-chip-active", isActive);
          c.setAttribute("aria-pressed", String(isActive));
        });

      renderList();
    });

  refreshButton.addEventListener(
    "click",
    requestRemoteRefresh
  );

  resetButton.addEventListener(
    "click",
    resetCurrentDraft
  );

  settingsButton.addEventListener(
    "click",
    () => openDrawer(settingsDrawer)
  );

  statusButton.addEventListener(
    "click",
    () => openDrawer(diagnosticsDrawer)
  );

  reportButton.addEventListener(
    "click",
    () => openDrawer(reportDrawer)
  );

  shadow
    .querySelectorAll("[data-close-drawer]")
    .forEach((button) => {
      button.addEventListener("click", closeDrawers);
    });

  shadow
    .getElementById("dc-settings-form")
    .addEventListener("submit", saveLeagueSettings);

  shadow
    .getElementById("dc-settings-form")
    .elements.namedItem("teamCount")
    .addEventListener("input", (event) => {
      const slotField = shadow
        .getElementById("dc-settings-form")
        .elements.namedItem("draftSlot");

      slotField.max = String(event.target.value || 20);
    });

  shadow.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDrawers();
  });

  shadow
    .getElementById("dc-hide")
    .addEventListener(
      "click",
      () => setHidden(true)
    );

  tab.addEventListener(
    "click",
    () => setHidden(false)
  );

  let draggingMain = false;
  let mainOffsetX = 0;
  let mainOffsetY = 0;

  dragHandle.addEventListener(
    "mousedown",
    (e) => {
      if (e.target.closest("button")) return;

      draggingMain = true;

      const rect =
        win.getBoundingClientRect();

      mainOffsetX =
        e.clientX - rect.left;

      mainOffsetY =
        e.clientY - rect.top;

      e.preventDefault();
    }
  );

  let draggingProfile = false;
  let profileOffsetX = 0;
  let profileOffsetY = 0;

  function attachProfileDrag() {
    const profileDragHandle =
      shadow.getElementById(
        "dc-profile-drag-handle"
      );

    if (!profileDragHandle) return;

    profileDragHandle.addEventListener(
      "mousedown",
      (e) => {
        if (e.target.closest("button")) return;

        draggingProfile = true;

        const rect =
          profileWin.getBoundingClientRect();

        profileOffsetX =
          e.clientX - rect.left;

        profileOffsetY =
          e.clientY - rect.top;

        e.preventDefault();
      }
    );
  }

  window.addEventListener(
    "mousemove",
    (e) => {
      if (draggingMain) {
        const left = Math.max(
          0,
          Math.min(
            window.innerWidth -
              win.offsetWidth,
            e.clientX - mainOffsetX
          )
        );

        const top = Math.max(
          0,
          Math.min(
            window.innerHeight -
              win.offsetHeight,
            e.clientY - mainOffsetY
          )
        );

        win.style.left = `${left}px`;
        win.style.top = `${top}px`;
        win.style.right = "auto";
      }

      if (draggingProfile) {
        const left = Math.max(
          0,
          Math.min(
            window.innerWidth -
              profileWin.offsetWidth,
            e.clientX - profileOffsetX
          )
        );

        const top = Math.max(
          0,
          Math.min(
            window.innerHeight -
              profileWin.offsetHeight,
            e.clientY - profileOffsetY
          )
        );

        profileWin.style.left = `${left}px`;
        profileWin.style.top = `${top}px`;
        profileWin.style.right = "auto";
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

      if (draggingProfile) {
        draggingProfile = false;

        chrome.storage.local.set({
          [STORAGE_KEY_PROFILE_POSITION]: {
            left: profileWin.style.left,
            top: profileWin.style.top,
          },
        });
      }
    }
  );

  chrome.storage.onChanged.addListener(
    (changes, area) => {
      if (area !== "local") return;

      if (changes[STORAGE_KEY_HIDDEN]) {
        setHidden(
          !!changes[
            STORAGE_KEY_HIDDEN
          ].newValue,
          false
        );
      }

      if (changes[STORAGE_KEY_DRAFTED]) {
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

      if (changes[STORAGE_KEY_MY_TEAM]) {
        myTeamIds = new Set(
          changes[
            STORAGE_KEY_MY_TEAM
          ].newValue || []
        );

        renderList();
        renderProfile();
        renderDraftReport();
      }

      if (changes[STORAGE_KEY_FAVORITES]) {
        favoriteIds = new Set(
          changes[STORAGE_KEY_FAVORITES].newValue || []
        );
        renderList();
      }

      if (changes[STORAGE_KEY_SORT]) {
        const nextSort = changes[STORAGE_KEY_SORT].newValue;
        sortMode = ["favorites", "rank", "adp", "projection"].includes(
          nextSort
        )
          ? nextSort
          : "favorites";
        shadow.getElementById("dc-sort").value = sortMode;
        renderList();
      }

      if (changes[STORAGE_KEY_LEAGUE_SETTINGS]) {
        leagueSettings = Core.normalizeLeagueSettings(
          changes[STORAGE_KEY_LEAGUE_SETTINGS].newValue
        );
        populateSettingsForm();
        renderRecommendation();
        renderDraftReport();
      }

      if (changes[STORAGE_KEY_DIAGNOSTICS]) {
        diagnostics = changes[STORAGE_KEY_DIAGNOSTICS].newValue || null;
        renderSyncStatus();
      }

      if (
        changes[STORAGE_KEY_REMOTE_DATA]
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

  window.setInterval(renderSyncStatus, 5000);

  loadState();
})();
