const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");

const SEASON = Number(process.env.SLEEPER_SEASON || process.env.SEASON || 2026);
const WEEKS = Array.from({ length: 18 }, (_, index) => index + 1);

const PLAYERS_PATH = path.join(PROJECT_ROOT, "data", "players.json");

const OUTPUT_DIR = path.join(PROJECT_ROOT, "data", "sleeper");
const MATCHES_OUTPUT = path.join(OUTPUT_DIR, `sleeper_player_matches_${SEASON}.json`);
const RAW_OUTPUT = path.join(OUTPUT_DIR, `sleeper_projections_raw_${SEASON}.json`);
const PROJECTIONS_OUTPUT = path.join(OUTPUT_DIR, `sleeper_projections_${SEASON}.json`);
const MISSING_OUTPUT = path.join(OUTPUT_DIR, `sleeper_missing_projections_${SEASON}.json`);

const SLEEPER_PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl";

const POSITION_FILTERS = ["QB", "RB", "WR", "TE", "K"];

const TEAM_ALIASES = {
  ARZ: "ARI",
  JAC: "JAX",
  LA: "LAR",
  STL: "LAR",
  SD: "LAC",
  OAK: "LV",
  WAS: "WSH",
  WSN: "WSH",
  GNB: "GB",
  KAN: "KC",
  NOR: "NO",
  NWE: "NE",
  SFO: "SF",
  TAM: "TB",
};

const NAME_ALIASES = {
  "chigoziem okonkwo": "chig okonkwo",
  "cameron skattebo": "cam skattebo",
  "cameron ward": "cam ward",
  "kenneth gainwell": "kenny gainwell",
  "nathaniel dell": "tank dell",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function saveJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function safeNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "" || value === "-") {
    return fallback;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function normalizeTeam(team) {
  if (!team) return null;

  const value = String(team).trim().toUpperCase();

  return TEAM_ALIASES[value] || value;
}

function normalizePosition(position) {
  if (!position) return null;

  const value = String(position).trim().toUpperCase();

  if (value === "PK") return "K";
  if (value === "D/ST" || value === "DST" || value === "DEF") return "DEF";

  return value;
}

function normalizeName(name) {
  let value = String(name || "").toLowerCase();

  value = value.replace(/\./g, "");
  value = value.replace(/'/g, "");
  value = value.replace(/’/g, "");
  value = value.replace(/-/g, " ");
  value = value.replace(/\b(jr|sr|ii|iii|iv|v)\b/g, "");
  value = value.replace(/[^a-z0-9\s]/g, " ");
  value = value.replace(/\s+/g, " ").trim();

  return NAME_ALIASES[value] || value;
}

function getSleeperFullName(player) {
  const fullName = player.full_name || player.fullName;

  if (fullName) return fullName;

  const firstName = player.first_name || "";
  const lastName = player.last_name || "";

  return `${firstName} ${lastName}`.replace(/\s+/g, " ").trim();
}

async function fetchJson(url) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "DraftIQ/1.0",
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");

    throw new Error(`${response.status} ${response.statusText} for ${url}\n${text.slice(0, 500)}`);
  }

  return response.json();
}

function loadLocalPlayers() {
  const players = loadJson(PLAYERS_PATH, []);

  if (!Array.isArray(players)) {
    throw new Error(`Expected ${PLAYERS_PATH} to contain an array.`);
  }

  return players
    .filter((player) => {
      const position = normalizePosition(player.position || player.pos);

      return ["QB", "RB", "WR", "TE", "K"].includes(position);
    })
    .map((player) => ({
      espnId: player.espn_id || player.espnId || player.id || null,
      name: player.name,
      normalizedName: normalizeName(player.name),
      team: normalizeTeam(player.team),
      position: normalizePosition(player.position || player.pos),
      raw: player,
    }))
    .filter((player) => player.name && player.normalizedName);
}

