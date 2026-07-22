(function () {
  if (window.__DRAFTIQ_DRAFT_SYNC_STARTED__) return;
  window.__DRAFTIQ_DRAFT_SYNC_STARTED__ = true;

  const STORAGE_KEY_DRAFTED = "draftCopilotDrafted";
  const STORAGE_KEY_REMOTE_DATA = "draftCopilotRemoteData";
  const STORAGE_KEY_CURRENT_DRAFT_ID = "draftCopilotCurrentDraftId";

  const SEEN_TEXT = new Set();

  let draftPlayers = [];
  let draftedIdsMemory = new Set();
  let activeYahooView = "unknown";

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
    WSH: "WAS"
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
    zach: ["zachary"]
  };

  function log(...args) {
    console.log("[DraftIQ Sync]", ...args);
  }

  function getYahooDraftSessionId() {
    const draftClientMatch = window.location.pathname.match(
      /\/draftclient\/f1\/(\d+)\/(\d+)/
    );

    if (draftClientMatch) {
      return `${draftClientMatch[1]}-${draftClientMatch[2]}`;
    }

    const mockLeagueId = new URLSearchParams(window.location.search).get("mlid");

    if (mockLeagueId) {
      return `mock-${mockLeagueId}`;
    }

    return null;
  }

  async function resetDraftedIfNewDraftSession() {
    const draftSessionId = getYahooDraftSessionId();

    if (!draftSessionId) return;

    const current = await chrome.storage.local.get([STORAGE_KEY_CURRENT_DRAFT_ID]);
    const savedDraftSessionId = current[STORAGE_KEY_CURRENT_DRAFT_ID];

    if (savedDraftSessionId === draftSessionId) return;

    SEEN_TEXT.clear();
    draftedIdsMemory = new Set();

    await chrome.storage.local.set({
  [STORAGE_KEY_CURRENT_DRAFT_ID]: draftSessionId,
  [STORAGE_KEY_DRAFTED]: [],
});

if (window.DraftIQMockHistory && window.DraftIQMockHistory.startDraft) {
  await window.DraftIQMockHistory.startDraft(draftSessionId, {
    source: "yahoo",
  });
}

log("New Yahoo draft detected. Cleared drafted players:", draftSessionId);
  }

  async function loadDraftedMemory() {
    const current = await chrome.storage.local.get([STORAGE_KEY_DRAFTED]);
    draftedIdsMemory = new Set(current[STORAGE_KEY_DRAFTED] || []);
  }

  function loadBundledPlayers() {
    try {
      if (Array.isArray(DRAFT_COPILOT_PLAYERS)) {
        draftPlayers = DRAFT_COPILOT_PLAYERS;
      }
    } catch (error) {
      draftPlayers = [];
    }
  }

  function loadRemotePlayers() {
    chrome.storage.local.get([STORAGE_KEY_REMOTE_DATA], (res) => {
      const remoteData = res[STORAGE_KEY_REMOTE_DATA];

      if (remoteData && Array.isArray(remoteData.players)) {
        draftPlayers = remoteData.players;
        log("Loaded remote player data:", draftPlayers.length);
      } else {
        log("Loaded bundled player data:", draftPlayers.length);
      }

      runDraftSyncScan();
    });
  }

  function normalizeText(value) {
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

  function normalizeTeam(value) {
    const raw = String(value || "")
      .toUpperCase()
      .replace(/[^A-Z]/g, "");

    return TEAM_MAP[raw] || raw;
  }

  function normalizePosition(value) {
    const pos = String(value || "").toUpperCase();

    if (pos === "DST") return "DEF";
    return pos;
  }

  function getPlayerKeys(player) {
    const keys = new Set();

    if (player.id) keys.add(String(player.id));
    if (player.name) keys.add(String(player.name));
    if (player.name) keys.add(normalizeText(player.name));

    return Array.from(keys).filter(Boolean);
  }

  function addAliasSet(aliases, firstName, lastPartsList) {
    if (!firstName) return;

    lastPartsList.forEach((lastPart) => {
      if (!lastPart) return;

      aliases.add(`${firstName} ${lastPart}`);
      aliases.add(`${firstName[0]} ${lastPart}`);
    });
  }

  function getPlayerAliases(player) {
    const aliases = new Set();

    const name = player.name || "";
    const normalized = normalizeText(name);
    const parts = normalized.split(" ").filter(Boolean);

    if (normalized) aliases.add(normalized);

    if (parts.length >= 2) {
      const first = parts[0];
      const last = parts[parts.length - 1];
      const lastParts = parts.slice(1).join(" ");
      const lastTwoParts = parts.slice(-2).join(" ");
      const lastThreeParts = parts.slice(-3).join(" ");

      const lastPartsList = Array.from(
        new Set([last, lastParts, lastTwoParts, lastThreeParts].filter(Boolean))
      );

      addAliasSet(aliases, first, lastPartsList);

      const twoPartFirstName = parts.slice(0, 2).join(" ");
      const twoPartFirstNameAliases = FIRST_NAME_ALIASES[twoPartFirstName] || [];

      twoPartFirstNameAliases.forEach((aliasFirstName) => {
        addAliasSet(aliases, aliasFirstName, lastPartsList);
      });

      const firstNameAliases = FIRST_NAME_ALIASES[first] || [];

      firstNameAliases.forEach((aliasFirstName) => {
        addAliasSet(aliases, aliasFirstName, lastPartsList);
      });
    }

    return Array.from(aliases).filter(Boolean);
  }

  function textMatchesPlayer(text, player) {
    const normalizedText = ` ${normalizeText(text)} `;
    const aliases = getPlayerAliases(player);

    return aliases.some((alias) => normalizedText.includes(` ${alias} `));
  }

  function getPlayerRankNumber(player) {
    const rank = Number(player.rank);
    const adp = Number(player.adp);

    if (!Number.isNaN(rank)) return rank;
    if (!Number.isNaN(adp)) return adp;

    return null;
  }

  function extractDraftedPlayerInfo(text) {
    const cleaned = String(text || "").replace(/\s+/g, " ").trim();

    if (!cleaned) return null;

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

    const lastPickMatch = cleaned.match(lastPickRegex);

    if (lastPickMatch) {
      return {
        name: lastPickMatch[1],
        pos: normalizePosition(lastPickMatch[2]),
        team: normalizeTeam(lastPickMatch[3]),
        pickNumber: null,
        sourceType: "last-pick"
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

    const rowMatch = cleaned.match(rowRegex);

    if (rowMatch) {
      return {
        name: rowMatch[1],
        pos: normalizePosition(rowMatch[2]),
        team: normalizeTeam(rowMatch[3]),
        pickNumber: rowMatch[4] ? Number(rowMatch[4]) : null,
        sourceType: "draft-row"
      };
    }

    return null;
  }

  function resolvePlayerMatches(text) {
    const info = extractDraftedPlayerInfo(text);

    if (!info) return [];

    let matches = draftPlayers.filter((player) => textMatchesPlayer(info.name, player));

    if (!matches.length) {
      matches = draftPlayers.filter((player) => textMatchesPlayer(text, player));
    }

    if (!matches.length) return [];

    if (info.pos) {
      const posMatches = matches.filter((player) => {
        return normalizePosition(player.pos) === info.pos;
      });

      if (posMatches.length) {
        matches = posMatches;
      }
    }

    if (info.team) {
      const teamMatches = matches.filter((player) => {
        return normalizeTeam(player.team) === info.team;
      });

      if (teamMatches.length) {
        matches = teamMatches;
      }
    }

    if (matches.length > 1 && info.pickNumber) {
      const rankedMatches = matches
        .map((player) => {
          const rankNumber = getPlayerRankNumber(player);

          return {
            player,
            distance:
              rankNumber === null
                ? Number.MAX_SAFE_INTEGER
                : Math.abs(rankNumber - info.pickNumber),
          };
        })
        .sort((a, b) => a.distance - b.distance);

      if (rankedMatches.length) {
        matches = [rankedMatches[0].player];
      }
    }

    if (matches.length > 1) {
      const rankedMatches = matches
        .map((player) => {
          const rankNumber = getPlayerRankNumber(player);

          return {
            player,
            rankNumber:
              rankNumber === null
                ? Number.MAX_SAFE_INTEGER
                : rankNumber,
          };
        })
        .sort((a, b) => a.rankNumber - b.rankNumber);

      const selectedPlayer = rankedMatches[0].player;

      log(
        "Ambiguous match resolved by rank:",
        text,
        "=>",
        selectedPlayer.name,
        "from",
        matches.map((p) => p.name).join(", ")
      );

      matches = [selectedPlayer];
    }

    return matches;
  }

  async function markPlayersDrafted(players, sourceText, draftInfo = {}) {
    if (!players.length) return;

    const newlyDrafted = [];

    players.forEach((player) => {
      const keys = getPlayerKeys(player);
      const alreadyDrafted = keys.some((key) => draftedIdsMemory.has(key));

      if (!alreadyDrafted) {
        keys.forEach((key) => draftedIdsMemory.add(key));
        newlyDrafted.push(player);
      }
    });

    if (window.DraftIQMockHistory && window.DraftIQMockHistory.recordPick) {
  const draftSessionId = getYahooDraftSessionId();

  for (const player of players) {
    await window.DraftIQMockHistory.recordPick({
      draftId: draftSessionId,
      source: "yahoo",
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

if (!newlyDrafted.length) return;

await chrome.storage.local.set({
  [STORAGE_KEY_DRAFTED]: Array.from(draftedIdsMemory),
});

    newlyDrafted.forEach((player) => {
      log("Marked drafted:", player.name);
    });

    log("Draft event text:", sourceText);
  }

  function shouldIgnoreText(text) {
    const lower = String(text || "").toLowerCase();

    if (!lower) return true;
    if (lower.includes("will appear here")) return true;
    if (lower.includes("draftiq")) return true;
    if (lower.includes("click player to open profile")) return true;
    if (lower.includes("add queue")) return true;
    if (lower.includes("remove queue")) return true;
    if (lower.includes("rank player team bye")) return true;
    if (lower.includes("players adp proj")) return true;
    if (lower.includes("projected points") && lower.includes("pre-season")) return true;
    if (lower.length > 900) return true;

    return false;
  }

  function processDraftText(text, source = "unknown") {
    const cleaned = String(text || "").replace(/\s+/g, " ").trim();

    if (shouldIgnoreText(cleaned)) return;
    if (SEEN_TEXT.has(cleaned)) return;

    const info = extractDraftedPlayerInfo(cleaned);

    if (!info) return;

    const matchedPlayers = resolvePlayerMatches(cleaned);

    SEEN_TEXT.add(cleaned);

    if (!matchedPlayers.length) return;

    log(`Matched ${matchedPlayers.length} player(s) from ${source}:`, cleaned);
    markPlayersDrafted(matchedPlayers, cleaned, info);
  }

  function isElementVisible(element) {
    if (!element || !element.getBoundingClientRect) return false;

    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0"
    );
  }

  function getElementText(element) {
    return (element.innerText || element.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function scanLastPickFromBodyLines() {
    const lines = (document.body.innerText || "")
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    lines.forEach((line, index) => {
      if (line.toLowerCase() !== "last:") return;

      const combined = [
        lines[index],
        lines[index + 1],
        lines[index + 2],
        lines[index + 3],
      ]
        .filter(Boolean)
        .join(" ");

      processDraftText(combined, "last-pick-lines");
    });
  }

  function scanDraftRows() {
    const elements = document.querySelectorAll(
      [
        "tr",
        "li",
        "[role='row']",
        "[role='gridcell']",
        "td",
        "div",
        "span"
      ].join(",")
    );

    elements.forEach((element) => {
      if (!isElementVisible(element)) return;

      const text = getElementText(element);

      if (!text || shouldIgnoreText(text)) return;
      if (text.length < 3 || text.length > 500) return;

      if (!extractDraftedPlayerInfo(text)) return;

      processDraftText(text, "draft-row");
    });
  }

  function detectActiveViewFromSelectedTabs() {
    const possibleTabs = document.querySelectorAll(
      [
        "[aria-selected='true']",
        "[role='tab']",
        "button",
        "a",
        "li"
      ].join(",")
    );

    let detected = null;

    possibleTabs.forEach((element) => {
      const text = normalizeText(getElementText(element));
      const classText = String(element.className || "").toLowerCase();

      const looksSelected =
        element.getAttribute("aria-selected") === "true" ||
        classText.includes("selected") ||
        classText.includes("active");

      if (!looksSelected) return;

      if (text === "draft") detected = "draft";
      if (text === "board") detected = "board";
      if (text === "players") detected = "players";
      if (text === "results") detected = "results";
    });

    if (detected && detected !== activeYahooView) {
      activeYahooView = detected;
      log("Active Yahoo view:", activeYahooView);
    }
  }

  function updateActiveYahooViewFromClick(event) {
    let current = event.target;

    for (let depth = 0; depth < 5 && current; depth += 1) {
      const text = normalizeText(getElementText(current));

      if (text === "draft") activeYahooView = "draft";
      if (text === "board") activeYahooView = "board";
      if (text === "players") activeYahooView = "players";
      if (text === "results") activeYahooView = "results";

      current = current.parentElement;
    }

    if (["draft", "board", "players", "results"].includes(activeYahooView)) {
      log("Active Yahoo view:", activeYahooView);

      setTimeout(runDraftSyncScan, 300);
      setTimeout(runDraftSyncScan, 1000);
      setTimeout(runDraftSyncScan, 2000);
    }
  }

  function detectActiveViewFromPageText() {
    const bodyText = document.body.innerText || "";
    const lower = bodyText.toLowerCase();

    if (lower.includes("players board results standings")) {
      if (activeYahooView !== "results" && lower.includes("last:")) {
        activeYahooView = "results";
        log("Active Yahoo view:", activeYahooView);
      }
    }
  }

  function runDraftSyncScan() {
    detectActiveViewFromSelectedTabs();
    detectActiveViewFromPageText();

    scanLastPickFromBodyLines();

    if (activeYahooView === "results" || activeYahooView === "board") {
      scanDraftRows();
    }
  }

  async function startDraftSyncObserver() {
    loadBundledPlayers();

    await resetDraftedIfNewDraftSession();
    await loadDraftedMemory();

    loadRemotePlayers();

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;

      if (changes[STORAGE_KEY_DRAFTED]) {
        draftedIdsMemory = new Set(changes[STORAGE_KEY_DRAFTED].newValue || []);
      }

      if (changes[STORAGE_KEY_REMOTE_DATA]) {
        const remoteData = changes[STORAGE_KEY_REMOTE_DATA].newValue;

        if (remoteData && Array.isArray(remoteData.players)) {
          draftPlayers = remoteData.players;
          log("Remote player data refreshed:", draftPlayers.length);
          runDraftSyncScan();
        }
      }
    });

    document.addEventListener("click", updateActiveYahooViewFromClick, true);

    const observer = new MutationObserver(() => {
      runDraftSyncScan();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    log("Live draft sync started.");

    setTimeout(runDraftSyncScan, 1000);
    setTimeout(runDraftSyncScan, 3000);
    setTimeout(runDraftSyncScan, 6000);

    setInterval(runDraftSyncScan, 1000);
    setInterval(resetDraftedIfNewDraftSession, 3000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startDraftSyncObserver);
  } else {
    startDraftSyncObserver();
  }
})();