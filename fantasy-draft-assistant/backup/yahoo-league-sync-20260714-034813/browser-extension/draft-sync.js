(function () {
  if (window.__DRAFTIQ_DRAFT_SYNC_STARTED__) return;

  window.__DRAFTIQ_DRAFT_SYNC_STARTED__ = true;

  const STORAGE_KEY_DRAFTED = "draftCopilotDrafted";
  const STORAGE_KEY_MY_TEAM = "draftCopilotMyTeam";
  const STORAGE_KEY_REMOTE_DATA = "draftCopilotRemoteData";
  const STORAGE_KEY_LEAGUE_SETTINGS = "draftCopilotLeagueSettings";
  const STORAGE_KEY_CURRENT_DRAFT_ID =
    "draftCopilotCurrentDraftId";
  const STORAGE_KEY_DIAGNOSTICS = "draftCopilotDiagnostics";

  const SyncCore = window.DraftIQSyncCore;

  if (!SyncCore) {
    console.error("[DraftIQ Sync] Platform utilities failed to load.");
    return;
  }

  const platformInfo = SyncCore.detectPlatform(window.location.hostname);

  const SEEN_TEXT = new Set();
  const SEEN_TEAM_TEXT = new Set();

  let draftPlayers = [];
  let draftedIdsMemory = new Set();
  let myTeamIdsMemory = new Set();
  let activeView = "unknown";
  let lastTeamScanAt = 0;
  let lastDiagnosticWriteAt = 0;
  let lastPickAt = null;
  let configuredTeamCount = 12;
  let configuredDraftSlot = 1;
  let currentLeagueSettings = {};
  let adapterMode = platformInfo.adapter;
  let lastSyncError = null;
  let lastSleeperApiScanAt = 0;
  let sleeperApiScanInFlight = false;
  let lastYahooSettingsScanAt = 0;
  let yahooSettingsScanInFlight = false;

  const TEAM_MAP = {
    ARI: "ARI",
    ATL: "ATL",
    BAL: "BAL",
    BUF: "BUF",
    CAR: "CAR",
    CHI: "CHI",
    CIN: "CIN",
    CLE: "CLE",
    DAL: "DAL",
    DEN: "DEN",
    DET: "DET",
    GB: "GB",
    GNB: "GB",
    HOU: "HOU",
    IND: "IND",
    JAX: "JAX",
    JAC: "JAX",
    KC: "KC",
    KAN: "KC",
    LAC: "LAC",
    SD: "LAC",
    LAR: "LAR",
    STL: "LAR",
    LV: "LV",
    OAK: "LV",
    MIA: "MIA",
    MIN: "MIN",
    NE: "NE",
    NO: "NO",
    NOR: "NO",
    NYG: "NYG",
    NYJ: "NYJ",
    PHI: "PHI",
    PIT: "PIT",
    SEA: "SEA",
    SF: "SF",
    SFO: "SF",
    TB: "TB",
    TAM: "TB",
    TEN: "TEN",
    WAS: "WAS",
    WSH: "WAS",
  };

  const FIRST_NAME_ALIASES = {
    cameron: ["cam"],
    cam: ["cameron"],

    kenneth: ["kenny"],
    kenny: ["kenneth"],

    chigoziem: ["chig"],
    chig: ["chigoziem"],

    nathaniel: ["tank"],
    tank: ["nathaniel"],

    amon: ["amon ra"],
    "amon ra": ["amon"],

    christian: ["chris"],
    chris: ["christian"],

    michael: ["mike"],
    mike: ["michael"],

    matthew: ["matt"],
    matt: ["matthew"],

    william: ["will", "bill", "billy"],
    will: ["william"],
    bill: ["william"],
    billy: ["william"],

    james: ["jim", "jimmy"],
    jim: ["james"],
    jimmy: ["james"],

    robert: ["rob", "bobby"],
    rob: ["robert"],
    bobby: ["robert"],

    joseph: ["joe", "joey"],
    joe: ["joseph"],
    joey: ["joseph"],

    nicholas: ["nick"],
    nick: ["nicholas"],

    jonathan: ["john", "jon"],
    john: ["jonathan"],
    jon: ["jonathan"],

    alexander: ["alex"],
    alex: ["alexander"],

    zachary: ["zach"],
    zach: ["zachary"],
  };

  function log(...args) {
    console.log("[DraftIQ Sync]", ...args);
  }

  function getPlatformInfo() {
    return {
      platform: platformInfo.label,
      platformKey: platformInfo.key,
      supported: platformInfo.supported,
      adapter: adapterMode,
    };
  }

  function countTrackedPlayers(keys) {
    return draftPlayers.filter((player) =>
      getPlayerKeys(player).some((key) => keys.has(key))
    ).length;
  }

  async function writeDiagnostics(force = false) {
    const now = Date.now();

    if (!force && now - lastDiagnosticWriteAt < 5000) return;

    lastDiagnosticWriteAt = now;

    const platformInfo = getPlatformInfo();

    await chrome.storage.local.set({
      [STORAGE_KEY_DIAGNOSTICS]: {
        ...platformInfo,
        connected: true,
        activeView,
        lastScanAt: new Date(now).toISOString(),
        lastPickAt,
        syncError: lastSyncError,
        draftedCount: countTrackedPlayers(draftedIdsMemory),
        myTeamCount: countTrackedPlayers(myTeamIdsMemory),
        playerDataCount: draftPlayers.length,
        draftId: getDraftSessionId(),
      },
    });
  }

  function getDraftSessionId() {
    return SyncCore.getDraftSessionId(window.location, platformInfo.key);
  }

  function getRawDraftId() {
    return SyncCore.getRawDraftId(window.location, platformInfo.key);
  }

  async function resetDraftedIfNewDraftSession() {
    const draftSessionId =
      getDraftSessionId();

    if (!draftSessionId) return;

    const current =
      await chrome.storage.local.get([
        STORAGE_KEY_CURRENT_DRAFT_ID,
      ]);

    const savedDraftSessionId =
      current[STORAGE_KEY_CURRENT_DRAFT_ID];

    if (savedDraftSessionId === draftSessionId) {
      return;
    }

    SEEN_TEXT.clear();
    SEEN_TEAM_TEXT.clear();

    draftedIdsMemory = new Set();
    myTeamIdsMemory = new Set();

    await chrome.storage.local.set({
      [STORAGE_KEY_CURRENT_DRAFT_ID]:
        draftSessionId,
      [STORAGE_KEY_DRAFTED]: [],
      [STORAGE_KEY_MY_TEAM]: [],
    });

    if (
      window.DraftIQMockHistory &&
      window.DraftIQMockHistory.startDraft
    ) {
      await window.DraftIQMockHistory.startDraft(
        draftSessionId,
        {
          source: platformInfo.key,
        }
      );
    }

    log(
      `New ${platformInfo.label} draft detected. Cleared drafted players:`,
      draftSessionId
    );
  }

  async function loadDraftedMemory() {
    const current =
      await chrome.storage.local.get([
        STORAGE_KEY_DRAFTED,
      ]);

    draftedIdsMemory = new Set(
      current[STORAGE_KEY_DRAFTED] || []
    );
  }

  async function loadMyTeamMemory() {
    const current =
      await chrome.storage.local.get([
        STORAGE_KEY_MY_TEAM,
      ]);

    myTeamIdsMemory = new Set(
      current[STORAGE_KEY_MY_TEAM] || []
    );
  }

  function applyLeagueSettingsMemory(saved = {}) {
    currentLeagueSettings = { ...saved };
    const teams = Number(saved.teamCount);
    const slot = Number(saved.draftSlot);

    configuredTeamCount =
      Number.isInteger(teams) && teams >= 2 && teams <= 20
        ? teams
        : 12;
    configuredDraftSlot =
      Number.isInteger(slot) &&
      slot > 0 &&
      slot <= configuredTeamCount
        ? slot
        : 1;
  }

  async function loadLeagueSettings() {
    const current = await chrome.storage.local.get([
      STORAGE_KEY_LEAGUE_SETTINGS,
    ]);

    applyLeagueSettingsMemory(current[STORAGE_KEY_LEAGUE_SETTINGS] || {});
  }

  async function applyAutoDetectedYahooSettings(
    detectedSettings,
    detectedFields,
    source = "Yahoo draft room"
  ) {
    if (platformInfo.key !== "yahoo") return false;

    const manualOverrides = new Set(
      Array.isArray(currentLeagueSettings.manualOverrides)
        ? currentLeagueSettings.manualOverrides
        : []
    );
    const fields = Array.from(new Set(detectedFields || [])).filter(
      (field) =>
        [
          "teamCount",
          "draftSlot",
          "scoring",
          "qb",
          "rb",
          "wr",
          "te",
          "flex",
          "bench",
        ].includes(field) && !manualOverrides.has(field)
    );
    const changedFields = fields.filter(
      (field) => currentLeagueSettings[field] !== detectedSettings[field]
    );

    if (!changedFields.length) return false;

    const nextSettings = {
      ...currentLeagueSettings,
      ...detectedSettings,
      autoDetection: {
        platform: "yahoo",
        source,
        fields,
        updatedAt: new Date().toISOString(),
      },
    };

    applyLeagueSettingsMemory(nextSettings);
    await chrome.storage.local.set({
      [STORAGE_KEY_LEAGUE_SETTINGS]: nextSettings,
    });

    log("Auto-detected Yahoo settings:", changedFields.join(", "));
    return true;
  }

  function getYahooSettingsSourceText() {
    const pieces = [(document.body.innerText || "").slice(0, 250000)];
    const labeledElements = document.querySelectorAll(
      '[aria-label*="draft position" i], [title*="draft position" i], [aria-label*="scoring" i], [title*="scoring" i], [class*="settings" i], [data-testid*="settings" i]'
    );

    Array.from(labeledElements)
      .slice(0, 40)
      .forEach((element) => {
        const label = element.getAttribute("aria-label") || "";
        const title = element.getAttribute("title") || "";
        const text = (element.innerText || element.textContent || "").slice(
          0,
          1500
        );

        pieces.push(label, title, text);
      });

    Array.from(document.querySelectorAll("[data-draft-slot]"))
      .slice(0, 40)
      .forEach((element) => {
        const context = [
          element.getAttribute("aria-label"),
          element.getAttribute("title"),
          element.textContent,
          element.parentElement?.getAttribute("aria-label"),
        ]
          .filter(Boolean)
          .join(" ");
        const slot = Number(element.getAttribute("data-draft-slot"));

        if (
          /\b(?:you|your\s+team|my\s+team)\b/i.test(context) &&
          Number.isInteger(slot) &&
          slot >= 1 &&
          slot <= 20
        ) {
          pieces.push(`Your Draft Position: ${slot}`);
        }
      });

    return pieces.filter(Boolean).join("\n");
  }

  async function scanYahooLeagueSettings(force = false) {
    const now = Date.now();

    if (
      platformInfo.key !== "yahoo" ||
      yahooSettingsScanInFlight ||
      (!force && now - lastYahooSettingsScanAt < 6000)
    ) {
      return;
    }

    lastYahooSettingsScanAt = now;
    yahooSettingsScanInFlight = true;

    try {
      const detection = SyncCore.parseYahooLeagueSettings(
        getYahooSettingsSourceText()
      );

      if (detection.detectedFields.length) {
        await applyAutoDetectedYahooSettings(
          detection.settings,
          detection.detectedFields
        );
      }
    } catch (error) {
      log("Yahoo settings detection failed:", error?.message || error);
    } finally {
      yahooSettingsScanInFlight = false;
    }
  }

  function loadBundledPlayers() {
    try {
      if (
        Array.isArray(
          DRAFT_COPILOT_PLAYERS
        )
      ) {
        draftPlayers =
          DRAFT_COPILOT_PLAYERS;
      }
    } catch (error) {
      draftPlayers = [];
    }
  }

  function loadRemotePlayers() {
    chrome.storage.local.get(
      [STORAGE_KEY_REMOTE_DATA],
      (res) => {
        const remoteData =
          res[STORAGE_KEY_REMOTE_DATA];

        if (
          remoteData &&
          Array.isArray(remoteData.players)
        ) {
          draftPlayers = remoteData.players;

          log(
            "Loaded remote player data:",
            draftPlayers.length
          );
        } else {
          log(
            "Loaded bundled player data:",
            draftPlayers.length
          );
        }

        runDraftSyncScan();
      }
    );
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\./g, "")
      .replace(/'/g, "")
      .replace(/’/g, "")
      .replace(/-/g, " ")
      .replace(
        /\b(jr|sr|ii|iii|iv|v)\b/g,
        ""
      )
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeTeam(value) {
    const raw = String(value || "")
      .toUpperCase()
      .replace(/[^A-Z]/g, "");

    return TEAM_MAP[raw] || raw;
  }

  function normalizePosition(value) {
    const pos = String(value || "")
      .toUpperCase();

    if (pos === "DST") return "DEF";

    return pos;
  }

  function getPlayerKeys(player) {
    const keys = new Set();

    if (player.id) {
      keys.add(String(player.id));
    }

    if (player.name) {
      keys.add(String(player.name));
      keys.add(
        normalizeText(player.name)
      );
    }

    return Array.from(keys).filter(Boolean);
  }

  function addAliasSet(
    aliases,
    firstName,
    lastPartsList
  ) {
    if (!firstName) return;

    lastPartsList.forEach((lastPart) => {
      if (!lastPart) return;

      aliases.add(
        `${firstName} ${lastPart}`
      );

      aliases.add(
        `${firstName[0]} ${lastPart}`
      );
    });
  }

  function getPlayerAliases(player) {
    const aliases = new Set();

    const name = player.name || "";
    const normalized = normalizeText(name);

    const parts = normalized
      .split(" ")
      .filter(Boolean);

    if (normalized) {
      aliases.add(normalized);
    }

    if (parts.length >= 2) {
      const first = parts[0];
      const last = parts[parts.length - 1];

      const lastParts = parts
        .slice(1)
        .join(" ");

      const lastTwoParts = parts
        .slice(-2)
        .join(" ");

      const lastThreeParts = parts
        .slice(-3)
        .join(" ");

      const lastPartsList = Array.from(
        new Set(
          [
            last,
            lastParts,
            lastTwoParts,
            lastThreeParts,
          ].filter(Boolean)
        )
      );

      addAliasSet(
        aliases,
        first,
        lastPartsList
      );

      const twoPartFirstName = parts
        .slice(0, 2)
        .join(" ");

      const twoPartFirstNameAliases =
        FIRST_NAME_ALIASES[
          twoPartFirstName
        ] || [];

      twoPartFirstNameAliases.forEach(
        (aliasFirstName) => {
          addAliasSet(
            aliases,
            aliasFirstName,
            lastPartsList
          );
        }
      );

      const firstNameAliases =
        FIRST_NAME_ALIASES[first] || [];

      firstNameAliases.forEach(
        (aliasFirstName) => {
          addAliasSet(
            aliases,
            aliasFirstName,
            lastPartsList
          );
        }
      );
    }

    return Array.from(aliases).filter(
      Boolean
    );
  }

  function textMatchesPlayer(
    text,
    player
  ) {
    const normalizedText =
      ` ${normalizeText(text)} `;

    const aliases =
      getPlayerAliases(player);

    return aliases.some((alias) =>
      normalizedText.includes(
        ` ${alias} `
      )
    );
  }

  function getPlayerRankNumber(player) {
    const rank = Number(player.rank);
    const adp = Number(player.adp);

    if (!Number.isNaN(rank)) {
      return rank;
    }

    if (!Number.isNaN(adp)) {
      return adp;
    }

    return null;
  }

  function extractDraftedPlayerInfo(text) {
    const cleaned = String(text || "")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleaned) return null;

    if (platformInfo.key !== "yahoo") {
      const platformPick = SyncCore.extractPlayerInfo(
        cleaned,
        platformInfo.key
      );

      if (platformPick) return platformPick;
    }

    const yahooNamePattern =
      "[A-Z]\\.?" +
      "\\s+" +
      "[A-Z][A-Z.'-]+" +
      "(?:\\s+[A-Z][A-Z.'-]+)*" +
      "(?:\\s+(?:Jr\\.?|Sr\\.?|II|III|IV|V))?";

    const rowNamePattern =
      "[A-Z]\\.?" +
      "\\s+" +
      "[A-Za-z.'-]+" +
      "(?:\\s+[A-Za-z.'-]+)*" +
      "(?:\\s+(?:Jr\\.?|Sr\\.?|II|III|IV|V))?";

    const lastPickRegex = new RegExp(
      "Last:\\s*(" +
        yahooNamePattern +
        ")\\s*\\(\\s*(QB|RB|WR|TE|K|PK|DEF|DST)\\s*[·\\-]\\s*([A-Z]{2,3})\\s*\\)",
      "i"
    );

    const lastPickMatch =
      cleaned.match(lastPickRegex);

    if (lastPickMatch) {
      return {
        name: lastPickMatch[1],
        pos: normalizePosition(
          lastPickMatch[2]
        ),
        team: normalizeTeam(
          lastPickMatch[3]
        ),
        pickNumber: null,
        sourceType: "last-pick",
      };
    }

    const rowRegex = new RegExp(
      "(?:^|\\s)(?:QB|RB|WR|TE|K|PK|BN|W\\s*R\\s*T|DEF)?" +
        "\\s*(" +
        rowNamePattern +
        ")" +
        "\\s+(QB|RB|WR|TE|K|PK|DEF|DST)" +
        "\\s+([A-Za-z]{2,3})" +
        "\\s+Bye\\s+\\d+" +
        "(?:\\s+\\d+)?" +
        "(?:\\s+(\\d+))?",
      "i"
    );

    const rowMatch =
      cleaned.match(rowRegex);

    if (rowMatch) {
      return {
        name: rowMatch[1],
        pos: normalizePosition(
          rowMatch[2]
        ),
        team: normalizeTeam(
          rowMatch[3]
        ),
        pickNumber: rowMatch[4]
          ? Number(rowMatch[4])
          : null,
        sourceType: "draft-row",
      };
    }

    return SyncCore.extractPlayerInfo(cleaned, platformInfo.key);
  }

  function resolvePlayerMatches(text) {
    const info =
      extractDraftedPlayerInfo(text);

    if (!info) return [];

    let matches = draftPlayers.filter(
      (player) =>
        textMatchesPlayer(
          info.name,
          player
        )
    );

    if (!matches.length) {
      matches = draftPlayers.filter(
        (player) =>
          textMatchesPlayer(
            text,
            player
          )
      );
    }

    if (!matches.length) return [];

    if (info.pos) {
      const posMatches =
        matches.filter(
          (player) =>
            normalizePosition(
              player.pos
            ) === info.pos
        );

      if (posMatches.length) {
        matches = posMatches;
      }
    }

    if (info.team) {
      const teamMatches =
        matches.filter(
          (player) =>
            normalizeTeam(
              player.team
            ) === info.team
        );

      if (teamMatches.length) {
        matches = teamMatches;
      }
    }

    if (
      matches.length > 1 &&
      info.pickNumber
    ) {
      const rankedMatches = matches
        .map((player) => {
          const rankNumber =
            getPlayerRankNumber(player);

          return {
            player,
            distance:
              rankNumber === null
                ? Number.MAX_SAFE_INTEGER
                : Math.abs(
                    rankNumber -
                      info.pickNumber
                  ),
          };
        })
        .sort(
          (a, b) =>
            a.distance - b.distance
        );

      if (rankedMatches.length) {
        matches = [
          rankedMatches[0].player,
        ];
      }
    }

    if (matches.length > 1) {
      const rankedMatches = matches
        .map((player) => {
          const rankNumber =
            getPlayerRankNumber(player);

          return {
            player,
            rankNumber:
              rankNumber === null
                ? Number.MAX_SAFE_INTEGER
                : rankNumber,
          };
        })
        .sort(
          (a, b) =>
            a.rankNumber -
            b.rankNumber
        );

      const selectedPlayer =
        rankedMatches[0].player;

      log(
        "Ambiguous match resolved by rank:",
        text,
        "=>",
        selectedPlayer.name,
        "from",
        matches
          .map((p) => p.name)
          .join(", ")
      );

      matches = [selectedPlayer];
    }

    return matches;
  }

  function resolveLoosePlayerMatches(text, playerInfo = {}) {
    const sourceName = playerInfo.name || text;
    let matches = draftPlayers.filter((player) =>
      textMatchesPlayer(sourceName, player)
    );

    if (!matches.length && sourceName !== text) {
      matches = draftPlayers.filter((player) =>
        textMatchesPlayer(text, player)
      );
    }

    if (playerInfo.pos) {
      const positionMatches = matches.filter(
        (player) =>
          normalizePosition(player.pos) ===
          normalizePosition(playerInfo.pos)
      );
      if (positionMatches.length) matches = positionMatches;
    }

    if (playerInfo.team) {
      const teamMatches = matches.filter(
        (player) =>
          normalizeTeam(player.team) ===
          normalizeTeam(playerInfo.team)
      );
      if (teamMatches.length) matches = teamMatches;
    }

    return matches
      .sort(
        (a, b) =>
          (getPlayerRankNumber(a) ?? Number.MAX_SAFE_INTEGER) -
          (getPlayerRankNumber(b) ?? Number.MAX_SAFE_INTEGER)
      )
      .slice(0, 1);
  }

  function isConfiguredYahooPick(overallPick) {
    const pick = Number(overallPick);

    if (
      platformInfo.key !== "yahoo" ||
      !Number.isInteger(pick) ||
      pick < 1
    ) {
      return false;
    }

    const draftSlot = SyncCore.getSnakeDraftSlot(
      pick,
      configuredTeamCount
    );

    return draftSlot === configuredDraftSlot;
  }

  function getYahooOverallPick(draftInfo = {}) {
    const explicitPick = Number(draftInfo.pickNumber);

    if (Number.isInteger(explicitPick) && explicitPick > 0) {
      return explicitPick;
    }

    if (draftInfo.sourceType === "last-pick") {
      return countTrackedPlayers(draftedIdsMemory);
    }

    return null;
  }

  async function markPlayersDrafted(
    players,
    sourceText,
    draftInfo = {}
  ) {
    if (!players.length) return;

    const newlyDrafted = [];

    players.forEach((player) => {
      const keys =
        getPlayerKeys(player);

      const alreadyDrafted =
        keys.some((key) =>
          draftedIdsMemory.has(key)
        );

      if (!alreadyDrafted) {
        keys.forEach((key) =>
          draftedIdsMemory.add(key)
        );

        newlyDrafted.push(player);
      }
    });

    const yahooOverallPick = getYahooOverallPick(draftInfo);

    if (
      platformInfo.key === "yahoo" &&
      yahooOverallPick &&
      players.some((player) =>
        getPlayerKeys(player).some((key) => myTeamIdsMemory.has(key))
      )
    ) {
      const inferredDraftSlot = SyncCore.getSnakeDraftSlot(
        yahooOverallPick,
        configuredTeamCount
      );

      if (inferredDraftSlot) {
        await applyAutoDetectedYahooSettings(
          { draftSlot: inferredDraftSlot },
          ["draftSlot"],
          "Yahoo roster and pick history"
        );
      }
    }

    if (isConfiguredYahooPick(yahooOverallPick)) {
      await markPlayersOnMyTeam(
        players,
        `${sourceText} | Yahoo pick ${yahooOverallPick}`
      );
    }

    if (!newlyDrafted.length) {
      return;
    }

    if (
      window.DraftIQMockHistory &&
      window.DraftIQMockHistory.recordPick
    ) {
      for (const player of newlyDrafted) {
        await window.DraftIQMockHistory.recordPick({
          draftId: getDraftSessionId(),
          source: platformInfo.key,
          sourceType: draftInfo.sourceType || "unknown",
          sourceText,
          pickNumber: draftInfo.pickNumber,
          name: player.name,
          team: player.team,
          pos: player.pos,
          rank: player.rank,
          adp: player.adp,
        });
      }
    }

    await chrome.storage.local.set({
      [STORAGE_KEY_DRAFTED]:
        Array.from(
          draftedIdsMemory
        ),
    });

    lastPickAt = new Date().toISOString();
    writeDiagnostics(true);

    newlyDrafted.forEach((player) => {
      log(
        "Marked drafted:",
        player.name
      );
    });

    log(
      "Draft event text:",
      sourceText
    );
  }

  async function markPlayersOnMyTeam(
    players,
    sourceText
  ) {
    if (!players.length) return;

    let teamChanged = false;
    let draftedChanged = false;

    players.forEach((player) => {
      const keys =
        getPlayerKeys(player);

      if (
        !keys.some((key) =>
          myTeamIdsMemory.has(key)
        )
      ) {
        keys.forEach((key) =>
          myTeamIdsMemory.add(key)
        );

        teamChanged = true;

        log(
          "Added to your DraftIQ roster:",
          player.name
        );
      }

      if (
        !keys.some((key) =>
          draftedIdsMemory.has(key)
        )
      ) {
        keys.forEach((key) =>
          draftedIdsMemory.add(key)
        );

        draftedChanged = true;
      }
    });

    if (
      !teamChanged &&
      !draftedChanged
    ) {
      return;
    }

    const updates = {};

    if (teamChanged) {
      updates[STORAGE_KEY_MY_TEAM] =
        Array.from(myTeamIdsMemory);
    }

    if (draftedChanged) {
      updates[STORAGE_KEY_DRAFTED] =
        Array.from(draftedIdsMemory);
    }

    await chrome.storage.local.set(
      updates
    );

    if (draftedChanged) {
      lastPickAt = new Date().toISOString();
    }

    writeDiagnostics(true);

    log(
      "Your Team roster text:",
      sourceText
    );
  }

  function shouldIgnoreText(text) {
    const lower = String(text || "")
      .toLowerCase();

    if (!lower) return true;

    if (
      lower.includes(
        "will appear here"
      )
    ) {
      return true;
    }

    if (lower.includes("draftiq")) {
      return true;
    }

    if (
      lower.includes(
        "click player to open profile"
      )
    ) {
      return true;
    }

    if (lower.includes("add queue")) {
      return true;
    }

    if (
      lower.includes("remove queue")
    ) {
      return true;
    }

    if (
      lower.includes(
        "rank player team bye"
      )
    ) {
      return true;
    }

    if (
      lower.includes(
        "players adp proj"
      )
    ) {
      return true;
    }

    if (
      lower.includes(
        "projected points"
      ) &&
      lower.includes("pre-season")
    ) {
      return true;
    }

    if (lower.length > 900) {
      return true;
    }

    return false;
  }

  function processDraftText(
    text,
    source = "unknown"
  ) {
    const cleaned = String(text || "")
      .replace(/\s+/g, " ")
      .trim();

    if (shouldIgnoreText(cleaned)) {
      return;
    }

    if (SEEN_TEXT.has(cleaned)) {
      return;
    }

    const info =
      extractDraftedPlayerInfo(cleaned);

    if (!info) return;

    const matchedPlayers =
      resolvePlayerMatches(cleaned);

    SEEN_TEXT.add(cleaned);

    if (!matchedPlayers.length) {
      return;
    }

    log(
      `Matched ${matchedPlayers.length} player(s) from ${source}:`,
      cleaned
    );

    markPlayersDrafted(
      matchedPlayers,
      cleaned,
      info
    );
  }

  function processScopedDraftText(
    text,
    source = "scoped-draft-board",
    knownInfo = null
  ) {
    const cleaned = String(text || "")
      .replace(/\s+/g, " ")
      .trim();

    if (
      !cleaned ||
      cleaned.length > 240 ||
      shouldIgnoreText(cleaned)
    ) {
      return;
    }

    const seenKey = `${platformInfo.key}:${source}:${cleaned}`;
    if (SEEN_TEXT.has(seenKey)) return;

    const info =
      knownInfo ||
      extractDraftedPlayerInfo(cleaned) ||
      {};
    const matchedPlayers = info.name
      ? resolveLoosePlayerMatches(cleaned, info)
      : resolveLoosePlayerMatches(cleaned);

    if (!matchedPlayers.length) return;

    SEEN_TEXT.add(seenKey);
    markPlayersDrafted(matchedPlayers, cleaned, {
      ...info,
      sourceType: info.sourceType || source,
    });
  }

  function isElementVisible(element) {
    if (
      !element ||
      !element.getBoundingClientRect
    ) {
      return false;
    }

    const rect =
      element.getBoundingClientRect();

    const style =
      window.getComputedStyle(element);

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0"
    );
  }

  function getElementText(element) {
    return (
      element.innerText ||
      element.textContent ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim();
  }

  function scanLastPickFromBodyLines() {
    const lines = (
      document.body.innerText || ""
    )
      .split("\n")
      .map((line) =>
        line
          .replace(/\s+/g, " ")
          .trim()
      )
      .filter(Boolean);

    lines.forEach((line, index) => {
      if (
        line.toLowerCase() !== "last:"
      ) {
        return;
      }

      const combined = [
        lines[index],
        lines[index + 1],
        lines[index + 2],
        lines[index + 3],
      ]
        .filter(Boolean)
        .join(" ");

      processDraftText(
        combined,
        "last-pick-lines"
      );
    });
  }

  function scanDraftRows() {
    const elements =
      document.querySelectorAll(
        [
          "tr",
          "li",
          "[role='row']",
          "[role='gridcell']",
          "td",
          "div",
          "span",
        ].join(",")
      );

    elements.forEach((element) => {
      if (!isElementVisible(element)) {
        return;
      }

      const text =
        getElementText(element);

      if (
        !text ||
        shouldIgnoreText(text)
      ) {
        return;
      }

      if (
        text.length < 3 ||
        text.length > 500
      ) {
        return;
      }

      if (
        !extractDraftedPlayerInfo(
          text
        )
      ) {
        return;
      }

      processDraftText(
        text,
        "draft-row"
      );
    });
  }

  function getPlatformBoardContainers() {
    const selectors =
      platformInfo.key === "espn"
        ? [
            "[data-testid*='draft-board' i]",
            "[data-testid*='draft-pick' i]",
            "[data-testid*='pick-history' i]",
            "[class*='draftBoard']",
            "[class*='draft-board']",
            "[class*='pickHistory']",
            "[class*='pick-history']",
            "[aria-label*='draft board' i]",
            "[aria-label*='pick history' i]",
            "[aria-label*='draft results' i]",
          ]
        : [
            "[data-testid*='draftboard' i]",
            "[data-testid*='draft-board' i]",
            "[data-testid*='draft-pick' i]",
            "[class*='draftboard']",
            "[class*='draft-board']",
            "[aria-label*='draft board' i]",
          ];

    return Array.from(
      document.querySelectorAll(selectors.join(","))
    ).filter(isElementVisible);
  }

  function scanPlatformDraftBoard() {
    const containers = getPlatformBoardContainers();
    if (!containers.length) return;

    activeView = "draft board";

    const candidateSelector = [
      "[data-player-id]",
      "[data-athlete-id]",
      "[data-testid*='pick' i]",
      "[aria-label*='pick' i]",
      "[role='gridcell']",
      "[role='row']",
      "li",
      "button",
      "div",
    ].join(",");

    containers.forEach((container) => {
      const candidates = container.matches(candidateSelector)
        ? [container]
        : Array.from(container.querySelectorAll(candidateSelector));

      candidates.forEach((candidate) => {
        if (!isElementVisible(candidate)) return;

        const text = getElementText(candidate);
        if (!text || text.length < 3 || text.length > 240) return;

        const lower = text.toLowerCase();
        if (
          lower.includes("available players") ||
          lower.includes("player pool") ||
          lower.includes("search players")
        ) {
          return;
        }

        processScopedDraftText(
          text,
          `${platformInfo.key}-draft-board`
        );
      });
    });
  }

  function requestSleeperDraft(rawDraftId) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: "DRAFTIQ_GET_SLEEPER_DRAFT",
          draftId: rawDraftId,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!response?.ok) {
            reject(new Error(response?.error || "Sleeper sync failed"));
            return;
          }

          resolve(response);
        }
      );
    });
  }

  async function scanSleeperApi() {
    const rawDraftId = getRawDraftId();
    const now = Date.now();

    if (
      !rawDraftId ||
      sleeperApiScanInFlight ||
      now - lastSleeperApiScanAt < 2500
    ) {
      return;
    }

    sleeperApiScanInFlight = true;
    lastSleeperApiScanAt = now;

    try {
      const { draft, picks } = await requestSleeperDraft(rawDraftId);

      if (!Array.isArray(picks)) {
        throw new Error("Sleeper picks response was not a list");
      }

      adapterMode = "api";
      activeView = draft?.status
        ? `draft ${draft.status}`
        : "draft board";
      lastSyncError = null;

      for (const pick of picks) {
        const info = SyncCore.parseSleeperPick(pick);
        if (!info) continue;

        const sourceText = [
          info.name,
          info.pos,
          info.team,
          info.pickNumber ? `Pick ${info.pickNumber}` : "",
        ]
          .filter(Boolean)
          .join(" ");
        const matchedPlayers = resolveLoosePlayerMatches(sourceText, info);
        if (!matchedPlayers.length) continue;

        await markPlayersDrafted(matchedPlayers, sourceText, info);

        if (
          SyncCore.sleeperPickBelongsToSlot(
            pick,
            draft,
            configuredDraftSlot
          )
        ) {
          await markPlayersOnMyTeam(matchedPlayers, sourceText);
        }
      }
    } catch (error) {
      adapterMode = "page fallback";
      lastSyncError = String(error?.message || error);
      scanPlatformDraftBoard();
    } finally {
      sleeperApiScanInFlight = false;
      writeDiagnostics(true);
    }
  }

  function getYourTeamMarkers() {
    const rosterLabels = new Set([
      "your team",
      "my team",
      "your roster",
      "my roster",
    ]);

    if (platformInfo.key === "espn") {
      rosterLabels.add("roster");
    }

    return Array.from(
      document.querySelectorAll(
        [
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "div",
          "span",
          "button",
          "[role='heading']",
          "[aria-label]",
        ].join(",")
      )
    ).filter((element) => {
      if (!isElementVisible(element)) {
        return false;
      }

      const text = normalizeText(
        getElementText(element)
      );

      const ariaLabel = normalizeText(
        element.getAttribute(
          "aria-label"
        )
      );

      return (
        rosterLabels.has(text) ||
        rosterLabels.has(ariaLabel)
      );
    });
  }

  function getYourTeamContainers() {
    const containers = new Set();

    getYourTeamMarkers().forEach(
      (marker) => {
        let current = marker;

        for (
          let depth = 0;
          depth < 6 && current;
          depth += 1
        ) {
          const text =
            getElementText(current);

          const descendantCount =
            current.querySelectorAll
              ? current.querySelectorAll(
                  "*"
                ).length
              : 0;

          if (
            text.length >= 15 &&
            text.length <= 5000 &&
            descendantCount <= 900
          ) {
            containers.add(current);
          }

          if (
            current.nextElementSibling
          ) {
            const siblingText =
              getElementText(
                current.nextElementSibling
              );

            if (
              siblingText.length >= 8 &&
              siblingText.length <= 3500
            ) {
              containers.add(
                current.nextElementSibling
              );
            }
          }

          current =
            current.parentElement;
        }
      }
    );

    return Array.from(containers);
  }

  function collectYourTeamMatchesFromElement(
    container,
    matches,
    sourceTexts
  ) {
    const rows =
      container.matches?.(
        "tr, li, [role='row']"
      )
        ? [container]
        : Array.from(
            container.querySelectorAll(
              [
                "tr",
                "li",
                "[role='row']",
                "[role='gridcell']",
                "div",
              ].join(",")
            )
          );

    rows.forEach((row) => {
      if (!isElementVisible(row)) {
        return;
      }

      const text =
        getElementText(row);

      if (
        !text ||
        text.length < 3 ||
        text.length > 340
      ) {
        return;
      }

      if (shouldIgnoreText(text)) {
        return;
      }

      const info = extractDraftedPlayerInfo(text) || {};
      const matchedPlayers = info.name
        ? resolveLoosePlayerMatches(text, info)
        : resolveLoosePlayerMatches(text);

      if (!matchedPlayers.length) {
        return;
      }

      matchedPlayers.forEach(
        (player) => {
          matches.set(
            String(
              player.id ||
                player.name
            ),
            player
          );
        }
      );

      sourceTexts.add(text);
    });
  }

  function collectYourTeamMatchesFromBodyLines(
    matches,
    sourceTexts
  ) {
    const lines = (
      document.body.innerText || ""
    )
      .split("\n")
      .map((line) =>
        line
          .replace(/\s+/g, " ")
          .trim()
      )
      .filter(Boolean);

    const stopLabels = new Set([
      "players",
      "board",
      "results",
      "standings",
      "draft chat",
      "queue",
      "available players",
      "player pool",
    ]);

    const teamLabels = new Set([
      "your team",
      "my team",
      "your roster",
      "my roster",
    ]);

    if (platformInfo.key === "espn") {
      teamLabels.add("roster");
    }

    lines.forEach(
      (line, markerIndex) => {
        if (
          !teamLabels.has(normalizeText(line))
        ) {
          return;
        }

        for (
          let index = markerIndex + 1;
          index <
          Math.min(
            lines.length,
            markerIndex + 80
          );
          index += 1
        ) {
          const normalizedLine =
            normalizeText(
              lines[index]
            );

          if (
            index >
              markerIndex + 2 &&
            stopLabels.has(
              normalizedLine
            )
          ) {
            break;
          }

          const windows = [
            lines[index],

            [
              lines[index],
              lines[index + 1],
            ]
              .filter(Boolean)
              .join(" "),

            [
              lines[index],
              lines[index + 1],
              lines[index + 2],
            ]
              .filter(Boolean)
              .join(" "),

            [
              lines[index],
              lines[index + 1],
              lines[index + 2],
              lines[index + 3],
            ]
              .filter(Boolean)
              .join(" "),
          ];

          const candidate = windows.find((text) => {
            if (extractDraftedPlayerInfo(text)) return true;
            return resolveLoosePlayerMatches(text).length > 0;
          });

          if (!candidate) continue;

          const info = extractDraftedPlayerInfo(candidate) || {};
          const matchedPlayers = info.name
            ? resolveLoosePlayerMatches(candidate, info)
            : resolveLoosePlayerMatches(candidate);

          if (
            !matchedPlayers.length
          ) {
            continue;
          }

          matchedPlayers.forEach(
            (player) => {
              matches.set(
                String(
                  player.id ||
                    player.name
                ),
                player
              );
            }
          );

          sourceTexts.add(candidate);
        }
      }
    );
  }

  function scanYourTeamRows() {
    const now = Date.now();

    if (
      now - lastTeamScanAt < 700
    ) {
      return;
    }

    lastTeamScanAt = now;

    let matches = new Map();
    let sourceTexts = new Set();

    const containerResults =
      getYourTeamContainers()
        .map((container) => {
          const containerMatches =
            new Map();

          const containerSourceTexts =
            new Set();

          collectYourTeamMatchesFromElement(
            container,
            containerMatches,
            containerSourceTexts
          );

          return {
            matches:
              containerMatches,
            sourceTexts:
              containerSourceTexts,
            textLength:
              getElementText(
                container
              ).length,
          };
        })
        .filter(
          (result) =>
            result.matches.size > 0 &&
            result.matches.size <= 24
        )
        .sort((a, b) => {
          if (
            b.matches.size !==
            a.matches.size
          ) {
            return (
              b.matches.size -
              a.matches.size
            );
          }

          return (
            a.textLength -
            b.textLength
          );
        });

    if (containerResults.length) {
      matches =
        containerResults[0].matches;

      sourceTexts =
        containerResults[0]
          .sourceTexts;
    } else {
      collectYourTeamMatchesFromBodyLines(
        matches,
        sourceTexts
      );
    }

    if (!matches.size) return;

    const unseenSourceTexts =
      Array.from(sourceTexts).filter(
        (text) =>
          !SEEN_TEAM_TEXT.has(text)
      );

    if (!unseenSourceTexts.length) {
      return;
    }

    unseenSourceTexts.forEach((text) =>
      SEEN_TEAM_TEXT.add(text)
    );

    markPlayersOnMyTeam(
      Array.from(matches.values()),
      unseenSourceTexts.join(" | ")
    );
  }

  function detectActiveViewFromSelectedTabs() {
    const possibleTabs =
      document.querySelectorAll(
        [
          "[aria-selected='true']",
          "[role='tab']",
          "button",
          "a",
          "li",
        ].join(",")
      );

    let detected = null;

    possibleTabs.forEach(
      (element) => {
        const text = normalizeText(
          getElementText(element)
        );

        const classText = String(
          element.className || ""
        ).toLowerCase();

        const looksSelected =
          element.getAttribute(
            "aria-selected"
          ) === "true" ||
          classText.includes(
            "selected"
          ) ||
          classText.includes(
            "active"
          );

        if (!looksSelected) return;

        if (text === "draft") {
          detected = "draft";
        }

        if (text === "board") {
          detected = "board";
        }

        if (text === "players") {
          detected = "players";
        }

        if (text === "results") {
          detected = "results";
        }
      }
    );

    if (
      detected &&
      detected !== activeView
    ) {
      activeView = detected;

      log(
        `Active ${platformInfo.label} view:`,
        activeView
      );
    }
  }

  function updateActiveYahooViewFromClick(
    event
  ) {
    let current = event.target;

    for (
      let depth = 0;
      depth < 5 && current;
      depth += 1
    ) {
      const text = normalizeText(
        getElementText(current)
      );

      if (text === "draft") {
        activeView = "draft";
      }

      if (text === "board") {
        activeView = "board";
      }

      if (text === "players") {
        activeView = "players";
      }

      if (text === "results") {
        activeView = "results";
      }

      current =
        current.parentElement;
    }

    if (
      [
        "draft",
        "board",
        "players",
        "results",
      ].includes(activeView)
    ) {
      log(
        `Active ${platformInfo.label} view:`,
        activeView
      );

      setTimeout(
        runDraftSyncScan,
        300
      );

      setTimeout(
        runDraftSyncScan,
        1000
      );

      setTimeout(
        runDraftSyncScan,
        2000
      );
    }
  }

  function detectActiveViewFromPageText() {
    const bodyText =
      document.body.innerText || "";

    const lower =
      bodyText.toLowerCase();

    if (
      lower.includes(
        "players board results standings"
      )
    ) {
      if (
        activeView !==
          "results" &&
        lower.includes("last:")
      ) {
        activeView =
          "results";

        log(
          `Active ${platformInfo.label} view:`,
          activeView
        );
      }
    }
  }

  function runDraftSyncScan() {
    if (platformInfo.key === "yahoo") {
      scanYahooLeagueSettings();
      detectActiveViewFromSelectedTabs();
      detectActiveViewFromPageText();
      scanLastPickFromBodyLines();
      scanYourTeamRows();

      if (activeView === "results" || activeView === "board") {
        scanDraftRows();
      }
    } else if (platformInfo.key === "espn") {
      detectActiveViewFromSelectedTabs();
      scanPlatformDraftBoard();
      scanYourTeamRows();

      if (activeView === "unknown" && getRawDraftId()) {
        activeView = "draft room";
      }
    } else if (platformInfo.key === "sleeper") {
      scanSleeperApi();
      scanPlatformDraftBoard();
      scanYourTeamRows();

      if (activeView === "unknown" && getRawDraftId()) {
        activeView = "draft room";
      }
    } else {
      activeView = "unsupported";
    }

    writeDiagnostics();
  }

  async function startDraftSyncObserver() {
    loadBundledPlayers();

    await resetDraftedIfNewDraftSession();
    await loadDraftedMemory();
    await loadMyTeamMemory();
    await loadLeagueSettings();

    if (platformInfo.key === "yahoo") {
      await scanYahooLeagueSettings(true);
    }

    await writeDiagnostics(true);

    loadRemotePlayers();

    chrome.storage.onChanged.addListener(
      (changes, area) => {
        if (area !== "local") return;

        if (
          changes[
            STORAGE_KEY_DRAFTED
          ]
        ) {
          draftedIdsMemory =
            new Set(
              changes[
                STORAGE_KEY_DRAFTED
              ].newValue || []
            );
        }

        if (
          changes[
            STORAGE_KEY_MY_TEAM
          ]
        ) {
          myTeamIdsMemory =
            new Set(
              changes[
                STORAGE_KEY_MY_TEAM
              ].newValue || []
            );
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
            remoteData &&
            Array.isArray(
              remoteData.players
            )
          ) {
            draftPlayers =
              remoteData.players;

            log(
              "Remote player data refreshed:",
              draftPlayers.length
            );

            runDraftSyncScan();
          }
        }

        if (changes[STORAGE_KEY_LEAGUE_SETTINGS]) {
          const saved =
            changes[STORAGE_KEY_LEAGUE_SETTINGS].newValue || {};
          applyLeagueSettingsMemory(saved);
          runDraftSyncScan();
        }
      }
    );

    document.addEventListener(
      "click",
      updateActiveYahooViewFromClick,
      true
    );

    const observer =
      new MutationObserver(() => {
        runDraftSyncScan();
      });

    observer.observe(
      document.body,
      {
        childList: true,
        subtree: true,
        characterData: true,
      }
    );

    log(
      "Live draft sync started."
    );

    setTimeout(
      runDraftSyncScan,
      1000
    );

    setTimeout(
      runDraftSyncScan,
      3000
    );

    setTimeout(
      runDraftSyncScan,
      6000
    );

    setInterval(
      runDraftSyncScan,
      1000
    );

    setInterval(
      resetDraftedIfNewDraftSession,
      3000
    );
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      startDraftSyncObserver
    );
  } else {
    startDraftSyncObserver();
  }
})();