function buildSleeperIndexes(sleeperPlayersById) {
  const byName = new Map();

  for (const [sleeperId, player] of Object.entries(sleeperPlayersById)) {
    if (!player || typeof player !== "object") continue;

    const fullName = getSleeperFullName(player);

    if (!fullName) continue;

    const normalizedName = normalizeName(fullName);

    if (!normalizedName) continue;

    const position = normalizePosition(player.position);
    const fantasyPositions = Array.isArray(player.fantasy_positions)
      ? player.fantasy_positions.map(normalizePosition).filter(Boolean)
      : [];

    const sleeperRecord = {
      sleeperId,
      name: fullName,
      normalizedName,
      team: normalizeTeam(player.team),
      position,
      fantasyPositions,
      active: Boolean(player.active),
      raw: player,
    };

    if (!byName.has(normalizedName)) {
      byName.set(normalizedName, []);
    }

    byName.get(normalizedName).push(sleeperRecord);
  }

  return { byName };
}

function scoreSleeperMatch(localPlayer, sleeperPlayer) {
  let score = 0;

  if (localPlayer.normalizedName === sleeperPlayer.normalizedName) {
    score += 100;
  }

  const sleeperPositions = new Set([
    sleeperPlayer.position,
    ...(sleeperPlayer.fantasyPositions || []),
  ]);

  if (localPlayer.position && sleeperPositions.has(localPlayer.position)) {
    score += 25;
  }

  if (localPlayer.team && sleeperPlayer.team && localPlayer.team === sleeperPlayer.team) {
    score += 20;
  }

  if (sleeperPlayer.active) {
    score += 5;
  }

  return score;
}

function matchLocalPlayersToSleeper(localPlayers, sleeperIndexes) {
  const matches = [];
  const missing = [];

  for (const localPlayer of localPlayers) {
    const candidates = sleeperIndexes.byName.get(localPlayer.normalizedName) || [];

    if (!candidates.length) {
      missing.push({
        ...localPlayer,
        reason: "No Sleeper name match",
      });

      continue;
    }

    const rankedCandidates = candidates
      .map((candidate) => ({
        ...candidate,
        matchScore: scoreSleeperMatch(localPlayer, candidate),
      }))
      .sort((a, b) => b.matchScore - a.matchScore);

    const best = rankedCandidates[0];

    if (!best || best.matchScore < 100) {
      missing.push({
        ...localPlayer,
        reason: "Weak Sleeper match",
        bestCandidate: best || null,
      });

      continue;
    }

    matches.push({
      espnId: localPlayer.espnId,
      sleeperId: best.sleeperId,
      name: localPlayer.name,
      sleeperName: best.name,
      team: localPlayer.team || best.team,
      sleeperTeam: best.team,
      position: localPlayer.position,
      sleeperPosition: best.position,
      sleeperFantasyPositions: best.fantasyPositions,
      active: best.active,
      matchScore: best.matchScore,
    });
  }

  return { matches, missing };
}

function buildProjectionUrl(week) {
  const params = new URLSearchParams();

  params.set("season_type", "regular");

  for (const position of POSITION_FILTERS) {
    params.append("position[]", position);
  }

  return `https://api.sleeper.app/projections/nfl/${SEASON}/${week}?${params.toString()}`;
}

function normalizeProjectionRows(data, week) {
  if (Array.isArray(data)) {
    return data.map((row) => ({ ...row, week }));
  }

  if (data && Array.isArray(data.projections)) {
    return data.projections.map((row) => ({ ...row, week }));
  }

  if (data && typeof data === "object") {
    return Object.entries(data).map(([playerId, row]) => ({
      ...(typeof row === "object" && row !== null ? row : {}),
      player_id: playerId,
      week,
    }));
  }

  return [];
}

function getProjectionPlayerId(row) {
  return (
    row.player_id ||
    row.playerId ||
    row.player ||
    row.sleeper_id ||
    row.sleeperId ||
    row.id ||
    null
  );
}

function getPprPoints(row) {
  const stats = row.stats || row.stat || row.projection || row;

  return safeNumber(
    stats.pts_ppr ??
      stats.pts_ppr_actual ??
      stats.ppr ??
      stats.fantasy_points_ppr ??
      stats.fantasyPointsPpr ??
      stats.fantasy_points ??
      stats.fantasyPoints ??
      stats.pts ??
      row.pts_ppr ??
      row.ppr ??
      row.fantasy_points ??
      row.fantasyPoints ??
      row.pts,
    0
  );
}

