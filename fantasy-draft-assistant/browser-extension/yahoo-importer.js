(function () {
  if (window.__DRAFTIQ_YAHOO_IMPORTER_STARTED__) return;

  const hostname = window.location.hostname.toLowerCase();

  if (
    hostname !== "fantasysports.yahoo.com" &&
    !hostname.endsWith(".fantasysports.yahoo.com")
  ) {
    return;
  }

  window.__DRAFTIQ_YAHOO_IMPORTER_STARTED__ = true;

  const STORAGE_KEY_YAHOO_LEAGUE =
    "draftCopilotYahooLeague";

  const STORAGE_KEY_IMPORT_STATUS =
    "draftCopilotYahooImportStatus";

  const STORAGE_KEY_IMPORT_META =
    "draftCopilotYahooImportMeta";

  const AUTO_IMPORT_INTERVAL_MS =
    10 * 60 * 1000;

  const URL_CHECK_INTERVAL_MS = 5000;

  const NFL_TEAMS = new Set([
    "ARI",
    "ATL",
    "BAL",
    "BUF",
    "CAR",
    "CHI",
    "CIN",
    "CLE",
    "DAL",
    "DEN",
    "DET",
    "GB",
    "GNB",
    "HOU",
    "IND",
    "JAX",
    "JAC",
    "KC",
    "KAN",
    "LAC",
    "SD",
    "LAR",
    "STL",
    "LV",
    "OAK",
    "MIA",
    "MIN",
    "NE",
    "NO",
    "NOR",
    "NYG",
    "NYJ",
    "PHI",
    "PIT",
    "SEA",
    "SF",
    "SFO",
    "TB",
    "TAM",
    "TEN",
    "WAS",
    "WSH",
  ]);

  const TEAM_ALIASES = {
    GNB: "GB",
    JAC: "JAX",
    KAN: "KC",
    SD: "LAC",
    STL: "LAR",
    OAK: "LV",
    NOR: "NO",
    SFO: "SF",
    TAM: "TB",
    WAS: "WSH",
  };

  let importInFlight = false;
  let lastObservedLeagueId = null;

  function log(...args) {
    console.log(
      "[DraftIQ Yahoo Import]",
      ...args
    );
  }

  function normalizeText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeKey(value) {
    return normalizeText(value)
      .toLowerCase()
      .replace(/\./g, "")
      .replace(/[’']/g, "")
      .replace(/-/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeTeam(value) {
    const raw = String(value || "")
      .toUpperCase()
      .replace(/[^A-Z]/g, "");

    return TEAM_ALIASES[raw] || raw;
  }

  function getLeagueId(
    urlValue = window.location.href
  ) {
    let url;

    try {
      url = new URL(
        urlValue,
        window.location.href
      );
    } catch {
      return null;
    }

    const pathMatch =
      url.pathname.match(
        /\/(?:draftclient\/)?f1\/(\d+)(?:\/|$)/i
      );

    if (pathMatch) {
      return pathMatch[1];
    }

    const queryLeagueId =
      url.searchParams.get("leagueId") ||
      url.searchParams.get("league_id") ||
      url.searchParams.get("lid");

    return (
      queryLeagueId &&
      /^\d+$/.test(queryLeagueId)
    )
      ? queryLeagueId
      : null;
  }

  function getTeamId(
    urlValue,
    leagueId
  ) {
    let url;

    try {
      url = new URL(
        urlValue,
        window.location.href
      );
    } catch {
      return null;
    }

    const escapedLeagueId =
      String(leagueId).replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

    const draftClientMatch =
      url.pathname.match(
        new RegExp(
          `/draftclient/f1/${escapedLeagueId}/(\\d+)(?:/|$)`,
          "i"
        )
      );

    if (draftClientMatch) {
      return draftClientMatch[1];
    }

    const teamMatch =
      url.pathname.match(
        new RegExp(
          `/f1/${escapedLeagueId}/(\\d+)(?:/|$)`,
          "i"
        )
      );

    return teamMatch
      ? teamMatch[1]
      : null;
  }

  function absoluteUrl(
    value,
    baseUrl = window.location.href
  ) {
    if (!value) return null;

    try {
      return new URL(
        value,
        baseUrl
      ).href;
    } catch {
      return null;
    }
  }

  function documentText(doc) {
    return normalizeText(
      doc?.body?.innerText ||
        doc?.body?.textContent ||
        ""
    );
  }

  function isYahooLoginDocument(doc) {
    const title =
      normalizeKey(doc?.title);

    const text = normalizeKey(
      documentText(doc).slice(
        0,
        2000
      )
    );

    return (
      title.includes(
        "sign in to yahoo"
      ) ||
      text.includes(
        "sign in to yahoo"
      ) ||
      text.includes(
        "create a yahoo account"
      )
    );
  }

  async function fetchDocument(url) {
    const response = await fetch(
      url,
      {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        redirect: "follow",
        headers: {
          Accept:
            "text/html,application/xhtml+xml",
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Yahoo page returned HTTP ${response.status}: ${url}`
      );
    }

    const html =
      await response.text();

    const doc =
      new DOMParser().parseFromString(
        html,
        "text/html"
      );

    if (
      isYahooLoginDocument(doc)
    ) {
      throw new Error(
        "Yahoo session is not signed in for this league page."
      );
    }

    return {
      url:
        response.url || url,
      doc,
    };
  }

  function getPageTitleCandidate(doc) {
    const selectors = [
      "[data-testid*='league-name' i]",
      "[data-test*='league-name' i]",
      "[class*='league-name' i]",
      "main h1",
      "h1",
    ];

    for (
      const selector of selectors
    ) {
      const value = normalizeText(
        doc.querySelector(
          selector
        )?.textContent
      );

      if (
        value &&
        value.length >= 2 &&
        value.length <= 120 &&
        !/^(fantasy football|overview|my team|league|home)$/i.test(
          value
        )
      ) {
        return value;
      }
    }

    const title =
      normalizeText(doc.title)
        .replace(
          /\s*\|\s*Yahoo.*$/i,
          ""
        )
        .replace(
          /\s*-\s*Yahoo.*$/i,
          ""
        )
        .replace(
          /\s*\|\s*Fantasy Football.*$/i,
          ""
        )
        .trim();

    return title || null;
  }

  function findLeagueHomeUrl(
    doc,
    leagueId,
    baseUrl
  ) {
    const anchors =
      Array.from(
        doc.querySelectorAll(
          "a[href]"
        )
      );

    const explicitHome =
      anchors.find((anchor) => {
        const href =
          absoluteUrl(
            anchor.getAttribute(
              "href"
            ),
            baseUrl
          );

        const text =
          normalizeKey(
            anchor.textContent
          );

        if (!href) {
          return false;
        }

        try {
          const url =
            new URL(href);

          return (
            new RegExp(
              `/f1/${leagueId}/?$`,
              "i"
            ).test(
              url.pathname
            ) &&
            (
              text.includes(
                "league"
              ) ||
              text.includes(
                "overview"
              ) ||
              text.includes(
                "home"
              )
            )
          );
        } catch {
          return false;
        }
      });

    if (explicitHome) {
      return absoluteUrl(
        explicitHome.getAttribute(
          "href"
        ),
        baseUrl
      );
    }

    return (
      `${new URL(baseUrl).origin}` +
      `/f1/${leagueId}`
    );
  }

  function findSettingsUrl(
    doc,
    leagueId,
    baseUrl
  ) {
    const anchors =
      Array.from(
        doc.querySelectorAll(
          "a[href]"
        )
      );

    const settingsAnchor =
      anchors.find((anchor) => {
        const href =
          absoluteUrl(
            anchor.getAttribute(
              "href"
            ),
            baseUrl
          );

        const text =
          normalizeKey(
            anchor.textContent
          );

        const aria =
          normalizeKey(
            anchor.getAttribute(
              "aria-label"
            )
          );

        if (!href) {
          return false;
        }

        return (
          href.includes(
            `/f1/${leagueId}/`
          ) &&
          (
            /\/settings(?:[/?#]|$)/i.test(
              href
            ) ||
            text.includes(
              "league settings"
            ) ||
            aria.includes(
              "league settings"
            )
          )
        );
      });

    if (settingsAnchor) {
      return absoluteUrl(
        settingsAnchor.getAttribute(
          "href"
        ),
        baseUrl
      );
    }

    return (
      `${new URL(baseUrl).origin}` +
      `/f1/${leagueId}/settings`
    );
  }

  function findCurrentTeamUrl(
    doc,
    leagueId,
    baseUrl
  ) {
    const currentTeamId =
      getTeamId(
        baseUrl,
        leagueId
      );

    if (currentTeamId) {
      return (
        `${new URL(baseUrl).origin}` +
        `/f1/${leagueId}/${currentTeamId}`
      );
    }

    const anchors =
      Array.from(
        doc.querySelectorAll(
          "a[href]"
        )
      );

    const myTeamAnchor =
      anchors.find((anchor) => {
        const text =
          normalizeKey(
            anchor.textContent
          );

        const aria =
          normalizeKey(
            anchor.getAttribute(
              "aria-label"
            )
          );

        const href =
          absoluteUrl(
            anchor.getAttribute(
              "href"
            ),
            baseUrl
          );

        return (
          href &&
          getTeamId(
            href,
            leagueId
          ) &&
          (
            text === "my team" ||
            text === "your team" ||
            aria === "my team" ||
            aria === "your team" ||
            anchor.getAttribute(
              "aria-current"
            ) === "page"
          )
        );
      });

    return myTeamAnchor
      ? absoluteUrl(
          myTeamAnchor.getAttribute(
            "href"
          ),
          baseUrl
        )
      : null;
  }

  function parseNumberNearLabel(
    text,
    labels,
    min,
    max
  ) {
    for (
      const label of labels
    ) {
      const regex =
        new RegExp(
          `${label}\\s*:?\\s*(\\d{1,2})`,
          "i"
        );

      const match =
        text.match(regex);

      if (!match) continue;

      const value =
        Number(match[1]);

      if (
        Number.isInteger(value) &&
        value >= min &&
        value <= max
      ) {
        return value;
      }
    }

    return null;
  }

  function getRosterPositionKey(value) {
    const normalized = String(value || "")
      .toUpperCase()
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const compact = normalized.replace(/[^A-Z]/g, "");

    if (compact === "QB") return "qb";
    if (compact === "RB") return "rb";
    if (compact === "WR") return "wr";
    if (compact === "TE") return "te";

    if (
      compact === "WRT" ||
      compact === "FLEX" ||
      normalized.includes("FLEX")
    ) {
      return "flex";
    }

    if (compact === "BN" || compact === "BENCH") {
      return "bench";
    }

    /*
     * DraftIQ does not use these positions for recommendations,
     * but retaining them preserves column alignment.
     */
    if (
      compact === "K" ||
      compact === "PK" ||
      compact === "DEF" ||
      compact === "DST" ||
      compact === "IR"
    ) {
      return "__ignore__";
    }

    return null;
  }

  function getRosterCellNumber(value) {
    const match = normalizeText(value).match(/^(\d{1,2})$/);

    if (!match) return null;

    const number = Number(match[1]);

    return Number.isInteger(number)
      ? number
      : null;
  }

  function buildRosterSettingsFromRows(rows) {
    for (
      let headerIndex = 0;
      headerIndex < rows.length;
      headerIndex += 1
    ) {
      const headerCells = rows[headerIndex];

      const headerKeys = headerCells.map(
        getRosterPositionKey
      );

      const recognizedHeaderCount =
        headerKeys.filter(Boolean).length;

      if (recognizedHeaderCount < 4) {
        continue;
      }

      for (
        let valueIndex = headerIndex + 1;
        valueIndex <
        Math.min(rows.length, headerIndex + 4);
        valueIndex += 1
      ) {
        const valueCells = rows[valueIndex];

        const values = valueCells.map(
          getRosterCellNumber
        );

        const numericCount = values.filter(
          (value) => value !== null
        ).length;

        if (numericCount < recognizedHeaderCount) {
          continue;
        }

        const settings = {};

        headerKeys.forEach((key, index) => {
          if (!key || key === "__ignore__") {
            return;
          }

          const value = values[index];

          if (
            value !== null &&
            value >= 0 &&
            value <= 20
          ) {
            settings[key] = value;
          }
        });

        if (Object.keys(settings).length >= 4) {
          return settings;
        }
      }
    }

    return {};
  }

  function parseRosterSettingsFromTables(doc) {
    const rowGroups = [];

    Array.from(
      doc.querySelectorAll("table")
    ).forEach((table) => {
      const rows = Array.from(
        table.querySelectorAll("tr")
      )
        .map((row) =>
          Array.from(
            row.querySelectorAll("th, td")
          ).map((cell) =>
            normalizeText(cell.textContent)
          )
        )
        .filter((row) => row.length);

      if (rows.length) {
        rowGroups.push(rows);
      }
    });

    const roleRows = Array.from(
      doc.querySelectorAll("[role='row']")
    )
      .map((row) =>
        Array.from(
          row.querySelectorAll(
            [
              "[role='columnheader']",
              "[role='cell']",
              "[role='gridcell']",
            ].join(",")
          )
        ).map((cell) =>
          normalizeText(cell.textContent)
        )
      )
      .filter((row) => row.length);

    if (roleRows.length) {
      rowGroups.push(roleRows);
    }

    for (const rows of rowGroups) {
      const settings =
        buildRosterSettingsFromRows(rows);

      if (Object.keys(settings).length >= 4) {
        return settings;
      }
    }

    return {};
  }

  function parseRosterSettingsFromText(doc) {
    const rawText = String(
      doc?.body?.innerText ||
        doc?.body?.textContent ||
        ""
    )
      .replace(
        /W\s*[-/]\s*R\s*[-/]\s*T/gi,
        "WRT"
      )
      .replace(/\u00a0/g, " ");

    const tokens = rawText
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);

    for (
      let startIndex = 0;
      startIndex < tokens.length;
      startIndex += 1
    ) {
      const headerKeys = [];
      let cursor = startIndex;

      while (cursor < tokens.length) {
        const key =
          getRosterPositionKey(
            tokens[cursor]
          );

        if (!key) break;

        headerKeys.push(key);
        cursor += 1;
      }

      if (headerKeys.length < 7) {
        continue;
      }

      const values = [];

      while (
        cursor < tokens.length &&
        values.length < headerKeys.length
      ) {
        const value =
          getRosterCellNumber(
            tokens[cursor]
          );

        if (value === null) break;

        values.push(value);
        cursor += 1;
      }

      if (
        values.length !== headerKeys.length
      ) {
        continue;
      }

      const settings = {};

      headerKeys.forEach((key, index) => {
        if (!key || key === "__ignore__") {
          return;
        }

        settings[key] = values[index];
      });

      if (Object.keys(settings).length >= 4) {
        return settings;
      }
    }

    return {};
  }

  function parseRepeatedRosterPositions(doc) {
    const fullText = documentText(doc);

    const rosterMatch = fullText.match(
      /Roster Positions?\s*:?\s*([\s\S]{0,1200}?)(?:Stat Categories|Scoring Settings|Scoring Type|Fractional Points|Negative Points|Waiver|Trade|Playoff|League Settings|$)/i
    );

    const rosterText =
      rosterMatch?.[1] || "";

    const normalized = rosterText
      .replace(
        /W\s*[-/]\s*R\s*[-/]\s*T/gi,
        " WRT "
      )
      .toUpperCase();

    if (!normalized) return {};

    const count = (pattern) =>
      (normalized.match(pattern) || []).length;

    const settings = {
      qb: count(/\bQB\b/g),
      rb: count(/\bRB\b/g),
      wr: count(/\bWR\b/g),
      te: count(/\bTE\b/g),
      flex: count(/\b(?:WRT|FLEX)\b/g),
      bench: count(/\b(?:BN|BENCH)\b/g),
    };

    return Object.fromEntries(
      Object.entries(settings).filter(
        ([, value]) => value > 0
      )
    );
  }

  function parseRosterSettings(doc) {
    /*
     * Yahoo's My Team page uses a header row
     * followed by a numeric value row:
     *
     * QB WR RB TE W-R-T K DEF BN IR
     *  1  3  2  1   2   1  1  4  1
     */

    const tableSettings =
      parseRosterSettingsFromTables(doc);

    if (
      Object.keys(tableSettings).length >= 4
    ) {
      return tableSettings;
    }

    const textSettings =
      parseRosterSettingsFromText(doc);

    if (
      Object.keys(textSettings).length >= 4
    ) {
      return textSettings;
    }

    /*
     * Yahoo's settings page may list each slot
     * repeatedly instead of using numeric columns.
     */
    return parseRepeatedRosterPositions(doc);
  }

  function parseReceptionScoring(
    doc
  ) {
    const fullText =
      documentText(doc);

    const normalized =
      normalizeKey(fullText);

    if (
      normalized.includes(
        "half point ppr"
      ) ||
      normalized.includes(
        "half ppr"
      ) ||
      normalized.includes(
        "0 5 points per reception"
      )
    ) {
      return "half-ppr";
    }

    if (
      normalized.includes(
        "point per reception"
      ) ||
      normalized.includes(
        "full ppr"
      )
    ) {
      return "ppr";
    }

    const rows = Array.from(
      doc.querySelectorAll(
        "tr, [role='row'], li, div"
      )
    );

    for (
      const row of rows
    ) {
      const text =
        normalizeText(
          row.textContent
        );

      if (
        !text ||
        text.length > 300 ||
        !/\b(?:reception|receptions|rec)\b/i.test(
          text
        )
      ) {
        continue;
      }

      const numericValues =
        Array.from(
          text.matchAll(
            /(?:^|\s)(-?\d+(?:\.\d+)?)(?=\s|$)/g
          )
        ).map((match) =>
          Number(match[1])
        );

      const score =
        numericValues.find(
          (value) =>
            value >= 0 &&
            value <= 2
        );

      if (score === 1) {
        return "ppr";
      }

      if (score === 0.5) {
        return "half-ppr";
      }

      if (score === 0) {
        return "standard";
      }
    }

    if (
      normalized.includes(
        "standard scoring"
      ) ||
      normalized.includes(
        "non ppr"
      )
    ) {
      return "standard";
    }

    return null;
  }

  function parseLeagueSettings(
    doc
  ) {
    const text =
      documentText(doc);

    const teamCount =
      parseNumberNearLabel(
        text,
        [
          "League Size",
          "Max Teams",
          "Maximum Teams",
          "Number of Teams",
        ],
        2,
        20
      ) ||
      (() => {
        const match =
          text.match(
            /\b(\d{1,2})\s+Teams?\b/i
          );

        const value =
          match
            ? Number(match[1])
            : null;

        return (
          Number.isInteger(value) &&
          value >= 2 &&
          value <= 20
        )
          ? value
          : null;
      })();

    const scoring =
      parseReceptionScoring(
        doc
      );

    const roster =
      parseRosterSettings(
        doc
      );

    const settings = {
      ...roster,
    };

    if (teamCount !== null) {
      settings.teamCount =
        teamCount;
    }

    if (scoring) {
      settings.scoring =
        scoring;
    }

    return settings;
  }

  function extractPlayerNameFromRow(
    row
  ) {
    const anchors =
      Array.from(
        row.querySelectorAll(
          "a, button"
        )
      );

    const preferred =
      anchors.find((element) => {
        const text =
          normalizeText(
            element.textContent
          );

        const href =
          element.getAttribute(
            "href"
          ) || "";

        const key =
          normalizeKey(text);

        return (
          text.length >= 4 &&
          text.length <= 60 &&
          key.split(" ").length >=
            2 &&
          !/^(add|drop|edit|watch|news|video|player note|start active)$/i.test(
            text
          ) &&
          (
            /player|players|athlete|nfl/i.test(
              href
            ) ||
            /[A-Z][a-zA-Z'.-]+\s+[A-Z][a-zA-Z'.-]+/.test(
              text
            )
          )
        );
      });

    if (preferred) {
      return normalizeText(
        preferred.textContent
      );
    }

    const rowText =
      normalizeText(
        row.textContent
      );

    const match =
      rowText.match(
        /\b([A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){1,3})(?=\s+(?:QB|RB|WR|TE|K|PK|DEF|DST)\b)/
      );

    return match
      ? normalizeText(match[1])
      : null;
  }

  function parsePlayerPosition(
    rowText
  ) {
    const matches =
      Array.from(
        String(rowText || "")
          .toUpperCase()
          .matchAll(
            /\b(QB|RB|WR|TE|PK|K|DEF|DST)\b/g
          )
      ).map(
        (match) => match[1]
      );

    return matches.length
      ? matches[
          matches.length - 1
        ]
      : null;
  }

  function parsePlayerTeam(
    rowText,
    position
  ) {
    const tokens =
      String(rowText || "")
        .toUpperCase()
        .replace(
          /[^A-Z\s]/g,
          " "
        )
        .split(/\s+/)
        .filter(Boolean);

    const positionIndex =
      position
        ? tokens.lastIndexOf(
            position
          )
        : -1;

    const nearby =
      positionIndex >= 0
        ? tokens.slice(
            Math.max(
              0,
              positionIndex - 3
            ),
            positionIndex + 4
          )
        : tokens;

    const team =
      nearby.find((token) =>
        NFL_TEAMS.has(token)
      );

    return team
      ? normalizeTeam(team)
      : null;
  }

  function parseRosterPlayers(doc) {
    const candidateRows =
      Array.from(
        doc.querySelectorAll(
          [
            "tr",
            "[role='row']",
            "[data-testid*='player' i]",
            "[class*='player-row' i]",
            "[class*='playerRow' i]",
            "li",
          ].join(",")
        )
      );

    const players =
      new Map();

    for (
      const row of candidateRows
    ) {
      const rowText =
        normalizeText(
          row.textContent
        );

      if (
        !rowText ||
        rowText.length < 5 ||
        rowText.length > 800
      ) {
        continue;
      }

      const position =
        parsePlayerPosition(
          rowText
        );

      if (!position) {
        continue;
      }

      const name =
        extractPlayerNameFromRow(
          row
        );

      if (!name) {
        continue;
      }

      const nameKey =
        normalizeKey(name);

      if (
        !nameKey ||
        nameKey.includes(
          "available player"
        ) ||
        nameKey.includes(
          "player note"
        ) ||
        nameKey.includes(
          "team defense"
        )
      ) {
        continue;
      }

      const team =
        parsePlayerTeam(
          rowText,
          position
        );

      const key =
        `${nameKey}|${position}|${team || ""}`;

      players.set(
        key,
        {
          name,
          pos:
            position === "PK"
              ? "K"
              : position,
          team,
        }
      );
    }

    return Array.from(
      players.values()
    );
  }

  function parseCurrentTeamName(
    doc,
    leagueName
  ) {
    const selectors = [
      "[data-testid*='team-name' i]",
      "[data-test*='team-name' i]",
      "[class*='team-name' i]",
      "main h1",
      "h1",
      "main h2",
    ];

    for (
      const selector of selectors
    ) {
      const value =
        normalizeText(
          doc.querySelector(
            selector
          )?.textContent
        );

      if (
        value &&
        value.length >= 2 &&
        value.length <= 100 &&
        normalizeKey(value) !==
          normalizeKey(
            leagueName
          ) &&
        !/^(my team|your team|roster|overview)$/i.test(
          value
        )
      ) {
        return value;
      }
    }

    return "My Team";
  }

  function stableSnapshotFingerprint(
    snapshot
  ) {
    const simplified = {
      league:
        snapshot.league,

      settings:
        snapshot.settings,

      currentTeamKey:
        snapshot.currentTeamKey,

      teams:
        snapshot.teams.map(
          (team) => ({
            key: team.key,
            name: team.name,
            isCurrentUser:
              team.isCurrentUser,

            players:
              team.players
                .map(
                  (player) => ({
                    name:
                      player.name,
                    pos:
                      player.pos,
                    team:
                      player.team,
                  })
                )
                .sort((a, b) =>
                  a.name.localeCompare(
                    b.name
                  )
                ),
          })
        ),
    };

    return JSON.stringify(
      simplified
    );
  }

  async function writeStatus(
    status,
    message,
    extra = {}
  ) {
    await chrome.storage.local.set({
      [STORAGE_KEY_IMPORT_STATUS]:
        {
          status,
          message,
          url:
            window.location.href,
          updatedAt:
            new Date().toISOString(),
          ...extra,
        },
    });
  }

  async function saveSnapshot(
    snapshot
  ) {
    const fingerprint =
      stableSnapshotFingerprint(
        snapshot
      );

    const saved =
      await chrome.storage.local.get([
        STORAGE_KEY_IMPORT_META,
      ]);

    const previousFingerprint =
      saved[
        STORAGE_KEY_IMPORT_META
      ]?.fingerprint || null;

    await chrome.storage.local.set({
      [STORAGE_KEY_YAHOO_LEAGUE]:
        snapshot,

      [STORAGE_KEY_IMPORT_META]:
        {
          leagueId:
            snapshot.league.id,

          fingerprint,

          importedAt:
            snapshot.syncedAt,

          importMethod:
            snapshot.importMethod,
        },
    });

    return (
      fingerprint !==
      previousFingerprint
    );
  }

  async function importCurrentYahooLeague(
    { force = false } = {}
  ) {
    if (importInFlight) {
      return;
    }

    const leagueId =
      getLeagueId();

    if (!leagueId) {
      await writeStatus(
        "idle",
        "Open a Yahoo fantasy football league page to import it."
      );

      return;
    }

    const saved =
      await chrome.storage.local.get([
        STORAGE_KEY_IMPORT_META,
      ]);

    const lastImport =
      saved[
        STORAGE_KEY_IMPORT_META
      ];

    const lastImportedAt =
      Date.parse(
        lastImport?.importedAt ||
          ""
      );

    if (
      !force &&
      lastImport?.leagueId ===
        leagueId &&
      Number.isFinite(
        lastImportedAt
      ) &&
      Date.now() -
        lastImportedAt <
        AUTO_IMPORT_INTERVAL_MS
    ) {
      return;
    }

    importInFlight = true;

    await writeStatus(
      "loading",
      "Importing Yahoo league from your signed-in page..."
    );

    try {
      const currentDoc =
        document;

      const currentUrl =
        window.location.href;

      const leagueHomeUrl =
        findLeagueHomeUrl(
          currentDoc,
          leagueId,
          currentUrl
        );

      let homeDoc =
        currentDoc;

      let resolvedHomeUrl =
        currentUrl;

      if (
        !new RegExp(
          `/f1/${leagueId}/?$`,
          "i"
        ).test(
          window.location.pathname
        )
      ) {
        try {
          const fetchedHome =
            await fetchDocument(
              leagueHomeUrl
            );

          homeDoc =
            fetchedHome.doc;

          resolvedHomeUrl =
            fetchedHome.url;
        } catch (error) {
          log(
            "League homepage fetch fallback:",
            error.message
          );
        }
      }

      const leagueName =
        getPageTitleCandidate(
          homeDoc
        ) ||
        getPageTitleCandidate(
          currentDoc
        ) ||
        `Yahoo League ${leagueId}`;

      const settingsUrl =
        findSettingsUrl(
          homeDoc,
          leagueId,
          resolvedHomeUrl
        );

      let settings = {};

      try {
        const settingsPage =
          await fetchDocument(
            settingsUrl
          );

        settings =
          parseLeagueSettings(
            settingsPage.doc
          );
      } catch (error) {
        log(
          "Settings page fetch failed; using visible page text:",
          error.message
        );

        settings =
          parseLeagueSettings(
            currentDoc
          );
      }

      /*
       * The My Team page contains the clearest numeric roster table,
       * so merge any settings found on the visible page over values
       * from Yahoo's separate settings page.
       */
      const visiblePageSettings =
        parseLeagueSettings(
          currentDoc
        );

      settings = {
        ...settings,
        ...visiblePageSettings,
      };

      const currentTeamUrl =
        findCurrentTeamUrl(
          currentDoc,
          leagueId,
          currentUrl
        ) ||
        findCurrentTeamUrl(
          homeDoc,
          leagueId,
          resolvedHomeUrl
        );

      let teamDoc =
        currentDoc;

      let resolvedTeamUrl =
        currentTeamUrl ||
        currentUrl;

      if (
        currentTeamUrl &&
        new URL(
          currentTeamUrl
        ).href !==
          new URL(
            currentUrl
          ).href
      ) {
        try {
          const fetchedTeam =
            await fetchDocument(
              currentTeamUrl
            );

          teamDoc =
            fetchedTeam.doc;

          resolvedTeamUrl =
            fetchedTeam.url;
        } catch (error) {
          log(
            "My Team page fetch fallback:",
            error.message
          );
        }
      }

      /*
       * Run the roster parser against the resolved My Team page as
       * well. This catches leagues where the homepage does not show
       * the roster-position table.
       */
      const teamPageSettings =
        parseLeagueSettings(
          teamDoc
        );

      settings = {
        ...settings,
        ...teamPageSettings,
      };

      const teamId =
        getTeamId(
          resolvedTeamUrl,
          leagueId
        ) ||
        getTeamId(
          currentUrl,
          leagueId
        ) ||
        "current";

      const teamKey =
        `yahoo-${leagueId}-${teamId}`;

      const teamName =
        parseCurrentTeamName(
          teamDoc,
          leagueName
        );

      const players =
        parseRosterPlayers(
          teamDoc
        );

      const snapshot = {
        /*
         * Kept as yahoo-api for compatibility
         * with the existing DraftIQ snapshot
         * consumer. The importer itself reads
         * the signed-in Yahoo page.
         */
        source: "yahoo-api",

        importMethod:
          "signed-in-page",

        syncedAt:
          new Date().toISOString(),

        league: {
          id: leagueId,
          key:
            `yahoo-${leagueId}`,
          name:
            leagueName,
          url:
            leagueHomeUrl,
        },

        settings,

        currentTeamKey:
          teamKey,

        teams: [
          {
            id: teamId,
            key: teamKey,
            name: teamName,
            isCurrentUser: true,
            players,
          },
        ],
      };

      const changed =
        await saveSnapshot(
          snapshot
        );

      await writeStatus(
        "success",
        changed
          ? `Imported ${leagueName}.`
          : `${leagueName} is already current.`,
        {
          leagueId,
          leagueName,
          teamName,
          playerCount:
            players.length,
          detectedSettings:
            Object.keys(
              settings
            ),
        }
      );

      log(
        changed
          ? "Yahoo league imported:"
          : "Yahoo league already current:",
        leagueName,
        settings,
        `${players.length} roster players`
      );
    } catch (error) {
      const message =
        String(
          error?.message ||
            error
        );

      await writeStatus(
        "error",
        message,
        {
          leagueId,
        }
      );

      console.error(
        "[DraftIQ Yahoo Import]",
        error
      );
    } finally {
      importInFlight = false;
    }
  }

  chrome.runtime.onMessage.addListener(
    (
      message,
      _sender,
      sendResponse
    ) => {
      if (
        message?.type !==
        "DRAFTIQ_IMPORT_YAHOO_LEAGUE"
      ) {
        return;
      }

      importCurrentYahooLeague({
        force: true,
      })
        .then(() => {
          sendResponse({
            ok: true,
          });
        })
        .catch((error) => {
          sendResponse({
            ok: false,
            error:
              String(
                error?.message ||
                  error
              ),
          });
        });

      return true;
    }
  );

  function scheduleImport(
    force = false
  ) {
    window.setTimeout(() => {
      importCurrentYahooLeague({
        force,
      });
    }, 1200);
  }

  lastObservedLeagueId =
    getLeagueId();

  scheduleImport(true);

  window.setInterval(() => {
    const leagueId =
      getLeagueId();

    if (
      leagueId !==
      lastObservedLeagueId
    ) {
      lastObservedLeagueId =
        leagueId;

      scheduleImport(true);
    }
  }, URL_CHECK_INTERVAL_MS);

  window.setInterval(() => {
    importCurrentYahooLeague({
      force: false,
    });
  }, AUTO_IMPORT_INTERVAL_MS);
})();
