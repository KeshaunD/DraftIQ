(function () {
  if (document.getElementById("draft-copilot-host")) return;

  const STORAGE_KEY_DRAFTED = "draftCopilotDrafted";
  const STORAGE_KEY_MY_TEAM = "draftCopilotMyTeam";
  const STORAGE_KEY_POSITION = "draftCopilotPosition";
  const STORAGE_KEY_PROFILE_POSITION = "draftCopilotProfilePosition";
  const STORAGE_KEY_HIDDEN = "draftCopilotHidden";
  const STORAGE_KEY_REMOTE_DATA = "draftCopilotRemoteData";
  const STORAGE_KEY_REMOTE_DATA_VERSION = "draftCopilotRemoteDataVersion";

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
                  }" data-pos="${p}">${p}</button>`
              )
              .join("")}
          </div>
        </div>

        <div class="dc-recommendation" id="dc-recommendation"></div>

        <div class="dc-table-header">
          <div>Players</div>
          <div>ADP</div>
          <div>Proj</div>
        </div>

        <div class="dc-list" id="dc-list"></div>

        <div class="dc-footer" id="dc-footer">Click player to open profile <span>→</span></div>
      </div>
    </div>

    <div class="dc-profile-window dc-profile-hidden" id="dc-profile-window">
      <div class="dc-profile" id="dc-profile"></div>
    </div>
  `;
  shadow.appendChild(root);

  let activeFilter = "ALL";
  let searchTerm = "";
  let draftedIds = new Set();
  let myTeamIds = new Set();
  let selectedPlayer = null;
  let draftDataUpdatedAt = null;
  let refreshInProgress = false;
  let footerStatus = null;
  let footerStatusType = "normal";
  let footerStatusTimer = null;

  const win = shadow.getElementById("dc-window");
  const profileWin = shadow.getElementById("dc-profile-window");
  const tab = shadow.getElementById("dc-float-tab");
  const dragHandle = shadow.getElementById("dc-drag-handle");
  const refreshButton = shadow.getElementById("dc-refresh");
  const resetButton = shadow.getElementById("dc-reset");

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
    return draftPlayers.filter((p) => {
      if (isPlayerDrafted(p)) return false;

      const matchesPos =
        activeFilter === "ALL" || p.pos === activeFilter;

      const matchesSearch = p.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

      return matchesPos && matchesSearch;
    });
  }

  const STARTER_REQUIREMENTS = Object.freeze({
    QB: 1,
    RB: 2,
    WR: 3,
    TE: 1,
    FLEX: 2,
  });

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
    const baseNeeds = {
      QB: Math.max(0, STARTER_REQUIREMENTS.QB - counts.QB),
      RB: Math.max(0, STARTER_REQUIREMENTS.RB - counts.RB),
      WR: Math.max(0, STARTER_REQUIREMENTS.WR - counts.WR),
      TE: Math.max(0, STARTER_REQUIREMENTS.TE - counts.TE),
    };

    const flexFilled = Math.min(
      STARTER_REQUIREMENTS.FLEX,
      Math.max(0, counts.RB - STARTER_REQUIREMENTS.RB) +
        Math.max(0, counts.WR - STARTER_REQUIREMENTS.WR) +
        Math.max(0, counts.TE - STARTER_REQUIREMENTS.TE)
    );

    return {
      baseNeeds,
      flexNeed: Math.max(0, STARTER_REQUIREMENTS.FLEX - flexFilled),
      startersFilled:
        baseNeeds.QB === 0 &&
        baseNeeds.RB === 0 &&
        baseNeeds.WR === 0 &&
        baseNeeds.TE === 0 &&
        flexFilled >= STARTER_REQUIREMENTS.FLEX,
    };
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

    const projectionScore =
      projectedPpg === null
        ? 0
        : clamp((projectedPpg - 8) * 1.2, -5, 20);

    const byePenalty = getByeWeekPenalty(
      player,
      context.myTeamPlayers
    );

    const rankScore = 360 - rank * 2.6;

    return {
      player,
      score:
        rankScore +
        needScore +
        scarcity * 1.25 +
        adpUrgency +
        projectionScore -
        byePenalty,
      needScore,
      scarcity,
      adpUrgency,
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

    if (scored.scarcity >= 10) {
      reasons.push(`${pos} drops off soon`);
    }

    if (scored.adpUrgency >= 10) {
      reasons.push("is slipping past ADP");
    }

    if (scored.byePenalty >= 9) {
      reasons.push("despite a bye-week overlap");
    }

    if (!reasons.length) {
      reasons.push("is the strongest overall value available");
    }

    return reasons.slice(0, 2).join(" and ");
  }

  function buildRecommendation() {
    const availablePlayers = getAvailableSkillPlayers();

    if (!availablePlayers.length) return null;

    const myTeamPlayers = getMyTeamPlayers();
    const counts = getRosterCounts(myTeamPlayers);
    const needs = getRosterNeeds(counts);
    const draftedCount = getDraftedPlayers().length;
    const currentPick = draftedCount + 1;
    const roundNumber = Math.max(
      1,
      Math.ceil(currentPick / 12)
    );

    const context = {
      availablePlayers,
      myTeamPlayers,
      counts,
      needs,
      draftedCount,
      currentPick,
      roundNumber,
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

    const rosterSummary = ["QB", "RB", "WR", "TE"]
      .map((pos) => {
        const required = STARTER_REQUIREMENTS[pos];

        return `${pos} ${context.counts[pos]}/${required}`;
      })
      .join(" · ");

    const flexBaseFilled =
      Math.max(
        0,
        context.counts.RB - STARTER_REQUIREMENTS.RB
      ) +
      Math.max(
        0,
        context.counts.WR - STARTER_REQUIREMENTS.WR
      ) +
      Math.max(
        0,
        context.counts.TE - STARTER_REQUIREMENTS.TE
      );

    const flexFilled = Math.min(
      STARTER_REQUIREMENTS.FLEX,
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

      <div class="dc-rec-reason">
        ${getRecommendationReason(primary, context)}.
      </div>

      <div class="dc-rec-roster">
        ${rosterSummary} · FLEX ${flexFilled}/${STARTER_REQUIREMENTS.FLEX}
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
            <span class="dc-star">☆</span>
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
      .querySelectorAll(".dc-card")
      .forEach((card) => {
        card.addEventListener("click", () => {
          const id = card.getAttribute("data-id");
          const p = getPlayerById(id);

          if (!p) return;

          openProfile(p);
        });
      });

    renderRecommendation();
    renderFooter();
  }

  function setHidden(hidden, save = true) {
    root.classList.toggle(
      "dc-hidden",
      hidden
    );

    if (hidden) {
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
      ],
      (res) => {
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
      }
    );
  }

  shadow
    .getElementById("dc-search")
    .addEventListener("input", (e) => {
      searchTerm = e.target.value;
      renderList();
    });

  shadow
    .getElementById("dc-chips")
    .addEventListener("click", (e) => {
      const chip = e.target.closest(".dc-chip");

      if (!chip) return;

      activeFilter =
        chip.getAttribute("data-pos");

      shadow
        .querySelectorAll(".dc-chip")
        .forEach((c) => {
          c.classList.remove(
            "dc-chip-active"
          );
        });

      chip.classList.add("dc-chip-active");

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

        renderList();
        renderProfile();
      }

      if (changes[STORAGE_KEY_MY_TEAM]) {
        myTeamIds = new Set(
          changes[
            STORAGE_KEY_MY_TEAM
          ].newValue || []
        );

        renderList();
        renderProfile();
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

  loadState();
})();