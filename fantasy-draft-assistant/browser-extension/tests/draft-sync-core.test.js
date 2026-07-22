const test = require("node:test");
const assert = require("node:assert/strict");

const SyncCore = require("../draft-sync-core.js");

test("detects supported draft platforms", () => {
  assert.deepEqual(SyncCore.detectPlatform("fantasysports.yahoo.com"), {
    key: "yahoo",
    label: "Yahoo",
    supported: true,
    adapter: "page",
  });
  assert.equal(SyncCore.detectPlatform("fantasy.espn.com").key, "espn");
  assert.equal(SyncCore.detectPlatform("sleeper.com").adapter, "api");
  assert.equal(SyncCore.detectPlatform("fantasy.nfl.com").supported, false);
});

test("extracts platform-specific draft session IDs", () => {
  assert.equal(
    SyncCore.getDraftSessionId(
      { pathname: "/football/draft", search: "?leagueId=123456" },
      "espn"
    ),
    "espn-123456"
  );
  assert.equal(
    SyncCore.getRawDraftId(
      { pathname: "/draft/nfl/987654321012345678", search: "" },
      "sleeper"
    ),
    "987654321012345678"
  );
  assert.equal(
    SyncCore.getDraftSessionId(
      { pathname: "/draftclient/f1/444/555", search: "" },
      "yahoo"
    ),
    "444-555"
  );
});

test("parses ESPN and Sleeper player-card text", () => {
  assert.deepEqual(
    SyncCore.extractPlayerInfo("Pick 7 Ja'Marr Chase WR - CIN", "espn"),
    {
      name: "Ja'Marr Chase",
      pos: "WR",
      team: "CIN",
      pickNumber: 7,
      sourceType: "espn-pick",
    }
  );

  assert.deepEqual(
    SyncCore.extractPlayerInfo("Bijan Robinson ATL RB", "sleeper"),
    {
      name: "Bijan Robinson",
      pos: "RB",
      team: "ATL",
      pickNumber: null,
      sourceType: "sleeper-pick",
    }
  );
});

test("normalizes a Sleeper API pick", () => {
  assert.deepEqual(
    SyncCore.parseSleeperPick({
      player_id: "9999",
      picked_by: "user-1",
      roster_id: "4",
      draft_slot: 3,
      pick_no: 27,
      metadata: {
        first_name: "Amon-Ra",
        last_name: "St. Brown",
        position: "WR",
        team: "DET",
      },
    }),
    {
      name: "Amon-Ra St. Brown",
      pos: "WR",
      team: "DET",
      pickNumber: 27,
      playerId: "9999",
      pickedBy: "user-1",
      rosterId: "4",
      draftSlot: 3,
      sourceType: "sleeper-api",
    }
  );
});

test("parses a Yahoo draft-board card with its exact overall pick", () => {
  assert.deepEqual(
    SyncCore.parseYahooBoardPick("KHALIL SHAKIR WR Â· Buf 13.3", 12),
    {
      name: "KHALIL SHAKIR",
      pos: "WR",
      team: "BUF",
      pickNumber: 147,
      round: 13,
      roundPick: 3,
      sourceType: "yahoo-board-card",
    }
  );
});

test("reads Yahoo's authoritative current overall pick", () => {
  assert.deepEqual(
    SyncCore.parseYahooCurrentPick(
      "Jayantillal's Pick You're up in 19 Picks Round 6, Pick 65",
      12
    ),
    {
      overall: 65,
      round: 6,
      roundPick: 5,
      sourceType: "yahoo-draft-header",
    }
  );

  assert.deepEqual(
    SyncCore.parseYahooCurrentPick("ON THE CLOCK 13.8", 12),
    {
      overall: 152,
      round: 13,
      roundPick: 8,
      sourceType: "yahoo-on-clock-cell",
    }
  );
});

test("uses Sleeper roster mapping for traded picks", () => {
  const draft = { slot_to_roster_id: { "3": 14 } };

  assert.equal(
    SyncCore.sleeperPickBelongsToSlot(
      { draft_slot: 8, roster_id: 14 },
      draft,
      3
    ),
    true
  );
  assert.equal(
    SyncCore.sleeperPickBelongsToSlot(
      { draft_slot: 3, roster_id: 2 },
      draft,
      3
    ),
    false
  );
});

test("converts an overall snake pick into its original draft slot", () => {
  assert.equal(SyncCore.getSnakeDraftSlot(7, 12), 7);
  assert.equal(SyncCore.getSnakeDraftSlot(18, 12), 7);
  assert.equal(SyncCore.getSnakeDraftSlot(31, 12), 7);
  assert.equal(SyncCore.getSnakeDraftSlot(0, 12), null);
});

test("detects labeled Yahoo league and roster settings", () => {
  const result = SyncCore.parseYahooLeagueSettings(`
    12-Team League · Half PPR
    Your Draft Position: 7th
    Roster Positions
    QB 1 · RB 2 · WR 3 · TE 1 · W/R/T 2 · BN 6
  `);

  assert.deepEqual(result.settings, {
    teamCount: 12,
    draftSlot: 7,
    scoring: "half-ppr",
    qb: 1,
    rb: 2,
    wr: 3,
    te: 1,
    flex: 2,
    bench: 6,
  });
  assert.equal(result.confidence, "high");
});

test("detects the Yahoo mock waiting-room draft slot", () => {
  const result = SyncCore.parseYahooLeagueSettings(`
    Mock Draft Starts In 01:00
    You will draft 12th
    Roster Positions QB, WR, WR, RB, RB, TE, W/R/T, K, DEF
  `);

  assert.equal(result.settings.draftSlot, 12);
  assert.ok(result.detectedFields.includes("draftSlot"));
});

test("does not infer Yahoo settings from ordinary player and pick text", () => {
  const result = SyncCore.parseYahooLeagueSettings(
    "Players QB RB WR TE Pick 7 Bijan Robinson ATL RB"
  );

  assert.deepEqual(result.settings, {});
  assert.equal(result.confidence, "none");
});

test("does not mistake adjacent Yahoo participant names for a team count", () => {
  const result = SyncCore.parseYahooLeagueSettings(
    "Jayantillal Angel Muhaimin kai khong Ana Team 2 7 Team 2 Ana"
  );

  assert.equal(result.settings.teamCount, undefined);
  assert.ok(!result.detectedFields.includes("teamCount"));
});

test("infers Yahoo team count from complete draft-board pick labels", () => {
  const pickLabels = [];

  for (let round = 1; round <= 3; round += 1) {
    for (let slot = 1; slot <= 12; slot += 1) {
      pickLabels.push(`${round}.${slot}`);
    }
  }

  const result = SyncCore.parseYahooLeagueSettings(pickLabels.join("\n"));

  assert.equal(result.settings.teamCount, 12);
  assert.ok(result.detectedFields.includes("teamCount"));
});
