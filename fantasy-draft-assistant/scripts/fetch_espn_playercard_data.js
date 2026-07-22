const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");

const LEAGUE_ID = process.env.ESPN_LEAGUE_ID || "2098003764";
const SEASON = Number(process.env.ESPN_SEASON || 2026);

const ESPN_S2 = process.env.ESPN_S2 || "";
const ESPN_SWID = process.env.ESPN_SWID || "";

const PLAYERS_PATH = path.join(PROJECT_ROOT, "data", "players.json");

const OUTPUT_DIR = path.join(PROJECT_ROOT, "data", "espn");
const RAW_OUTPUT = path.join(OUTPUT_DIR, "espn_playercard_raw_2026.json");
const CLEAN_OUTPUT = path.join(OUTPUT_DIR, "espn_playercard_clean_2026.json");
const PROJECTIONS_OUTPUT = path.join(OUTPUT_DIR, "espn_projections_2026.json");
const ADP_OUTPUT = path.join(OUTPUT_DIR, "espn_adp_2026.json");
const MISSING_OUTPUT = path.join(OUTPUT_DIR, "espn_missing_from_playercard_2026.json");

const PLAYERCARD_URL =
  `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${SEASON}` +
  `/segments/0/leagues/${LEAGUE_ID}?scoringPeriodId=0&view=kona_playercard`;

const ESPN_TEAM_BY_ID = {
  1: "ATL",
  2: "BUF",
  3: "CHI",
  4: "CIN",
  5: "CLE",
  6: "DAL",
  7: "DEN",
  8: "DET",
  9: "GB",
  10: "TEN",
  11: "IND",
  12: "KC",
  13: "LV",
  14: "LAR",
  15: "MIA",
  16: "MIN",
  17: "NE",
  18: "NO",
  19: "NYG",
  20: "NYJ",
  21: "PHI",
  22: "ARI",
  23: "PIT",
  24: "LAC",
  25: "SF",
  26: "SEA",
  27: "TB",
  28: "WSH",
  29: "CAR",
  30: "JAX",
  33: "BAL",
  34: "HOU",
};

