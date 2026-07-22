const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { chromium } = require("playwright");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const HISTORY_PATH = path.join(PROJECT_ROOT, "data", "mock_drafts", "yahoo_mock_history.json");
const SUMMARY_PATH = path.join(PROJECT_ROOT, "data", "mock_drafts", "mock_adp_summary.json");

const YAHOO_MOCK_LOBBY_URL =
  process.env.YAHOO_MOCK_LOBBY_URL ||
  "https://football.fantasysports.yahoo.com/f1/mock_lobby";

const RUNS = Number(process.env.RUNS || 1);
const PUSH_TO_GIT = process.env.PUSH_TO_GIT === "1";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso() {
  return new Date().toISOString();
}

function loadJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function saveJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
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

function buildSummary(completedDrafts) {
  const map = new Map();

  for (const draft of completedDrafts) {
    const seen = new Set();

    for (const pick of draft.picks || []) {
      const key = normalizeName(pick.name);
      const overall = Number(pick.overall);

      if (!key || Number.isNaN(overall)) continue;
      if (seen.has(key)) continue;

      seen.add(key);

      if (!map.has(key)) {
        map.set(key, {
          name: pick.name,
          pos: pick.pos || "-",
          team: pick.team || "-",
          picks: [],
        });
      }

      const record = map.get(key);

      record.name = pick.name || record.name;
      record.pos = pick.pos || record.pos;
      record.team = pick.team || record.team;
      record.picks.push({
        draftId: draft.draftId,
        overall,
      });
    }
  }

  return Array.from(map.values())
    .map((record) => {
      const picks = record.picks.map((p) => p.overall);
      const avg = picks.reduce((sum, value) => sum + value, 0) / picks.length;

      return {
        name: record.name,
        pos: record.pos,
        team: record.team,
        mockDraftsSeen: picks.length,
        averagePick: Number(avg.toFixed(2)),
        earliestPick: Math.min(...picks),
        latestPick: Math.max(...picks),
        picks: record.picks,
      };
    })
    .sort((a, b) => a.averagePick - b.averagePick);
}

async function clickIfVisible(page, text, timeout = 3000) {
  const locator = page.getByText(text, { exact: false }).first();

  try {
    await locator.waitFor({ state: "visible", timeout });
    await locator.click();
    return true;
  } catch {
    return false;
  }
}

async function pageLooksLikeDraftRoom(page) {
  const url = page.url();

  if (url.includes("/draftclient/")) return true;
  if (url.includes("/mock_waiting")) return true;
  if (!url.includes("/mock_lobby")) return true;

  const bodyText = await page.locator("body").innerText().catch(() => "");
  const lower = bodyText.toLowerCase();

  return (
    lower.includes("auto draft") ||
    lower.includes("autodraft") ||
    lower.includes("queue") ||
    lower.includes("results") ||
    lower.includes("players board") ||
    lower.includes("draft will start") ||
    lower.includes("starts in") ||
    lower.includes("leave draft")
  );
}

function getYahooLobbyPage(context, fallbackPage) {
  const yahooPages = context.pages().filter((p) =>
    p.url().includes("football.fantasysports.yahoo.com")
  );

  return (
    yahooPages.find((p) => p.url().includes("/f1/mock_lobby")) ||
    yahooPages.find((p) => p.url().includes("mock_lobby")) ||
    fallbackPage
  );
}

function getBestYahooPage(context, fallbackPage) {
  const yahooPages = context.pages().filter((p) =>
    p.url().includes("football.fantasysports.yahoo.com")
  );

  return (
    yahooPages.find((p) => p.url().includes("/draftclient/")) ||
    yahooPages.find((p) => p.url().includes("/mock_waiting")) ||
    yahooPages.find((p) => !p.url().includes("mock_lobby")) ||
    yahooPages.find((p) => p.url().includes("mock_lobby")) ||
    fallbackPage
  );
}

async function closeStaleYahooDraftTabs(context, keepPage) {
  const pages = context.pages();

  for (const candidatePage of pages) {
    if (candidatePage === keepPage) continue;

    const url = candidatePage.url();

    if (!url.includes("football.fantasysports.yahoo.com")) continue;

    const isDraftOrWaitingRoom =
      url.includes("/mock_waiting") ||
      url.includes("/draftclient/") ||
      url.includes("/mock_draft");

    if (!isDraftOrWaitingRoom) continue;

    console.log("Closing stale Yahoo draft tab:", url);

    await candidatePage.close().catch(() => {});
  }
}

