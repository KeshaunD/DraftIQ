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
