const test = require("node:test");
const assert = require("node:assert/strict");

function createChromeStorage(initial = {}) {
  const state = { ...initial };

  return {
    state,
    chrome: {
      storage: {
        local: {
          async get(keys) {
            return (keys || []).reduce((result, key) => {
              if (Object.prototype.hasOwnProperty.call(state, key)) {
                result[key] = state[key];
              }

              return result;
            }, {});
          },
          async set(values) {
            Object.assign(state, values);
          },
          async remove(keys) {
            keys.forEach((key) => delete state[key]);
          },
        },
      },
    },
  };
}

test("updates personal ADP analytics after every recorded pick", async () => {
  const storage = createChromeStorage();
  const messageListeners = [];

  global.chrome = storage.chrome;
  global.window = {
    addEventListener(type, listener) {
      if (type === "message") messageListeners.push(listener);
    },
    postMessage() {},
  };

  const modulePath = require.resolve("../mock-history.js");
  delete require.cache[modulePath];
  require(modulePath);

  const history = global.window.DraftIQMockHistory;

  await history.startDraft("draft-a", {
    source: "yahoo",
    teamCount: 12,
    draftSlot: 7,
    scoring: "ppr",
  });
  await history.recordPick({
    draftId: "draft-a",
    source: "yahoo",
    teamCount: 12,
    draftSlot: 7,
    scoring: "ppr",
    pickNumber: 18,
    playerId: "alpha-id",
    name: "Alpha Runner",
    pos: "RB",
  });

  let analytics = await history.getAnalytics();
  let alpha = analytics.players.find(
    (player) => player.normalizedName === "alpha runner"
  );

  assert.equal(analytics.drafts.length, 1);
  assert.equal(analytics.drafts[0].depth, 18);
  assert.equal(analytics.drafts[0].teamCount, 12);
  assert.equal(analytics.drafts[0].draftSlot, 7);
  assert.deepEqual(
    analytics.drafts[0].userPicks.map((pick) => pick.name),
    ["Alpha Runner"]
  );
  assert.deepEqual(
    analytics.drafts[0].picks.map((pick) => pick.name),
    ["Alpha Runner"]
  );
  assert.equal(alpha.averagePick, 18);
  assert.equal(alpha.playerId, "alpha-id");

  await history.recordPick({
    draftId: "draft-a",
    source: "yahoo",
    teamCount: 12,
    draftSlot: 7,
    scoring: "ppr",
    pickNumber: 24,
    name: "Beta Receiver",
    pos: "WR",
  });

  analytics = await history.getAnalytics();
  alpha = analytics.players.find(
    (player) => player.normalizedName === "alpha runner"
  );

  assert.equal(analytics.drafts[0].depth, 24);
  assert.deepEqual(alpha.picks, [{ draftId: "draft-a", overall: 18 }]);
  assert.equal(
    storage.state.draftCopilotMockAdpSummary[0].normalizedName,
    "alpha runner"
  );

  await history.saveCompletedDraft("draft-a");
  analytics = await history.getAnalytics();

  assert.equal(analytics.drafts[0].completed, true);
  assert.equal(storage.state.draftCopilotMockDraftHistory.length, 1);

  await history.startDraft("legacy-room-8", {
    source: "yahoo",
    teamCount: 12,
    scoring: "ppr",
  });
  await history.recordPick({
    draftId: "legacy-room-8",
    source: "yahoo",
    teamCount: 12,
    scoring: "ppr",
    pickNumber: 8,
    name: "Legacy Slot Receiver",
    pos: "WR",
  });
  analytics = await history.getAnalytics();

  const legacyDraft = analytics.drafts.find(
    (draft) => draft.draftId === "legacy-room-8"
  );

  assert.equal(legacyDraft.draftSlot, 8);
  assert.deepEqual(
    legacyDraft.userPicks.map((pick) => pick.name),
    ["Legacy Slot Receiver"]
  );

  delete global.window;
  delete global.chrome;
  delete require.cache[modulePath];
});
