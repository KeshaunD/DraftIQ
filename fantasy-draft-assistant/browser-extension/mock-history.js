(function () {
  if (window.__DRAFTIQ_MOCK_HISTORY_STARTED__) return;
  window.__DRAFTIQ_MOCK_HISTORY_STARTED__ = true;

  const STORAGE_KEY_CURRENT_DRAFT_ID = "draftCopilotMockCurrentDraftId";
  const STORAGE_KEY_IN_PROGRESS_DRAFTS = "draftCopilotMockDraftsInProgress";
  const STORAGE_KEY_COMPLETED_DRAFTS = "draftCopilotMockDraftHistory";
  const STORAGE_KEY_MOCK_ADP_SUMMARY = "draftCopilotMockAdpSummary";
  const STORAGE_KEY_MOCK_ADP_ANALYTICS = "draftCopilotMockAdpAnalytics";

  function log(...args) {
    console.log("[DraftIQ Mock History]", ...args);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function normalizeName(value) {
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

  function safeNumber(value, fallback = null) {
    if (value === null || value === undefined || value === "" || value === "-") {
      return fallback;
    }

    const number = Number(value);

    return Number.isNaN(number) ? fallback : number;
  }

  async function getStorage(keys) {
    return await chrome.storage.local.get(keys);
  }

  async function setStorage(data) {
    return await chrome.storage.local.set(data);
  }

  function applyDraftMetadata(draft, options = {}) {
    const teamCount = safeNumber(options.teamCount);
    const draftSlot = safeNumber(options.draftSlot);
    const scoring = String(options.scoring || "").trim().toLowerCase();

    if (options.source) draft.source = options.source;
    if (teamCount !== null && teamCount >= 2) draft.teamCount = teamCount;
    if (
      draftSlot !== null &&
      draftSlot >= 1 &&
      (teamCount === null || draftSlot <= teamCount)
    ) {
      draft.draftSlot = draftSlot;
    }
    if (scoring) draft.scoring = scoring;

    return draft;
  }

  function createDraft(draftId, options = {}) {
    const source = typeof options === "string"
      ? options
      : options.source || "yahoo";

    const draft = {
      draftId,
      source,
      startedAt: nowIso(),
      updatedAt: nowIso(),
      picks: [],
    };

    return applyDraftMetadata(
      draft,
      typeof options === "string" ? { source: options } : options
    );
  }

  function combineDrafts(...collections) {
    const draftsById = new Map();

    collections.flat().forEach((draft) => {
      if (!draft?.draftId) return;
      draftsById.set(String(draft.draftId), draft);
    });

    return Array.from(draftsById.values());
  }

  function getDraftDepth(draft) {
    const pickNumbers = (draft?.picks || [])
      .map((pick) => safeNumber(pick.overall))
      .filter((overall) => overall !== null);

    return pickNumbers.length ? Math.max(...pickNumbers) : 0;
  }

  function getDraftSlot(draft) {
    const teamCount = safeNumber(draft?.teamCount, 12);
    const explicit = safeNumber(draft?.draftSlot);

    if (explicit !== null && explicit >= 1 && explicit <= teamCount) {
      return explicit;
    }

    const match = String(draft?.draftId || "").match(/-(\d+)$/);
    const inferred = safeNumber(match?.[1]);

    return inferred !== null && inferred >= 1 && inferred <= teamCount
      ? inferred
      : null;
  }

  function pickBelongsToDraftSlot(overallPick, draftSlot, teamCount) {
    const overall = safeNumber(overallPick);
    const slot = safeNumber(draftSlot);
    const teams = safeNumber(teamCount, 12);

    if (overall === null || slot === null || teams < 2) return false;

    const round = Math.ceil(overall / teams);
    const pickWithinRound = ((overall - 1) % teams) + 1;
    const pickSlot = round % 2 === 1
      ? pickWithinRound
      : teams - pickWithinRound + 1;

    return pickSlot === slot;
  }

  function buildAnalytics(drafts) {
    const combinedDrafts = combineDrafts(drafts);

    return {
      updatedAt: nowIso(),
      drafts: combinedDrafts.map((draft) => ({
        ...(() => {
          const teamCount = safeNumber(draft.teamCount, 12);
          const draftSlot = getDraftSlot(draft);
          const picks = sortPicks(
            (draft.picks || []).map((pick) => ({ ...pick }))
          );
          const userPicks = draftSlot === null
            ? []
            : sortPicks(
                picks
                  .filter((pick) =>
                    pickBelongsToDraftSlot(
                      pick.overall,
                      draftSlot,
                      teamCount
                    )
                  )
                  .map((pick) => ({ ...pick }))
              );

          return {
            draftId: draft.draftId,
            source: draft.source || null,
            teamCount: safeNumber(draft.teamCount),
            draftSlot,
            scoring: draft.scoring || null,
            depth: getDraftDepth(draft),
            totalPicks: safeNumber(draft.totalPicks, getDraftDepth(draft)),
            completed: !!draft.completedAt,
            startedAt: draft.startedAt || null,
            updatedAt: draft.updatedAt || null,
            completedAt: draft.completedAt || null,
            picks,
            userPicks,
          };
        })(),
      })),
      players: buildSummary(combinedDrafts),
    };
  }

  function getNextOverallPick(draft) {
    const used = draft.picks
      .map((pick) => safeNumber(pick.overall))
      .filter((number) => number !== null);

    if (!used.length) return 1;

    return Math.max(...used) + 1;
  }

  function sortPicks(picks) {
    return picks.sort((a, b) => {
      const aOverall = safeNumber(a.overall, Number.MAX_SAFE_INTEGER);
      const bOverall = safeNumber(b.overall, Number.MAX_SAFE_INTEGER);

      if (aOverall !== bOverall) return aOverall - bOverall;

      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }

  async function startDraft(draftId, options = {}) {
    if (!draftId) return null;

    const active = await getStorage([
      STORAGE_KEY_IN_PROGRESS_DRAFTS,
      STORAGE_KEY_CURRENT_DRAFT_ID,
    ]);
    const previousDraftId = active[STORAGE_KEY_CURRENT_DRAFT_ID];
    const previousDrafts = active[STORAGE_KEY_IN_PROGRESS_DRAFTS] || {};
    const previousDraft = previousDrafts[previousDraftId];

    /*
     * Starting another draft is a reliable fallback completion signal. This
     * preserves the previous board and rolls it into the personal ADP sample
     * even if the platform never displayed a detectable completion message.
     */
    if (
      previousDraftId &&
      previousDraftId !== draftId &&
      previousDraft?.picks?.length &&
      !previousDraft.savedAt
    ) {
      await saveCompletedDraft(previousDraftId);
    }

    const current = await getStorage([
      STORAGE_KEY_IN_PROGRESS_DRAFTS,
      STORAGE_KEY_CURRENT_DRAFT_ID,
      STORAGE_KEY_COMPLETED_DRAFTS,
    ]);

    const drafts = current[STORAGE_KEY_IN_PROGRESS_DRAFTS] || {};
    const completedDrafts = current[STORAGE_KEY_COMPLETED_DRAFTS] || [];

    if (!drafts[draftId]) {
      drafts[draftId] = createDraft(draftId, options);
    }

    applyDraftMetadata(drafts[draftId], options);
    drafts[draftId].updatedAt = nowIso();

    const combinedDrafts = combineDrafts(
      Object.values(drafts),
      completedDrafts
    );

    await setStorage({
      [STORAGE_KEY_CURRENT_DRAFT_ID]: draftId,
      [STORAGE_KEY_IN_PROGRESS_DRAFTS]: drafts,
      [STORAGE_KEY_MOCK_ADP_SUMMARY]: buildSummary(combinedDrafts),
      [STORAGE_KEY_MOCK_ADP_ANALYTICS]: buildAnalytics(combinedDrafts),
    });

    log("Tracking draft:", draftId);

    return drafts[draftId];
  }

  async function recordPick(input = {}) {
    const draftId = input.draftId || "unknown-yahoo-draft";
    const name = input.name;
    const normalizedName = normalizeName(name);

    if (!name || !normalizedName) return null;

    const current = await getStorage([
      STORAGE_KEY_IN_PROGRESS_DRAFTS,
      STORAGE_KEY_CURRENT_DRAFT_ID,
      STORAGE_KEY_COMPLETED_DRAFTS,
    ]);

    const drafts = current[STORAGE_KEY_IN_PROGRESS_DRAFTS] || {};
    const completedDrafts = current[STORAGE_KEY_COMPLETED_DRAFTS] || [];
    const draft = drafts[draftId] || createDraft(draftId, input);

    applyDraftMetadata(draft, input);

    const explicitOverall = safeNumber(input.overall ?? input.pickNumber);
    const overall = explicitOverall || getNextOverallPick(draft);
    const estimatedOverall = explicitOverall === null;

    const existingPick = draft.picks.find((pick) => {
      return normalizeName(pick.name) === normalizedName;
    });

    if (existingPick) {
      if (!existingPick.overall || existingPick.estimatedOverall || explicitOverall !== null) {
        existingPick.overall = overall;
        existingPick.estimatedOverall = estimatedOverall;
      }

      existingPick.name = name;
      existingPick.team = input.team || existingPick.team || "-";
      existingPick.pos = input.pos || existingPick.pos || "-";
      existingPick.rank = input.rank ?? existingPick.rank ?? null;
      existingPick.adp = input.adp ?? existingPick.adp ?? null;
      existingPick.playerId = input.playerId ?? existingPick.playerId ?? null;
      existingPick.sourceType = input.sourceType || existingPick.sourceType || "unknown";
      existingPick.sourceText = input.sourceText || existingPick.sourceText || "";
      existingPick.updatedAt = nowIso();
    } else {
      draft.picks.push({
        overall,
        estimatedOverall,
        name,
        team: input.team || "-",
        pos: input.pos || "-",
        playerId: input.playerId ?? null,
        rank: input.rank ?? null,
        adp: input.adp ?? null,
        sourceType: input.sourceType || "unknown",
        sourceText: input.sourceText || "",
        addedAt: nowIso(),
        updatedAt: nowIso(),
      });
    }

    draft.picks = sortPicks(draft.picks);
    draft.updatedAt = nowIso();
    drafts[draftId] = draft;

    const combinedDrafts = combineDrafts(
      Object.values(drafts),
      completedDrafts
    );
    const summary = buildSummary(combinedDrafts);

    await setStorage({
      [STORAGE_KEY_CURRENT_DRAFT_ID]: draftId,
      [STORAGE_KEY_IN_PROGRESS_DRAFTS]: drafts,
      [STORAGE_KEY_MOCK_ADP_SUMMARY]: summary,
      [STORAGE_KEY_MOCK_ADP_ANALYTICS]: buildAnalytics(combinedDrafts),
    });

    return draft;
  }

  function buildSummary(completedDrafts) {
    const playerMap = new Map();

    completedDrafts.forEach((draft) => {
      const seenInDraft = new Set();

      (draft.picks || []).forEach((pick) => {
        const normalized = normalizeName(pick.name);
        const overall = safeNumber(pick.overall);

        if (!normalized || overall === null) return;

        const draftPlayerKey = `${draft.draftId}:${normalized}`;

        if (seenInDraft.has(draftPlayerKey)) return;
        seenInDraft.add(draftPlayerKey);

        if (!playerMap.has(normalized)) {
          playerMap.set(normalized, {
            name: pick.name,
            normalizedName: normalized,
            playerId: pick.playerId || null,
            pos: pick.pos || "-",
            team: pick.team || "-",
            picks: [],
          });
        }

        const record = playerMap.get(normalized);

        record.name = pick.name || record.name;
        record.playerId = pick.playerId || record.playerId;
        record.pos = pick.pos || record.pos;
        record.team = pick.team || record.team;

        record.picks.push({
          draftId: draft.draftId,
          overall,
        });
      });
    });

    const summary = Array.from(playerMap.values()).map((record) => {
      const pickNumbers = record.picks.map((pick) => pick.overall);
      const total = pickNumbers.reduce((sum, value) => sum + value, 0);
      const averagePick = total / pickNumbers.length;

      return {
        name: record.name,
        normalizedName: record.normalizedName,
        playerId: record.playerId,
        pos: record.pos,
        team: record.team,
        mockDraftsSeen: pickNumbers.length,
        averagePick: Number(averagePick.toFixed(2)),
        earliestPick: Math.min(...pickNumbers),
        latestPick: Math.max(...pickNumbers),
        picks: record.picks,
      };
    });

    return summary.sort((a, b) => a.averagePick - b.averagePick);
  }

  async function saveCompletedDraft(draftId = null) {
    const current = await getStorage([
      STORAGE_KEY_CURRENT_DRAFT_ID,
      STORAGE_KEY_IN_PROGRESS_DRAFTS,
      STORAGE_KEY_COMPLETED_DRAFTS,
    ]);

    const currentDraftId = draftId || current[STORAGE_KEY_CURRENT_DRAFT_ID];
    const drafts = current[STORAGE_KEY_IN_PROGRESS_DRAFTS] || {};
    const completedDrafts = current[STORAGE_KEY_COMPLETED_DRAFTS] || [];

    if (!currentDraftId || !drafts[currentDraftId]) {
      log("No current draft found to save.");
      return {
        ok: false,
        reason: "no_current_draft",
      };
    }

    const draft = drafts[currentDraftId];

    if (!draft.picks || !draft.picks.length) {
      log("Current draft has no picks yet:", currentDraftId);
      return {
        ok: false,
        reason: "no_picks",
      };
    }

    const completedDraft = {
      ...draft,
      completedAt: nowIso(),
      totalPicks: draft.picks.length,
    };

    const updatedCompletedDrafts = completedDrafts.filter((savedDraft) => {
      return savedDraft.draftId !== completedDraft.draftId;
    });

    updatedCompletedDrafts.push(completedDraft);

    drafts[currentDraftId] = {
      ...draft,
      savedAt: nowIso(),
    };

    const combinedDrafts = combineDrafts(
      Object.values(drafts),
      updatedCompletedDrafts
    );
    const summary = buildSummary(combinedDrafts);

    await setStorage({
      [STORAGE_KEY_IN_PROGRESS_DRAFTS]: drafts,
      [STORAGE_KEY_COMPLETED_DRAFTS]: updatedCompletedDrafts,
      [STORAGE_KEY_MOCK_ADP_SUMMARY]: summary,
      [STORAGE_KEY_MOCK_ADP_ANALYTICS]: buildAnalytics(combinedDrafts),
    });

    log(`Saved completed mock draft: ${currentDraftId}`);
    log(`Picks saved: ${completedDraft.totalPicks}`);
    log(`Completed drafts tracked: ${updatedCompletedDrafts.length}`);
    console.table(summary.slice(0, 25));

    return {
      ok: true,
      draft: completedDraft,
      completedDraftCount: updatedCompletedDrafts.length,
      summary,
    };
  }

  async function getCurrentDraft() {
    const current = await getStorage([
      STORAGE_KEY_CURRENT_DRAFT_ID,
      STORAGE_KEY_IN_PROGRESS_DRAFTS,
    ]);

    const currentDraftId = current[STORAGE_KEY_CURRENT_DRAFT_ID];
    const drafts = current[STORAGE_KEY_IN_PROGRESS_DRAFTS] || {};

    return currentDraftId ? drafts[currentDraftId] || null : null;
  }

  async function getCompletedDrafts() {
    const current = await getStorage([STORAGE_KEY_COMPLETED_DRAFTS]);
    return current[STORAGE_KEY_COMPLETED_DRAFTS] || [];
  }

  async function getAverages() {
    const current = await getStorage([STORAGE_KEY_MOCK_ADP_SUMMARY]);
    return current[STORAGE_KEY_MOCK_ADP_SUMMARY] || [];
  }

  async function getAnalytics() {
    const current = await getStorage([STORAGE_KEY_MOCK_ADP_ANALYTICS]);
    return current[STORAGE_KEY_MOCK_ADP_ANALYTICS] || {
      drafts: [],
      players: [],
    };
  }

  async function refreshStoredAnalytics() {
    const current = await getStorage([
      STORAGE_KEY_IN_PROGRESS_DRAFTS,
      STORAGE_KEY_COMPLETED_DRAFTS,
    ]);
    const drafts = current[STORAGE_KEY_IN_PROGRESS_DRAFTS] || {};
    const completedDrafts = current[STORAGE_KEY_COMPLETED_DRAFTS] || [];
    const combinedDrafts = combineDrafts(
      Object.values(drafts),
      completedDrafts
    );

    await setStorage({
      [STORAGE_KEY_MOCK_ADP_SUMMARY]: buildSummary(combinedDrafts),
      [STORAGE_KEY_MOCK_ADP_ANALYTICS]: buildAnalytics(combinedDrafts),
    });

    return combinedDrafts.length;
  }

  async function printAverages(limit = 50) {
    const averages = await getAverages();
    console.table(averages.slice(0, limit));
    return averages;
  }

  async function exportHistory() {
    const current = await getStorage([
      STORAGE_KEY_CURRENT_DRAFT_ID,
      STORAGE_KEY_IN_PROGRESS_DRAFTS,
      STORAGE_KEY_COMPLETED_DRAFTS,
      STORAGE_KEY_MOCK_ADP_SUMMARY,
      STORAGE_KEY_MOCK_ADP_ANALYTICS,
    ]);

    const payload = {
      exportedAt: nowIso(),
      currentDraftId: current[STORAGE_KEY_CURRENT_DRAFT_ID] || null,
      inProgressDrafts: current[STORAGE_KEY_IN_PROGRESS_DRAFTS] || {},
      completedDrafts: current[STORAGE_KEY_COMPLETED_DRAFTS] || [],
      mockAdpSummary: current[STORAGE_KEY_MOCK_ADP_SUMMARY] || [],
      mockAdpAnalytics: current[STORAGE_KEY_MOCK_ADP_ANALYTICS] || {
        drafts: [],
        players: [],
      },
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `draftiq-mock-history-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();

    URL.revokeObjectURL(url);

    log("Exported mock draft history.");

    return payload;
  }

  async function clearCurrentDraft() {
    const current = await getStorage([
      STORAGE_KEY_CURRENT_DRAFT_ID,
      STORAGE_KEY_IN_PROGRESS_DRAFTS,
      STORAGE_KEY_COMPLETED_DRAFTS,
    ]);

    const currentDraftId = current[STORAGE_KEY_CURRENT_DRAFT_ID];
    const drafts = current[STORAGE_KEY_IN_PROGRESS_DRAFTS] || {};
    const completedDrafts = current[STORAGE_KEY_COMPLETED_DRAFTS] || [];

    if (currentDraftId && drafts[currentDraftId]) {
      delete drafts[currentDraftId];
    }

    const combinedDrafts = combineDrafts(
      Object.values(drafts),
      completedDrafts
    );

    await setStorage({
      [STORAGE_KEY_IN_PROGRESS_DRAFTS]: drafts,
      [STORAGE_KEY_MOCK_ADP_SUMMARY]: buildSummary(combinedDrafts),
      [STORAGE_KEY_MOCK_ADP_ANALYTICS]: buildAnalytics(combinedDrafts),
    });

    log("Cleared current in-progress mock draft:", currentDraftId);

    return true;
  }

  async function clearAllHistory() {
    await chrome.storage.local.remove([
      STORAGE_KEY_CURRENT_DRAFT_ID,
      STORAGE_KEY_IN_PROGRESS_DRAFTS,
      STORAGE_KEY_COMPLETED_DRAFTS,
      STORAGE_KEY_MOCK_ADP_SUMMARY,
      STORAGE_KEY_MOCK_ADP_ANALYTICS,
    ]);

    log("Cleared all mock draft history.");

    return true;
  }

  function setupPageMessageBridge() {
    window.addEventListener("message", async (event) => {
      if (event.source !== window) return;
      if (!event.data || typeof event.data !== "object") return;

      const type = event.data.type;

      try {
        if (type === "DRAFTIQ_SAVE_MOCK_DRAFT") {
          const result = await saveCompletedDraft(event.data.draftId || null);

          window.postMessage(
            {
              type: "DRAFTIQ_SAVE_MOCK_DRAFT_RESULT",
              result,
            },
            "*"
          );
        }

        if (type === "DRAFTIQ_PRINT_MOCK_AVERAGES") {
          const result = await printAverages(event.data.limit || 50);

          window.postMessage(
            {
              type: "DRAFTIQ_PRINT_MOCK_AVERAGES_RESULT",
              result,
            },
            "*"
          );
        }

        if (type === "DRAFTIQ_EXPORT_MOCK_HISTORY") {
          const result = await exportHistory();

          window.postMessage(
            {
              type: "DRAFTIQ_EXPORT_MOCK_HISTORY_RESULT",
              result,
            },
            "*"
          );
        }

        if (type === "DRAFTIQ_CLEAR_MOCK_HISTORY") {
          const result = await clearAllHistory();

          window.postMessage(
            {
              type: "DRAFTIQ_CLEAR_MOCK_HISTORY_RESULT",
              result,
            },
            "*"
          );
        }
      } catch (error) {
        console.error("[DraftIQ Mock History] Command failed:", error);

        window.postMessage(
          {
            type: "DRAFTIQ_MOCK_HISTORY_ERROR",
            error: String(error),
          },
          "*"
        );
      }
    });
  }

  window.DraftIQMockHistory = {
    startDraft,
    recordPick,
    saveCompletedDraft,
    getCurrentDraft,
    getCompletedDrafts,
    getAverages,
    getAnalytics,
    refreshStoredAnalytics,
    printAverages,
    exportHistory,
    clearCurrentDraft,
    clearAllHistory,
  };

  setupPageMessageBridge();

  refreshStoredAnalytics().catch((error) => {
    console.error("[DraftIQ Mock History] Analytics migration failed:", error);
  });

  log("Loaded.");
})();