function extractProjectedStats(row) {
  const stats = row.stats || row.stat || row.projection || row;

  return {
    passingYards: safeNumber(stats.pass_yd),
    passingTD: safeNumber(stats.pass_td),
    interceptions: safeNumber(stats.pass_int),

    rushingAttempts: safeNumber(stats.rush_att),
    rushingYards: safeNumber(stats.rush_yd),
    rushingTD: safeNumber(stats.rush_td),

    receivingTargets: safeNumber(stats.rec_tgt),
    receptions: safeNumber(stats.rec),
    receivingYards: safeNumber(stats.rec_yd),
    receivingTD: safeNumber(stats.rec_td),

    fumblesLost: safeNumber(stats.fum_lost),
  };
}

async function fetchSleeperWeeklyProjections() {
  const allRows = [];
  const weeklyCounts = [];

  for (const week of WEEKS) {
    const url = buildProjectionUrl(week);

    try {
      console.log(`Fetching Sleeper projections week ${week}...`);

      const data = await fetchJson(url);
      const rows = normalizeProjectionRows(data, week);

      weeklyCounts.push({
        week,
        rows: rows.length,
      });

      allRows.push(...rows);

      await sleep(250);
    } catch (error) {
      console.warn(`Sleeper projection fetch failed for week ${week}: ${error.message}`);
      weeklyCounts.push({
        week,
        rows: 0,
        error: error.message,
      });
    }
  }

  return { allRows, weeklyCounts };
}

function buildSeasonProjectionBySleeperId(rawProjectionRows) {
  const bySleeperId = new Map();

  for (const row of rawProjectionRows) {
    const sleeperId = getProjectionPlayerId(row);

    if (!sleeperId) continue;

    const points = getPprPoints(row);

    if (!bySleeperId.has(String(sleeperId))) {
      bySleeperId.set(String(sleeperId), []);
    }

    bySleeperId.get(String(sleeperId)).push({
      week: row.week,
      points,
      stats: extractProjectedStats(row),
      raw: row,
    });
  }

  return bySleeperId;
}

function sumStat(weeklyRows, statName) {
  const values = weeklyRows.map((row) => safeNumber(row.stats?.[statName], 0));

  return values.reduce((total, value) => total + value, 0);
}

