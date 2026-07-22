const test = require("node:test");
const assert = require("node:assert/strict");

const Core = require("../draftiq-core.js");

test("normalizes league settings and keeps draft slot in range", () => {
  const settings = Core.normalizeLeagueSettings({
    teamCount: 10,
    draftSlot: 14,
    qb: 2,
    scoring: "ppr",
  });

  assert.equal(settings.teamCount, 10);
  assert.equal(settings.draftSlot, 10);
  assert.equal(settings.qb, 2);
  assert.equal(settings.scoring, "ppr");
});

test("calculates snake-draft picks from the configured slot", () => {
  assert.equal(Core.getOverallPick(1, 3, 12), 3);
  assert.equal(Core.getOverallPick(2, 3, 12), 22);
  assert.equal(Core.getOverallPick(3, 3, 12), 27);
  assert.equal(Core.getOverallPick(4, 3, 12), 46);
});

test("finds the next and following user turns", () => {
  const onClock = Core.getUserPickContext(3, {
    teamCount: 12,
    draftSlot: 3,
  });

  assert.equal(onClock.isUserTurn, true);
  assert.equal(onClock.nextUserPick, 3);
  assert.equal(onClock.followingUserPick, 22);
  assert.equal(onClock.lookaheadPick, 22);

  const waiting = Core.getUserPickContext(10, {
    teamCount: 12,
    draftSlot: 3,
  });

  assert.equal(waiting.isUserTurn, false);
  assert.equal(waiting.nextUserPick, 22);
  assert.equal(waiting.picksUntilNext, 12);
});

test("calculates roster needs from custom league requirements", () => {
  const needs = Core.getRosterNeeds(
    { QB: 1, RB: 2, WR: 2, TE: 0 },
    { qb: 1, rb: 2, wr: 3, te: 1, flex: 2 }
  );

  assert.deepEqual(needs.baseNeeds, {
    QB: 0,
    RB: 0,
    WR: 1,
    TE: 1,
  });
  assert.equal(needs.flexNeed, 2);
  assert.equal(needs.startersFilled, false);
});

test("detects the last player before a position tier drop", () => {
  const players = [
    { id: "a", name: "Alpha", pos: "RB", rank: 9, tier: 1 },
    { id: "b", name: "Beta", pos: "RB", rank: 18, tier: 2 },
    { id: "c", name: "Gamma", pos: "WR", rank: 10, tier: 1 },
  ];

  const warning = Core.getTierDropWarning(players[0], players);

  assert.equal(warning.severity, "high");
  assert.match(warning.message, /Last Tier 1 RB/);
});

test("flags players unlikely to survive to the following pick", () => {
  const urgency = Core.getAvailabilityUrgency({ adp: 15 }, 22);

  assert.equal(urgency.likelyGone, true);
  assert.ok(urgency.score > 0);

  const wait = Core.getAvailabilityUrgency({ adp: 40 }, 22);

  assert.equal(wait.canWait, true);
  assert.ok(wait.score < 0);
});
