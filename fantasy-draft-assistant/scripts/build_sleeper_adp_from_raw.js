const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SEASON = Number(process.env.SLEEPER_SEASON || process.env.SEASON || 2026);

const RAW_PATH = path.join(
  PROJECT_ROOT,
  "data",
  "sleeper",
  `sleeper_projections_raw_${SEASON}.json`
);

const MATCHES_PATH = path.join(
  PROJECT_ROOT,
  "data",
  "sleeper",
  `sleeper_player_matches_${SEASON}.json`
);

const OUTPUT_PATH = path.join(
  PROJECT_ROOT,
  "data",
  "sleeper",
  `sleeper_adp_${SEASON}.json`
);

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

function median(values) {
  const nums = values
    .map((value) => safeNumber(value, null))
    .filter((value) => value !== null)
    .sort((a, b) => a - b);

  if (!nums.length) return null;

  const middle = Math.floor(nums.length / 2);

  if (nums.length % 2 === 1) {
    return nums[middle];
  }

  return (nums[middle - 1] + nums[middle]) / 2;
}

function getPlayerName(row) {
  const player = row.player || {};
  const first = player.first_name || "";
  const last = player.last_name || "";

  return `${first} ${last}`.replace(/\s+/g, " ").trim();
}

function normalizePosition(position) {
  const value = String(position || "").toUpperCase().trim();

  if (value === "K") return "PK";
  if (value === "DEF" || value === "DST") return "D/ST";

  return value || null;
}

function buildMatchLookup(matchesData) {
  const lookup = new Map();
  const matches = Array.isArray(matchesData.matched) ? matchesData.matched : [];

  for (const match of matches) {
    if (!match.sleeperId) continue;
    lookup.set(String(match.sleeperId), match);
  }

  return lookup;
}

function main() {
  console.log();
  console.log("DraftIQ Sleeper ADP Build");
  console.log("-------------------------");
  console.log(`Season: ${SEASON}`);

  const raw = loadJson(RAW_PATH, null);

  if (!raw || !Array.isArray(raw.rows)) {
    throw new Error(`Could not read raw Sleeper rows from ${RAW_PATH}`);
  }

  const matchesData = loadJson(MATCHES_PATH, { matched: [] });
  const matchLookup = buildMatchLookup(matchesData);

  const bySleeperId = new Map();

  for (const row of raw.rows) {
    const sleeperId = row.player_id || row.playerId || row.sleeperId || row.id;

    if (!sleeperId) continue;

    const stats = row.stats || {};
    const adp = safeNumber(stats.adp_dd_ppr, null);
    const positionAdp = safeNumber(stats.pos_adp_dd_ppr, null);

    if (adp === null) continue;

    const key = String(sleeperId);

    if (!bySleeperId.has(key)) {
      bySleeperId.set(key, {
        sleeperId: key,
        adpValues: [],
        positionAdpValues: [],
        rawRows: [],
      });
    }

    const record = bySleeperId.get(key);

    record.adpValues.push(adp);

    if (positionAdp !== null) {
      record.positionAdpValues.push(positionAdp);
    }

    record.rawRows.push(row);
  }

  const sleeperAdp = [];

  for (const [sleeperId, record] of bySleeperId.entries()) {
    const firstRow = record.rawRows[0] || {};
    const player = firstRow.player || {};
    const match = matchLookup.get(String(sleeperId));

    const adp = median(record.adpValues);
    const positionAdp = median(record.positionAdpValues);

    if (adp === null) continue;

    sleeperAdp.push({
      id: match?.espnId || null,
      espnId: match?.espnId || null,
      sleeperId,

      name: match?.name || getPlayerName(firstRow),
      sleeperName: match?.sleeperName || getPlayerName(firstRow),

      team: match?.team || firstRow.team || player.team || null,
      pos: match?.position || normalizePosition(player.position),
      position: match?.position || normalizePosition(player.position),

      adp: Math.round(adp * 10) / 10,
      positionAdp: positionAdp !== null ? Math.round(positionAdp * 10) / 10 : null,

      adpField: "adp_dd_ppr",
      positionAdpField: "pos_adp_dd_ppr",

      source: "sleeper",
      season: SEASON,
    });
  }

  sleeperAdp.sort((a, b) => {
    const aAdp = safeNumber(a.adp, 9999);
    const bAdp = safeNumber(b.adp, 9999);
    return aAdp - bAdp;
  });

  saveJson(OUTPUT_PATH, sleeperAdp);

  console.log(`Loaded ${raw.rows.length} raw Sleeper projection rows`);
  console.log(`Built ${sleeperAdp.length} Sleeper ADP records`);
  console.log(`Saved Sleeper ADP to ${OUTPUT_PATH}`);

  console.log();
  console.log("Top 25 Sleeper ADP:");
  console.table(
    sleeperAdp.slice(0, 25).map((player) => ({
      name: player.name,
      team: player.team,
      pos: player.pos,
      adp: player.adp,
      positionAdp: player.positionAdp,
      sleeperId: player.sleeperId,
      espnId: player.espnId,
    }))
  );
}

main();