async function navigateToMockLobbyIfNeeded(page) {
  const currentUrl = page.url();

  if (currentUrl.includes("football.fantasysports.yahoo.com/f1/mock_lobby")) {
    console.log("Already on Yahoo mock lobby. Skipping navigation.");
    return page;
  }

  console.log("Navigating to Yahoo mock lobby...");

  try {
    await page.goto(YAHOO_MOCK_LOBBY_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
  } catch (error) {
    console.log("page.goto failed. Trying browser-side navigation instead...");
    console.log(error.message);

    await page.evaluate((url) => {
      window.location.href = url;
    }, YAHOO_MOCK_LOBBY_URL);

    await page.waitForLoadState("domcontentloaded", {
      timeout: 60000,
    }).catch(() => {});
  }

  return page;
}

async function prepareYahooLobbyPage(page) {
  let lobbyPage = getYahooLobbyPage(page.context(), page);

  lobbyPage = await navigateToMockLobbyIfNeeded(lobbyPage);

  await lobbyPage.bringToFront().catch(() => {});
  await sleep(3000);

  await closeStaleYahooDraftTabs(lobbyPage.context(), lobbyPage);

  return lobbyPage;
}

async function click12TeamByMouse(page) {
  console.log("Clicking 12 Team by mouse position...");

  const lobbyPage = getYahooLobbyPage(page.context(), page);

  await lobbyPage.bringToFront().catch(() => {});
  await sleep(1500);

  const viewport = lobbyPage.viewportSize();

  console.log("Viewport:", viewport);

  const x = Number(process.env.DRAFTIQ_12_TEAM_X || 541);
  const y = Number(process.env.DRAFTIQ_12_TEAM_Y || 369);

  console.log(`Moving mouse to 12 Team at x=${x}, y=${y}`);

  await lobbyPage.mouse.move(x, y, {
    steps: 25,
  });

  await sleep(700);

  await lobbyPage.mouse.click(x, y, {
    button: "left",
    delay: 150,
  });

  await sleep(4000);

  console.log("Mouse clicked 12 Team.");

  return lobbyPage;
}

async function joinMockDraft(page) {
  console.log("Opening Yahoo mock lobby...");

  page = await prepareYahooLobbyPage(page);

  console.log("Joining a 12-team mock draft...");

  page = await click12TeamByMouse(page);

  const start = Date.now();
  const timeout = 90 * 1000;

  while (Date.now() - start < timeout) {
    const bestPage = getBestYahooPage(page.context(), page);
    const url = bestPage.url();

    console.log("Current Yahoo page:", url);

    if (
      url.includes("/mock_waiting") ||
      url.includes("/draftclient/") ||
      (await pageLooksLikeDraftRoom(bestPage))
    ) {
      console.log("12-team waiting room or draft room detected.");
      console.log("Continuing with page:", bestPage.url());
      return bestPage;
    }

    await sleep(2000);
  }

  const fallbackPage = getBestYahooPage(page.context(), page);

  console.log("12 Team clicked, but waiting room was not clearly detected yet.");
  console.log("Continuing with page:", fallbackPage.url());

  return fallbackPage;
}

async function waitForDraftRoom(page) {
  console.log("Waiting for draft room...");

  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await sleep(5000);

  const start = Date.now();
  const timeout = 10 * 60 * 1000;

  while (Date.now() - start < timeout) {
    const bestPage = getBestYahooPage(page.context(), page);
    const bodyText = await bestPage.locator("body").innerText().catch(() => "");

    if (
      /draft/i.test(bodyText) &&
      (/auto/i.test(bodyText) ||
        /queue/i.test(bodyText) ||
        /results/i.test(bodyText) ||
        /starts in/i.test(bodyText) ||
        /leave draft/i.test(bodyText))
    ) {
      console.log("Draft room detected.");
      console.log("Using page:", bestPage.url());
      return bestPage;
    }

    await sleep(5000);
  }

  throw new Error("Timed out waiting for draft room.");
}

async function enableAutoDraft(page) {
  console.log("Trying to enable Auto Draft...");

  const clicked =
    (await clickIfVisible(page, "Auto Draft", 5000)) ||
    (await clickIfVisible(page, "Autodraft", 3000)) ||
    (await clickIfVisible(page, "Auto-Pick", 3000)) ||
    (await clickIfVisible(page, "Auto Pick", 3000));

  if (clicked) {
    console.log("Clicked Auto Draft control.");
  } else {
    console.log("Could not find Auto Draft button. You may need to click it manually this run.");
  }
}

async function waitForDraftComplete(page) {
  console.log("Waiting for draft to complete...");

  const start = Date.now();
  const timeout = 90 * 60 * 1000;

  while (Date.now() - start < timeout) {
    const bestPage = getBestYahooPage(page.context(), page);
    const bodyText = await bestPage.locator("body").innerText().catch(() => "");
    const lower = bodyText.toLowerCase();

    if (
      lower.includes("draft results") ||
      (lower.includes("results") && lower.includes("round") && lower.includes("pick"))
    ) {
      const clickedResults =
        (await clickIfVisible(bestPage, "Results", 1000)) ||
        (await clickIfVisible(bestPage, "Draft Results", 1000));

      if (clickedResults) {
        await sleep(3000);
      }

      const picks = await scrapeDraftResults(bestPage);

      if (picks.length >= 100) {
        console.log(`Draft appears complete. Picks found: ${picks.length}`);
        return picks;
      }
    }

    await sleep(10000);
  }

  throw new Error("Timed out waiting for draft completion.");
}

function parseDraftLines(lines) {
  const picks = [];

  for (const line of lines) {
    const cleaned = String(line || "").replace(/\s+/g, " ").trim();

    if (!cleaned) continue;

    const patterns = [
      /^(\d+)\s+(.+?)\s+(QB|RB|WR|TE|K|PK|DEF|DST)\s+([A-Z]{2,3})\b/i,
      /(?:Pick|Overall)\s*(\d+)\s+(.+?)\s+(QB|RB|WR|TE|K|PK|DEF|DST)\s+([A-Z]{2,3})\b/i,
      /^(\d+)\.\s+(.+?)\s+(QB|RB|WR|TE|K|PK|DEF|DST)\s+([A-Z]{2,3})\b/i,
    ];

    for (const pattern of patterns) {
      const match = cleaned.match(pattern);

      if (!match) continue;

      const overall = Number(match[1]);
      const name = match[2].trim();
      const pos = match[3].toUpperCase() === "DST" ? "DEF" : match[3].toUpperCase();
      const team = match[4].toUpperCase();

      if (!Number.isNaN(overall) && name) {
        picks.push({
          overall,
          round: Math.ceil(overall / 12),
          pickInRound: ((overall - 1) % 12) + 1,
          name,
          pos,
          team,
        });
      }

      break;
    }
  }

  const deduped = [];
  const seen = new Set();

  for (const pick of picks.sort((a, b) => a.overall - b.overall)) {
    const key = `${pick.overall}:${normalizeName(pick.name)}`;

    if (seen.has(key)) continue;

    seen.add(key);
    deduped.push(pick);
  }

  return deduped;
}

async function scrapeDraftResults(page) {
  await clickIfVisible(page, "Results", 2000);
  await sleep(3000);

  const lines = await page.evaluate(() => {
    const rowTexts = Array.from(
      document.querySelectorAll("tr, li, [role='row'], div")
    )
      .map((el) => (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .filter((text) => text.length < 300);

    const bodyLines = (document.body.innerText || "")
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    return Array.from(new Set([...rowTexts, ...bodyLines]));
  });

  const picks = parseDraftLines(lines);

  if (!picks.length) {
    const debugPath = path.join(
      PROJECT_ROOT,
      "data",
      "mock_drafts",
      "last_yahoo_results_debug.json"
    );

    saveJson(debugPath, lines.slice(0, 500));

    console.log(`No picks parsed. Debug saved to ${debugPath}`);
  }

  return picks;
}

function saveCompletedDraft(picks) {
  const history = loadJson(HISTORY_PATH, {
    updatedAt: null,
    completedDrafts: [],
  });

  const draftId = `yahoo-mock-${nowIso()}`;

  const draft = {
    draftId,
    source: "yahoo",
    leagueSize: 12,
    completedAt: nowIso(),
    totalPicks: picks.length,
    picks,
  };

  const completedDrafts = history.completedDrafts || [];
  completedDrafts.push(draft);

  const nextHistory = {
    updatedAt: nowIso(),
    completedDrafts,
  };

  const summary = buildSummary(completedDrafts);

  saveJson(HISTORY_PATH, nextHistory);
  saveJson(SUMMARY_PATH, summary);

  console.log(`Saved draft: ${draftId}`);
  console.log(`Picks saved: ${picks.length}`);
  console.log(`Total mock drafts tracked: ${completedDrafts.length}`);
  console.table(summary.slice(0, 25));

  return draft;
}

function gitCommitAndPush() {
  if (!PUSH_TO_GIT) return;

  console.log("Committing and pushing mock draft history...");

  execFileSync(
    "git",
    ["add", "data/mock_drafts/yahoo_mock_history.json", "data/mock_drafts/mock_adp_summary.json"],
    {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
    }
  );

  execFileSync("git", ["commit", "-m", "Update Yahoo mock draft history"], {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
  });

  execFileSync("git", ["push"], {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
  });
}

async function runOneMock(page, index) {
  console.log(`\n========== Mock Draft ${index} ==========\n`);

  page = await joinMockDraft(page);
  page = await waitForDraftRoom(page);

  await enableAutoDraft(page);

  const picks = await waitForDraftComplete(page);

  saveCompletedDraft(picks);
  gitCommitAndPush();

  return page;
}

async function main() {
  console.log("Connecting to manually opened Chrome on port 9222...");

  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const context = browser.contexts()[0];

  if (!context) {
    throw new Error(
      "No Chrome context found. Make sure manual Chrome is open with --remote-debugging-port=9222."
    );
  }

  let page =
    context.pages().find((p) =>
      p.url().includes("football.fantasysports.yahoo.com/f1/mock_lobby")
    ) ||
    context.pages().find((p) =>
      p.url().includes("football.fantasysports.yahoo.com")
    ) ||
    context.pages()[0];

  if (!page) {
    page = await context.newPage();
    await navigateToMockLobbyIfNeeded(page);
  }

  console.log("Connected to manual Chrome session.");
  console.log("Using page:", page.url());

  for (let i = 1; i <= RUNS; i += 1) {
    page = await runOneMock(page, i);

    if (i < RUNS) {
      console.log("Waiting before next mock...");
      await sleep(30000);
    }
  }

  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});