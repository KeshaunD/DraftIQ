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

  function parseYahooBoardPick(text, teamCount = 12) {
    const cleaned = String(text || "")
      .replace(/\s+/g, " ")
      .trim();
    const teams = Number(teamCount);

    if (
      !cleaned ||
      !Number.isInteger(teams) ||
      teams < 2 ||
      teams > 20
    ) {
      return null;
    }

    const match = cleaned.match(
      /^([A-Z][A-Za-z.â€™'\-]*(?:\s+[A-Z][A-Za-z.â€™'\-]*){0,5})\s+(QB|RB|WR|TE|K|PK|DEF|DST)\s+\S{1,3}\s+([A-Za-z]{2,3})\s+(\d{1,2})\.(\d{1,2})$/i
    );

    if (!match) return null;

    const round = Number(match[4]);
    const roundPick = Number(match[5]);

    if (
      !Number.isInteger(round) ||
      round < 1 ||
      !Number.isInteger(roundPick) ||
      roundPick < 1 ||
      roundPick > teams
    ) {
      return null;
    }

    return {
      name: match[1],
      pos: normalizePosition(match[2]),
      team: normalizeTeam(match[3]),
      pickNumber: (round - 1) * teams + roundPick,
      round,
      roundPick,
      sourceType: "yahoo-board-card",
    };
  }

  function parseYahooCurrentPick(text, teamCount = 12) {
    const cleaned = String(text || "")
      .replace(/\s+/g, " ")
      .trim();
    const teams = Number(teamCount);

    if (!cleaned) return null;

    const headerMatch = cleaned.match(
      /\bRound\s+(\d{1,2})\s*,?\s*Pick\s+(\d{1,3})\b/i
    );

    if (headerMatch) {
      const round = Number(headerMatch[1]);
      const overall = Number(headerMatch[2]);

      if (round >= 1 && overall >= 1) {
        return {
          overall,
          round,
          roundPick:
            Number.isInteger(teams) && teams >= 2
              ? ((overall - 1) % teams) + 1
              : null,
          sourceType: "yahoo-draft-header",
        };
      }
    }

    const onClockMatch = cleaned.match(
      /\bON\s+THE\s+CLOCK\s+(\d{1,2})\.(\d{1,2})\b/i
    );

    if (!onClockMatch || !Number.isInteger(teams) || teams < 2) {
      return null;
    }

    const round = Number(onClockMatch[1]);
    const roundPick = Number(onClockMatch[2]);

    if (round < 1 || roundPick < 1 || roundPick > teams) {
      return null;
    }

    return {
      overall: (round - 1) * teams + roundPick,
      round,
      roundPick,
      sourceType: "yahoo-on-clock-cell",
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

  function getSnakeDraftSlot(overallPick, teamCount) {
    const pick = Number(overallPick);
    const teams = Number(teamCount);

    if (
      !Number.isInteger(pick) ||
      pick < 1 ||
      !Number.isInteger(teams) ||
      teams < 2
    ) {
      return null;
    }

    const round = Math.ceil(pick / teams);
    const positionInRound = ((pick - 1) % teams) + 1;

    return round % 2 === 1
      ? positionInRound
      : teams - positionInRound + 1;
  }

  function parseYahooLeagueSettings(text) {
    const value = String(text || "").replace(/\u00a0/g, " ");
    const compact = value.replace(/\s+/g, " ").trim();
    const settings = {};
    const detectedFields = [];
    const setDetected = (key, detectedValue) => {
      if (detectedValue === undefined || detectedValue === null) return;
      settings[key] = detectedValue;
      detectedFields.push(key);
    };

    const teamMatch =
      compact.match(/\b(\d{1,2})\s*-\s*team(?:s)?\b/i) ||
      compact.match(/\b(\d{1,2})\s+team(?:s)?\s+league\b/i) ||
      compact.match(
        /\b(?:number\s+of\s+teams|league\s+teams)\s*:?\s*(\d{1,2})\b/i
      ) ||
      compact.match(/\bteams\s*:\s*(\d{1,2})\b/i);

    /*
     * Yahoo's board renders every slot as a standalone round.pick label.
     * This is a useful live-draft fallback when the league size is no longer
     * written out, but only accept a complete run (1.1 through 1.N, etc.) so
     * ordinary decimal stats and ADP values cannot be mistaken for slots.
     */
    const pickSlotsByRound = new Map();
    const pickLabelPattern =
      /(?:^|[\r\n\t])\s*(\d{1,2})\.(\d{1,2})\s*(?=$|[\r\n\t])/g;
    let pickLabelMatch;

    while ((pickLabelMatch = pickLabelPattern.exec(value))) {
      const round = Number(pickLabelMatch[1]);
      const slot = Number(pickLabelMatch[2]);

      if (
        round < 1 ||
        round > 40 ||
        slot < 1 ||
        slot > 20
      ) {
        continue;
      }

      if (!pickSlotsByRound.has(round)) {
        pickSlotsByRound.set(round, new Set());
      }

      pickSlotsByRound.get(round).add(slot);
    }

    const inferredTeamCounts = Array.from(pickSlotsByRound.values())
      .map((slots) => ({ slots, maximum: Math.max(...slots) }))
      .filter(
        ({ slots, maximum }) =>
          maximum >= 4 &&
          maximum <= 20 &&
          Array.from(
            { length: maximum },
            (_, index) => index + 1
          ).every((slot) => slots.has(slot))
      )
      .map(({ maximum }) => maximum);
    const inferredTeamCount = inferredTeamCounts.length
      ? Math.max(...inferredTeamCounts)
      : null;
    const teamCount = Number(teamMatch?.[1] || inferredTeamCount);

    if (Number.isInteger(teamCount) && teamCount >= 2 && teamCount <= 20) {
      setDetected("teamCount", teamCount);
    }

    const slotMatch =
      compact.match(
        /\b(?:your\s+(?:draft\s+)?(?:position|slot|pick)|you(?:'re|\s+are)\s+drafting(?:\s+from)?(?:\s+(?:position|slot))?)\s*:?\s*#?\s*(\d{1,2})(?:st|nd|rd|th)?\b/i
      ) ||
      compact.match(
        /\byou\s+will\s+draft\s+(?:from\s+)?(?:position\s+|slot\s+)?#?\s*(\d{1,2})(?:st|nd|rd|th)\b/i
      );
    const draftSlot = Number(slotMatch?.[1]);
    const slotLimit = settings.teamCount || 20;

    if (
      Number.isInteger(draftSlot) &&
      draftSlot >= 1 &&
      draftSlot <= slotLimit
    ) {
      setDetected("draftSlot", draftSlot);
    }

    if (
      /\b(?:half[\s-]*ppr|0\.5\s*(?:ppr|points?\s+per\s+reception))\b/i.test(
        compact
      )
    ) {
      setDetected("scoring", "half-ppr");
    } else if (
      /\b(?:full[\s-]*ppr|ppr\s+scoring|scoring\s*:?\s*ppr|1(?:\.0)?\s+points?\s+per\s+reception)\b/i.test(
        compact
      )
    ) {
      setDetected("scoring", "ppr");
    } else if (
      /\b(?:standard\s+scoring|scoring\s*:?\s*standard|non[\s-]*ppr|0\s+(?:ppr|points?\s+per\s+reception))\b/i.test(
        compact
      )
    ) {
      setDetected("scoring", "standard");
    }

    const rosterAnchor = value.match(
      /(?:roster\s+positions?|starting\s+roster|roster\s+requirements?)/i
    );

    if (rosterAnchor && rosterAnchor.index !== undefined) {
      const rosterText = value.slice(
        rosterAnchor.index + rosterAnchor[0].length,
        rosterAnchor.index + rosterAnchor[0].length + 600
      );
      const rosterPatterns = {
        qb: /\bQB\s*(?:[:=x-]\s*)?(\d{1,2})\b/i,
        rb: /\bRB\s*(?:[:=x-]\s*)?(\d{1,2})\b/i,
        wr: /\bWR\s*(?:[:=x-]\s*)?(\d{1,2})\b/i,
        te: /\bTE\s*(?:[:=x-]\s*)?(\d{1,2})\b/i,
        flex:
          /\b(?:FLEX|W\s*\/\s*R\s*\/\s*T|WRT)\s*(?:[:=x-]\s*)?(\d{1,2})\b/i,
        bench: /\b(?:BN|BENCH)\s*(?:[:=x-]\s*)?(\d{1,2})\b/i,
      };
      const roster = {};

      Object.entries(rosterPatterns).forEach(([key, pattern]) => {
        const match = rosterText.match(pattern);
        const count = Number(match?.[1]);

        if (Number.isInteger(count) && count >= 0 && count <= 20) {
          roster[key] = count;
        }
      });

      const detectedStarterFields = ["qb", "rb", "wr", "te", "flex"].filter(
        (key) => roster[key] !== undefined
      );

      if (detectedStarterFields.length < 3) {
        const positionTokens = rosterText.toUpperCase().match(
          /Q\s*\/\s*W\s*\/\s*R\s*\/\s*T|W\s*\/\s*R\s*\/\s*T|WRT|FLEX|BENCH|BN|QB|RB|WR|TE/g
        );

        if (positionTokens && positionTokens.length >= 4) {
          const tokenCounts = {
            qb: 0,
            rb: 0,
            wr: 0,
            te: 0,
            flex: 0,
            bench: 0,
          };

          positionTokens.forEach((token) => {
            const normalized = token.replace(/\s/g, "");

            if (normalized === "QB") tokenCounts.qb += 1;
            else if (normalized === "RB") tokenCounts.rb += 1;
            else if (normalized === "WR") tokenCounts.wr += 1;
            else if (normalized === "TE") tokenCounts.te += 1;
            else if (normalized === "BN" || normalized === "BENCH") {
              tokenCounts.bench += 1;
            } else {
              tokenCounts.flex += 1;
            }
          });

          Object.assign(roster, tokenCounts);
        }
      }

      const confidentRosterFields = ["qb", "rb", "wr", "te", "flex"].filter(
        (key) => roster[key] !== undefined
      );

      if (confidentRosterFields.length >= 3) {
        Object.entries(roster).forEach(([key, count]) => {
          setDetected(key, count);
        });
      }
    }

    return {
      settings,
      detectedFields,
      confidence:
        detectedFields.length >= 4
          ? "high"
          : detectedFields.length >= 1
            ? "partial"
            : "none",
    };
  }

  return {
    detectPlatform,
    extractPlayerInfo,
    getSnakeDraftSlot,
    getDraftSessionId,
    getRawDraftId,
    normalizePosition,
    normalizeTeam,
    normalizeText,
    parseSleeperPick,
    parseYahooBoardPick,
    parseYahooCurrentPick,
    parseYahooLeagueSettings,
    sleeperPickBelongsToSlot,
  };
});
