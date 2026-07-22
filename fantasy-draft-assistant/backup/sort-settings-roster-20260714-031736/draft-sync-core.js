(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.DraftIQSyncCore = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
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
    JAC: "JAX",
    JAX: "JAX",
    KC: "KC",
    KAN: "KC",
    LAC: "LAC",
    LAR: "LAR",
    LV: "LV",
    MIA: "MIA",
    MIN: "MIN",
    NE: "NE",
    NO: "NO",
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

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[.’']/g, "")
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
    const position = String(value || "").toUpperCase();

    if (position === "DST") return "DEF";
    if (position === "PK") return "K";

    return position;
  }

  function detectPlatform(hostname) {
    const host = String(hostname || "").toLowerCase();

    if (host.includes("fantasysports.yahoo.com")) {
      return { key: "yahoo", label: "Yahoo", supported: true, adapter: "page" };
    }

    if (host.includes("espn.com")) {
      return { key: "espn", label: "ESPN", supported: true, adapter: "page" };
    }

    if (host.includes("sleeper.com") || host.includes("sleeper.app")) {
      return { key: "sleeper", label: "Sleeper", supported: true, adapter: "api" };
    }

    if (host.includes("nfl.com")) {
      return { key: "nfl", label: "NFL.com", supported: false, adapter: "none" };
    }

    return {
      key: "unknown",
      label: host || "Unknown",
      supported: false,
      adapter: "none",
    };
  }

  function getSearchValue(search, names) {
    const query = String(search || "").replace(/^\?/, "");
    const params = new URLSearchParams(query);

    for (const name of names) {
      const value = params.get(name);
      if (value) return value;
    }

    return null;
  }

  function getRawDraftId(locationLike, platformKey) {
    const pathname = String(locationLike?.pathname || "");
    const search = String(locationLike?.search || "");
    const hash = String(locationLike?.hash || "");

    if (platformKey === "yahoo") {
      const match = pathname.match(/\/draftclient\/f1\/(\d+)\/(\d+)/i);
      if (match) return `${match[1]}-${match[2]}`;

      const mockId = getSearchValue(search, ["mlid"]);
      return mockId ? `mock-${mockId}` : null;
    }

    if (platformKey === "espn") {
      const queryId = getSearchValue(search, ["leagueId", "league_id"]);
      const pathId = pathname.match(/\/league(?:Id)?\/(\d{4,})/i)?.[1];
      return queryId || pathId || null;
    }

    if (platformKey === "sleeper") {
      const route = `${pathname}${hash}`;
      const routeId = route.match(
        /\/(?:draft|draftboard|draftboards)(?:\/nfl)?\/(\d{6,})/i
      )?.[1];
      const queryId = getSearchValue(search, ["draft_id", "draftId"]);
      return routeId || queryId || null;
    }

    return null;
  }

  function getDraftSessionId(locationLike, platformKey) {
    const rawId = getRawDraftId(locationLike, platformKey);
    if (!rawId) return null;

    // Preserve Yahoo's original session IDs so an extension update does not
    // clear an in-progress Yahoo board simply because the format changed.
    return platformKey === "yahoo" ? rawId : `${platformKey}-${rawId}`;
  }

  function extractPickNumber(text) {
    const value = String(text || "");
    const explicit = value.match(/\b(?:pick|overall)\s*#?\s*(\d{1,3})\b/i);
    if (explicit) return Number(explicit[1]);

    const leading = value.match(/^\s*(\d{1,2})[.)-](\d{1,2})\b/);
    return leading ? null : null;
  }

  function extractPlayerInfo(text, platformKey = "unknown") {
    const cleaned = String(text || "").replace(/\s+/g, " ").trim();
    if (!cleaned) return null;

    const position = "(QB|RB|WR|TE|K|PK|DEF|DST)";
    const team = "([A-Z]{2,3})";
    const name =
      "([A-Z][A-Za-z.’'\\-]*(?:\\s+[A-Z][A-Za-z.’'\\-]*){1,4}(?:\\s+(?:Jr\\.?|Sr\\.?|II|III|IV|V))?)";
    const patterns = [
      {
        regex: new RegExp(`${name}\\s*\\(\\s*${position}\\s*[·|/\\-]\\s*${team}\\s*\\)`, "i"),
        fields: ["name", "pos", "team"],
      },
      {
        regex: new RegExp(`${name}\\s+${position}\\s*(?:[·|/,\\-]\\s*)?${team}\\b`, "i"),
        fields: ["name", "pos", "team"],
      },
      {
        regex: new RegExp(`${name}\\s+${team}\\s*(?:[·|/,\\-]\\s*)?${position}\\b`, "i"),
        fields: ["name", "team", "pos"],
      },
      {
        regex: new RegExp(`(?:^|\\s)${team}\\s+${position}\\s+${name}(?:\\s|$)`, "i"),
        fields: ["team", "pos", "name"],
      },
    ];

    for (const pattern of patterns) {
      const match = cleaned.match(pattern.regex);
      if (!match) continue;

      const values = {};
      pattern.fields.forEach((field, index) => {
        values[field] = match[index + 1];
      });

      return {
        name: values.name,
        pos: normalizePosition(values.pos),
        team: normalizeTeam(values.team),
        pickNumber: extractPickNumber(cleaned),
        sourceType: `${platformKey}-pick`,
      };
    }

    return null;
  }

  function parseSleeperPick(pick) {
    if (!pick || typeof pick !== "object") return null;

    const metadata = pick.metadata || {};
    const name =
      metadata.full_name ||
      [metadata.first_name, metadata.last_name].filter(Boolean).join(" ");

    if (!name) return null;

    return {
      name,
      pos: normalizePosition(metadata.position),
      team: normalizeTeam(metadata.team),
      pickNumber: Number(pick.pick_no) || null,
      playerId: pick.player_id ? String(pick.player_id) : null,
      pickedBy: pick.picked_by ? String(pick.picked_by) : null,
      rosterId: pick.roster_id != null ? String(pick.roster_id) : null,
      draftSlot: Number(pick.draft_slot) || null,
      sourceType: "sleeper-api",
    };
  }

  function sleeperPickBelongsToSlot(pick, draft, configuredSlot) {
    const slot = Number(configuredSlot);
    if (!Number.isInteger(slot) || slot < 1 || !pick) return false;

    const expectedRosterId = draft?.slot_to_roster_id?.[String(slot)];
    if (expectedRosterId != null && pick.roster_id != null) {
      return String(pick.roster_id) === String(expectedRosterId);
    }

    return Number(pick.draft_slot) === slot;
  }

  return {
    detectPlatform,
    extractPlayerInfo,
    getDraftSessionId,
    getRawDraftId,
    normalizePosition,
    normalizeTeam,
    normalizeText,
    parseSleeperPick,
    sleeperPickBelongsToSlot,
  };
});