async function main() {
  console.log();
  console.log("DraftIQ Sleeper Projection Fetch");
  console.log("--------------------------------");
  console.log(`Season: ${SEASON}`);

  const localPlayers = loadLocalPlayers();

  console.log(`Loaded ${localPlayers.length} fantasy-relevant players from data/players.json`);

  console.log("Fetching Sleeper NFL player map...");
  const sleeperPlayersById = await fetchJson(SLEEPER_PLAYERS_URL);
  const sleeperIndexes = buildSleeperIndexes(sleeperPlayersById);

  console.log(`Loaded ${Object.keys(sleeperPlayersById).length} Sleeper NFL player records`);

  const { matches, missing } = matchLocalPlayersToSleeper(localPlayers, sleeperIndexes);

  console.log(`Matched ${matches.length} local players to Sleeper IDs`);
  console.log(`Missing Sleeper match for ${missing.length} local players`);

  const { allRows, weeklyCounts } = await fetchSleeperWeeklyProjections();

  console.log(`Fetched ${allRows.length} raw Sleeper projection rows`);

  const seasonProjectionBySleeperId = buildSeasonProjectionBySleeperId(allRows);

  const projections = [];
  const matchedButNoProjection = [];

  for (const match of matches) {
    const weeklyRows = seasonProjectionBySleeperId.get(String(match.sleeperId)) || [];
    const projectedFantasyPoints = weeklyRows.reduce(
      (total, row) => total + safeNumber(row.points, 0),
      0
    );

    const projectedWeeks = weeklyRows.filter((row) => safeNumber(row.points, 0) > 0).length;

    if (projectedFantasyPoints <= 0) {
      matchedButNoProjection.push({
        ...match,
        reason: "Matched to Sleeper player, but no positive projection rows",
      });

      continue;
    }

    projections.push({
      id: match.espnId,
      espnId: match.espnId,
      sleeperId: match.sleeperId,

      name: match.name,
      sleeperName: match.sleeperName,

      team: match.team,
      pos: match.position,
      position: match.position,

      projectedFantasyPoints: Math.round(projectedFantasyPoints * 10) / 10,
      projectedFantasyPointsPerGame:
        projectedWeeks > 0
          ? Math.round((projectedFantasyPoints / projectedWeeks) * 100) / 100
          : 0,

      projectedWeeks,
      weeklyProjections: weeklyRows
        .map((row) => ({
          week: row.week,
          points: Math.round(safeNumber(row.points, 0) * 100) / 100,
        }))
        .sort((a, b) => a.week - b.week),

      projectedStats: {
        passingYards: Math.round(sumStat(weeklyRows, "passingYards") * 10) / 10,
        passingTD: Math.round(sumStat(weeklyRows, "passingTD") * 10) / 10,
        interceptions: Math.round(sumStat(weeklyRows, "interceptions") * 10) / 10,

        rushingAttempts: Math.round(sumStat(weeklyRows, "rushingAttempts") * 10) / 10,
        rushingYards: Math.round(sumStat(weeklyRows, "rushingYards") * 10) / 10,
        rushingTD: Math.round(sumStat(weeklyRows, "rushingTD") * 10) / 10,

        receivingTargets: Math.round(sumStat(weeklyRows, "receivingTargets") * 10) / 10,
        receptions: Math.round(sumStat(weeklyRows, "receptions") * 10) / 10,
        receivingYards: Math.round(sumStat(weeklyRows, "receivingYards") * 10) / 10,
        receivingTD: Math.round(sumStat(weeklyRows, "receivingTD") * 10) / 10,

        fumblesLost: Math.round(sumStat(weeklyRows, "fumblesLost") * 10) / 10,
      },

      source: "sleeper",
      season: SEASON,
    });
  }

  projections.sort((a, b) => b.projectedFantasyPoints - a.projectedFantasyPoints);

  saveJson(MATCHES_OUTPUT, {
    season: SEASON,
    matched: matches,
    missing,
  });

  saveJson(RAW_OUTPUT, {
    season: SEASON,
    weeklyCounts,
    rows: allRows,
  });

  saveJson(PROJECTIONS_OUTPUT, projections);

  saveJson(MISSING_OUTPUT, {
    season: SEASON,
    localPlayers: localPlayers.length,
    sleeperMatches: matches.length,
    sleeperMissingMatches: missing.length,
    rawProjectionRows: allRows.length,
    projectionPlayers: projections.length,
    matchedButNoProjection,
    missingSleeperMatch: missing,
  });

  console.log();
  console.log("Summary:");
  console.table([
    { metric: "Local fantasy players", count: localPlayers.length },
    { metric: "Sleeper player matches", count: matches.length },
    { metric: "Missing Sleeper matches", count: missing.length },
    { metric: "Raw projection rows", count: allRows.length },
    { metric: "Players with Sleeper projections", count: projections.length },
    { metric: "Matched but no projection", count: matchedButNoProjection.length },
  ]);

  console.log();
  console.log(`Saved Sleeper matches to ${MATCHES_OUTPUT}`);
  console.log(`Saved raw Sleeper projections to ${RAW_OUTPUT}`);
  console.log(`Saved Sleeper projections to ${PROJECTIONS_OUTPUT}`);
  console.log(`Saved Sleeper missing report to ${MISSING_OUTPUT}`);

  console.log();
  console.log("Top 20 Sleeper projections:");
  console.table(
    projections.slice(0, 20).map((player) => ({
      name: player.name,
      team: player.team,
      pos: player.pos,
      projectedFantasyPoints: player.projectedFantasyPoints,
      projectedFantasyPointsPerGame: player.projectedFantasyPointsPerGame,
      projectedWeeks: player.projectedWeeks,
      sleeperId: player.sleeperId,
    }))
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});