const ESPN_POSITION_BY_ID = {
  1: "QB",
  2: "RB",
  3: "WR",
  4: "TE",
  5: "PK",
  16: "D/ST",
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

function chunkArray(values, size) {
  const chunks = [];

  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }

  return chunks;
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

function normalizePosition(position) {
  const value = String(position || "").trim().toUpperCase();

  if (value === "K") return "PK";

  return value || null;
}

function getCookieHeader() {
  if (!ESPN_S2 || !ESPN_SWID) {
    throw new Error(
      "Missing ESPN cookies. Set ESPN_S2 and ESPN_SWID in PowerShell before running this script."
    );
  }

  return `espn_s2=${ESPN_S2}; SWID=${ESPN_SWID}`;
}

function loadLocalPlayers() {
  const players = loadJson(PLAYERS_PATH, []);

  if (!Array.isArray(players)) {
    throw new Error(`Expected ${PLAYERS_PATH} to contain an array.`);
  }

  const playerIds = [];
  const lookupByEspnId = new Map();
  const playersWithoutEspnId = [];

  for (const player of players) {
    const espnId = player.espn_id || player.espnId || player.id || player.playerId;

    if (!espnId) {
      playersWithoutEspnId.push(player);
      continue;
    }

    const numericId = Number(espnId);

    if (Number.isNaN(numericId)) {
      playersWithoutEspnId.push(player);
      continue;
    }

    const stringId = String(numericId);

    playerIds.push(numericId);

    lookupByEspnId.set(stringId, {
      espnId: numericId,
      name: player.name || null,
      normalizedName: normalizeName(player.name),
      team: player.team || null,
      teamName: player.team_name || null,
      position: normalizePosition(player.position),
      jersey: player.jersey || null,
      draftYear: player.draft_year || null,
      draftRound: player.draft_round || null,
      college: player.college || null,
    });
  }

  return {
    playerIds: Array.from(new Set(playerIds)),
    lookupByEspnId,
    playersWithoutEspnId,
    totalPlayers: players.length,
  };
}

function buildFantasyFilter(playerIds) {
  return {
    players: {
      filterIds: {
        value: playerIds,
      },
      filterRanksForSlotIds: {
        value: [0, 2, 4, 6, 17, 16, 8, 9, 10, 12, 13, 24, 11, 14, 15],
      },
      filterStatsForTopScoringPeriodIds: {
        value: 17,
        additionalValue: ["002026", "102026", "002025", "1120261", "022026"],
      },
    },
  };
}

function findSeasonProjection(stats = []) {
  return stats.find((stat) => {
    return (
      Number(stat.seasonId) === SEASON &&
      Number(stat.statSourceId) === 1 &&
      Number(stat.statSplitTypeId) === 0
    );
  });
}

function findWeekOneProjection(stats = []) {
  return stats.find((stat) => {
    return (
      Number(stat.seasonId) === SEASON &&
      Number(stat.statSourceId) === 1 &&
      Number(stat.statSplitTypeId) === 1
    );
  });
}

function cleanEspnPlayer(entry, lookupByEspnId) {
  const player = entry.player || {};
  const playerId = player.id || entry.id;
  const localPlayer = lookupByEspnId.get(String(playerId));

  const seasonProjection = findSeasonProjection(player.stats || []);
  const weekOneProjection = findWeekOneProjection(player.stats || []);

  const ownership = player.ownership || {};
  const pprRank = player.draftRanksByRankType?.PPR || null;

  const stats = seasonProjection?.stats || {};

  const finalName = localPlayer?.name || player.fullName || null;
  const finalTeam =
    localPlayer?.team ||
    ESPN_TEAM_BY_ID[player.proTeamId] ||
    String(player.proTeamId || "-");

  const finalPosition =
    localPlayer?.position ||
    ESPN_POSITION_BY_ID[player.defaultPositionId] ||
    String(player.defaultPositionId || "-");

  return {
    id: playerId,
    espnId: playerId,

    name: finalName,
    espnName: player.fullName || null,
    normalizedName: normalizeName(finalName || player.fullName),

    firstName: player.firstName || null,
    lastName: player.lastName || null,

    team: finalTeam,
    teamName: localPlayer?.teamName || null,
    espnTeam: ESPN_TEAM_BY_ID[player.proTeamId] || String(player.proTeamId || "-"),
    proTeamId: player.proTeamId || null,

    pos: finalPosition,
    position: finalPosition,
    espnDefaultPosition:
      ESPN_POSITION_BY_ID[player.defaultPositionId] ||
      String(player.defaultPositionId || "-"),
    defaultPositionId: player.defaultPositionId || null,

    jersey: localPlayer?.jersey || player.jersey || null,

    adp: ownership.averageDraftPosition ?? null,
    adpChange: ownership.averageDraftPositionPercentChange ?? null,
    percentRostered: ownership.percentOwned ?? null,
    percentStarted: ownership.percentStarted ?? null,
    auctionValueAverage: ownership.auctionValueAverage ?? null,
    auctionValueAverageChange: ownership.auctionValueAverageChange ?? null,

    pprRank: pprRank?.rank ?? null,
    pprAuctionValue: pprRank?.auctionValue ?? null,

    projectedFantasyPoints: seasonProjection?.appliedTotal ?? null,
    projectedFantasyPointsPerGame: seasonProjection?.appliedAverage ?? null,
    weekOneProjection: weekOneProjection?.appliedTotal ?? null,

    projectedStats: {
      games: stats["210"] ?? null,

      rushingAttempts: stats["23"] ?? null,
      rushingYards: stats["24"] ?? null,
      rushingTD: stats["25"] ?? null,

      receptions: stats["53"] ?? null,
      receivingTargets: stats["58"] ?? null,
      receivingYards: stats["42"] ?? null,
      receivingTD: stats["43"] ?? null,

      passingAttempts: stats["0"] ?? null,
      passingCompletions: stats["1"] ?? null,
      passingYards: stats["3"] ?? null,
      passingTD: stats["4"] ?? null,
      interceptions: stats["20"] ?? null,

      fumblesLost: stats["72"] ?? null,
    },

    seasonOutlook: player.seasonOutlook || "",

    source: "espn",
    season: SEASON,
  };
}

async function fetchPlayerCardChunk(playerIds, chunkIndex, totalChunks) {
  const fantasyFilter = buildFantasyFilter(playerIds);

  console.log(
    `Fetching ESPN playercard chunk ${chunkIndex + 1}/${totalChunks} (${playerIds.length} players)...`
  );

  const response = await fetch(PLAYERCARD_URL, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Cookie: getCookieHeader(),
      "X-Fantasy-Source": "kona",
      "X-Fantasy-Filter": JSON.stringify(fantasyFilter),
      "X-Fantasy-Platform": "espn-fantasy-web",
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");

    throw new Error(
      `ESPN API failed: ${response.status} ${response.statusText}\n${text.slice(0, 1000)}`
    );
  }

  return response.json();
}

async function main() {
  const { playerIds, lookupByEspnId, playersWithoutEspnId, totalPlayers } = loadLocalPlayers();

  if (!playerIds.length) {
    throw new Error(`No ESPN player IDs found in ${PLAYERS_PATH}`);
  }

  console.log(`Loaded ${totalPlayers} total players from data/players.json`);
  console.log(`Found ${playerIds.length} usable ESPN player IDs`);
  console.log(`Skipped ${playersWithoutEspnId.length} players with no usable ESPN ID`);
  console.log("ESPN cookies detected from local environment.");

  const chunks = chunkArray(playerIds, 25);
  const rawChunks = [];
  const cleanPlayers = [];

  for (let i = 0; i < chunks.length; i += 1) {
    const data = await fetchPlayerCardChunk(chunks[i], i, chunks.length);

    rawChunks.push({
      chunkIndex: i,
      requestedIds: chunks[i],
      returnedCount: Array.isArray(data.players) ? data.players.length : 0,
      response: data,
    });

    for (const entry of data.players || []) {
      const cleaned = cleanEspnPlayer(entry, lookupByEspnId);

      if (!cleaned.name) continue;

      cleanPlayers.push(cleaned);
    }

    await sleep(500);
  }

  const deduped = [];
  const seen = new Set();

  for (const player of cleanPlayers) {
    const key = String(player.espnId || player.id);

    if (seen.has(key)) continue;

    seen.add(key);
    deduped.push(player);
  }

  deduped.sort((a, b) => {
    const aAdp = a.adp ?? 9999;
    const bAdp = b.adp ?? 9999;

    return aAdp - bAdp;
  });

  const returnedIds = new Set(deduped.map((player) => String(player.espnId || player.id)));

  const requestedButNotReturned = playerIds
    .filter((id) => !returnedIds.has(String(id)))
    .map((id) => {
      const localPlayer = lookupByEspnId.get(String(id));

      return {
        espnId: id,
        name: localPlayer?.name || null,
        team: localPlayer?.team || null,
        position: localPlayer?.position || null,
        reason: "ESPN did not return playercard data for this ID",
      };
    });

  const projections = deduped
    .filter((player) => player.projectedFantasyPoints !== null)
    .map((player) => ({
      id: player.id,
      espnId: player.espnId,
      name: player.name,
      team: player.team,
      pos: player.pos,
      position: player.position,

      projectedFantasyPoints: player.projectedFantasyPoints,
      projectedFantasyPointsPerGame: player.projectedFantasyPointsPerGame,
      weekOneProjection: player.weekOneProjection,
      projectedStats: player.projectedStats,

      seasonOutlook: player.seasonOutlook,

      source: "espn",
      season: SEASON,
    }));

  const adp = deduped
    .filter((player) => player.adp !== null)
    .map((player) => ({
      id: player.id,
      espnId: player.espnId,
      name: player.name,
      team: player.team,
      pos: player.pos,
      position: player.position,

      adp: player.adp,
      adpChange: player.adpChange,
      pprRank: player.pprRank,
      pprAuctionValue: player.pprAuctionValue,
      auctionValueAverage: player.auctionValueAverage,
      auctionValueAverageChange: player.auctionValueAverageChange,
      percentRostered: player.percentRostered,
      percentStarted: player.percentStarted,

      source: "espn",
      season: SEASON,
    }));

  saveJson(RAW_OUTPUT, rawChunks);
  saveJson(CLEAN_OUTPUT, deduped);
  saveJson(PROJECTIONS_OUTPUT, projections);
  saveJson(ADP_OUTPUT, adp);
  saveJson(MISSING_OUTPUT, {
    totalPlayers,
    requestedEspnIds: playerIds.length,
    returnedPlayercards: deduped.length,
    projections: projections.length,
    adp: adp.length,
    playersWithoutEspnId,
    requestedButNotReturned,
  });

  console.log(`Saved raw ESPN data to ${RAW_OUTPUT}`);
  console.log(`Saved clean ESPN data to ${CLEAN_OUTPUT}`);
  console.log(`Saved ESPN projections to ${PROJECTIONS_OUTPUT}`);
  console.log(`Saved ESPN ADP to ${ADP_OUTPUT}`);
  console.log(`Saved ESPN missing report to ${MISSING_OUTPUT}`);

  console.log("\nSummary:");
  console.table([
    { metric: "Total local players", count: totalPlayers },
    { metric: "Usable ESPN IDs requested", count: playerIds.length },
    { metric: "ESPN playercards returned", count: deduped.length },
    { metric: "ESPN projections returned", count: projections.length },
    { metric: "ESPN ADP returned", count: adp.length },
    { metric: "No ESPN ID in players.json", count: playersWithoutEspnId.length },
    { metric: "Requested but ESPN did not return", count: requestedButNotReturned.length },
  ]);

  console.log("\nTop 20 ESPN ADP:");
  console.table(adp.slice(0, 20));

  console.log("\nTop 20 ESPN projections:");
  console.table(
    projections
      .slice()
      .sort((a, b) => b.projectedFantasyPoints - a.projectedFantasyPoints)
      .slice(0, 20)
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});