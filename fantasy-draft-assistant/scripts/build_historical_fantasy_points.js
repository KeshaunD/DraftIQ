const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const DATA_JS = path.join(ROOT, "browser-extension", "data.js");
const CACHE_FILE = path.join(
  ROOT,
  "data",
  "historical_fantasy_points_2023_2025.json"
);
const EXTENSION_FILE = path.join(
  ROOT,
  "browser-extension",
  "historical-points.js"
);
const SEASONS = [2023, 2024, 2025];
const FETCH_SEASONS = [2023, 2024];
const CONCURRENCY = 6;

function readPlayers() {
  const source = `${fs.readFileSync(DATA_JS, "utf8")};globalThis.players=DRAFT_COPILOT_PLAYERS;`;
  const context = {};

  vm.createContext(context);
  vm.runInContext(source, context);

  return Array.isArray(context.players) ? context.players : [];
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculatePprPoints(stats = {}) {
  return (
    number(stats.passingYards) * 0.04 +
    number(stats.passingTouchdowns) * 4 -
    number(stats.interceptions) * 2 +
    number(stats.rushingYards) * 0.1 +
    number(stats.rushingTouchdowns) * 6 +
    number(stats.receptions) +
    number(stats.receivingYards) * 0.1 +
    number(stats.receivingTouchdowns) * 6 -
    number(stats.fumblesLost) * 2
  );
}

function summarizeCurrentGameLog(player) {
  const games = Array.isArray(player?.stats?.gameLog)
    ? player.stats.gameLog
    : [];
  const points = games.reduce(
    (total, game) => total + number(game.fantasyPoints),
    0
  );

  return {
    games: games.length,
    points: Math.round(points * 10) / 10,
  };
}

function parseEspnGameLog(payload) {
  const names = Array.isArray(payload?.names) ? payload.names : [];
  const games = [];

  for (const seasonType of payload?.seasonTypes || []) {
    for (const category of seasonType?.categories || []) {
      if (category?.displayName !== "Regular Season Stats") continue;

      for (const event of category?.events || []) {
        const stats = Object.fromEntries(
          names.map((name, index) => [name, event?.stats?.[index]])
        );

        games.push(calculatePprPoints(stats));
      }
    }
  }

  return {
    games: games.length,
    points: Math.round(
      games.reduce((total, points) => total + points, 0) * 10
    ) / 10,
  };
}

async function fetchSeason(espnId, season) {
  const url =
    "https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/" +
    `athletes/${espnId}/gamelog?season=${season}`;
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`ESPN returned ${response.status}`);
      }

      return parseEspnGameLog(await response.json());
    } catch (error) {
      lastError = error;

      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 400));
      }
    }
  }

  throw lastError;
}

async function runPool(tasks, worker) {
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < tasks.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(tasks[index], index);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(CONCURRENCY, tasks.length) },
      runWorker
    )
  );
}

async function main() {
  const players = readPlayers();
  const cache = fs.existsSync(CACHE_FILE)
    ? JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"))
    : {};
  const tasks = [];

  for (const player of players) {
    const espnId = String(player?.id || "").trim();

    if (!/^\d+$/.test(espnId)) continue;

    cache[espnId] ||= {
      name: player.name,
      pos: player.pos,
      seasons: {},
    };
    cache[espnId].name = player.name;
    cache[espnId].pos = player.pos;
    cache[espnId].seasons[2025] = summarizeCurrentGameLog(player);

    for (const season of FETCH_SEASONS) {
      if (!cache[espnId].seasons[season]) {
        tasks.push({ espnId, season, name: player.name });
      }
    }
  }

  let completed = 0;
  let failed = 0;

  await runPool(tasks, async (task) => {
    try {
      cache[task.espnId].seasons[task.season] = await fetchSeason(
        task.espnId,
        task.season
      );
    } catch (error) {
      failed += 1;
      cache[task.espnId].seasons[task.season] = {
        games: 0,
        points: 0,
        error: String(error?.message || error),
      };
    }

    completed += 1;

    if (completed % 25 === 0 || completed === tasks.length) {
      console.log(`Fetched ${completed}/${tasks.length} historical seasons`);
    }
  });

  const ordered = Object.fromEntries(
    Object.entries(cache)
      .filter(([, player]) =>
        SEASONS.some((season) => player?.seasons?.[season])
      )
      .sort(([left], [right]) => Number(left) - Number(right))
  );

  fs.writeFileSync(CACHE_FILE, `${JSON.stringify(ordered, null, 2)}\n`);
  fs.writeFileSync(
    EXTENSION_FILE,
    `const DRAFT_COPILOT_HISTORICAL_POINTS = ${JSON.stringify(ordered, null, 2)};\n`
  );

  console.log(`Saved ${Object.keys(ordered).length} player histories.`);
  console.log(`Failed season fetches: ${failed}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
