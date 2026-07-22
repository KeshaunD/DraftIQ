"use strict";

function collectNamedNodes(node, key, results = []) {
  if (Array.isArray(node)) {
    node.forEach((item) => collectNamedNodes(item, key, results));
    return results;
  }

  if (!node || typeof node !== "object") return results;

  Object.entries(node).forEach(([entryKey, value]) => {
    if (entryKey === key) results.push(value);
    collectNamedNodes(value, key, results);
  });

  return results;
}

function firstScalar(node, key) {
  if (Array.isArray(node)) {
    for (const item of node) {
      const value = firstScalar(item, key);
      if (value !== undefined) return value;
    }

    return undefined;
  }

  if (!node || typeof node !== "object") return undefined;

  if (
    Object.prototype.hasOwnProperty.call(node, key) &&
    ["string", "number", "boolean"].includes(typeof node[key])
  ) {
    return node[key];
  }

  for (const value of Object.values(node)) {
    const found = firstScalar(value, key);
    if (found !== undefined) return found;
  }

  return undefined;
}

function uniqueEntities(data, entityName, keyName, mapper) {
  const seen = new Set();
  const entities = [];

  collectNamedNodes(data, entityName).forEach((node) => {
    const key = firstScalar(node, keyName);
    if (!key || seen.has(String(key))) return;

    seen.add(String(key));
    entities.push(mapper(node));
  });

  return entities;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePosition(value) {
  const position = String(value || "")
    .split(",")[0]
    .trim()
    .toUpperCase();

  if (position === "DST") return "DEF";
  if (position === "PK") return "K";
  return position;
}

function normalizeLeagueList(data) {
  return uniqueEntities(data, "league", "league_key", (node) => ({
    key: String(firstScalar(node, "league_key")),
    id: String(firstScalar(node, "league_id") || ""),
    name: String(firstScalar(node, "name") || "Yahoo League"),
    season: toNumber(firstScalar(node, "season")),
    teamCount: toNumber(firstScalar(node, "num_teams")),
    draftStatus: String(firstScalar(node, "draft_status") || ""),
    url: String(firstScalar(node, "url") || ""),
  }));
}

function normalizeTeamEntity(node) {
  const draftPosition =
    toNumber(firstScalar(node, "draft_position")) ??
    toNumber(firstScalar(node, "draft_pick"));

  return {
    key: String(firstScalar(node, "team_key") || ""),
    id: String(firstScalar(node, "team_id") || ""),
    name: String(firstScalar(node, "name") || "Yahoo Team"),
    manager: String(firstScalar(node, "nickname") || ""),
    isCurrentUser: Number(firstScalar(node, "is_current_login")) === 1,
    draftPosition,
    rank: toNumber(firstScalar(node, "rank")),
    wins: toNumber(firstScalar(node, "wins")),
    losses: toNumber(firstScalar(node, "losses")),
    ties: toNumber(firstScalar(node, "ties")),
    players: [],
  };
}

function normalizeTeams(data) {
  return uniqueEntities(data, "team", "team_key", normalizeTeamEntity);
}

function normalizePlayers(data) {
  return uniqueEntities(data, "player", "player_key", (node) => {
    const selectedPositionNode = collectNamedNodes(
      node,
      "selected_position"
    )[0];

    return {
      key: String(firstScalar(node, "player_key") || ""),
      id: String(firstScalar(node, "player_id") || ""),
      name: String(firstScalar(node, "full") || ""),
      team: String(firstScalar(node, "editorial_team_abbr") || "").toUpperCase(),
      pos: normalizePosition(firstScalar(node, "display_position")),
      rosterPosition: normalizePosition(
        firstScalar(selectedPositionNode, "position")
      ),
      status: String(firstScalar(node, "status") || ""),
    };
  }).filter((player) => player.name);
}

function normalizeRosterResponse(data, fallbackTeam = {}) {
  const responseTeams = normalizeTeams(data);
  const responseTeam =
    responseTeams.find((team) => team.key === fallbackTeam.key) ||
    responseTeams[0] ||
    {};

  return {
    ...fallbackTeam,
    ...responseTeam,
    key: responseTeam.key || fallbackTeam.key || "",
    name: responseTeam.name || fallbackTeam.name || "Yahoo Team",
    isCurrentUser: Boolean(
      responseTeam.isCurrentUser || fallbackTeam.isCurrentUser
    ),
    draftPosition:
      responseTeam.draftPosition ?? fallbackTeam.draftPosition ?? null,
    players: normalizePlayers(data),
  };
}

function normalizeLeagueSettings(data) {
  const settings = {};
  const rosterPositions = {};
  const teamCount = toNumber(firstScalar(data, "num_teams"));

  if (teamCount && teamCount >= 2 && teamCount <= 20) {
    settings.teamCount = teamCount;
  }

  collectNamedNodes(data, "roster_position").forEach((node) => {
    const position = String(firstScalar(node, "position") || "").toUpperCase();
    const count = toNumber(firstScalar(node, "count"));

    if (!position || count === null) return;
    rosterPositions[position] = count;
  });

  const directPositions = {
    QB: "qb",
    RB: "rb",
    WR: "wr",
    TE: "te",
    BN: "bench",
    BENCH: "bench",
  };

  Object.entries(directPositions).forEach(([yahooPosition, draftIqKey]) => {
    if (rosterPositions[yahooPosition] !== undefined) {
      settings[draftIqKey] = rosterPositions[yahooPosition];
    }
  });

  const flexCount = Object.entries(rosterPositions).reduce(
    (total, [position, count]) =>
      position.includes("/") || position === "FLEX" ? total + count : total,
    0
  );

  if (flexCount > 0) settings.flex = flexCount;

  const statNames = new Map();
  const statValues = new Map();

  collectNamedNodes(data, "stat").forEach((node) => {
    const statId = String(firstScalar(node, "stat_id") || "");
    const name = String(firstScalar(node, "name") || "").trim();
    const displayName = String(firstScalar(node, "display_name") || "").trim();
    const value = toNumber(firstScalar(node, "value"));

    if (!statId) return;
    if (name || displayName) statNames.set(statId, { name, displayName });
    if (value !== null) statValues.set(statId, value);
  });

  let receptionModifier = null;

  for (const [statId, labels] of statNames.entries()) {
    const name = labels.name.toLowerCase();
    const displayName = labels.displayName.toLowerCase();

    if (/^receptions?$/.test(name) || displayName === "rec") {
      receptionModifier = statValues.get(statId) ?? null;
      break;
    }
  }

  if (receptionModifier !== null) {
    settings.scoring =
      receptionModifier >= 0.75
        ? "ppr"
        : receptionModifier >= 0.25
          ? "half-ppr"
          : "standard";
  }

  return {
    settings,
    rosterPositions,
    receptionModifier,
  };
}

module.exports = {
  collectNamedNodes,
  firstScalar,
  normalizeLeagueList,
  normalizeLeagueSettings,
  normalizePlayers,
  normalizeRosterResponse,
  normalizeTeams,
};
