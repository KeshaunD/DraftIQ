const test = require("node:test");
const assert = require("node:assert/strict");

const Core = require("../draftiq-core.js");

test("normalizes league settings and keeps draft slot in range", () => {
  assert.equal(Core.normalizeLeagueSettings().scoring, "ppr");

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

test("converts overall picks back into snake draft slots", () => {
  assert.equal(Core.getSnakeDraftSlot(3, 12), 3);
  assert.equal(Core.getSnakeDraftSlot(13, 12), 12);
  assert.equal(Core.getSnakeDraftSlot(22, 12), 3);
  assert.equal(Core.getSnakeDraftSlot(27, 12), 3);
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

test("lists the next three snake-draft selections for the user", () => {
  assert.deepEqual(
    Core.getUpcomingUserPicks(
      8,
      { teamCount: 12, draftSlot: 8 },
      3
    ),
    [8, 17, 32]
  );
  assert.deepEqual(
    Core.getUpcomingUserPicks(
      9,
      { teamCount: 12, draftSlot: 8 },
      3
    ),
    [17, 32, 41]
  );
});

test("lists the draft slots selecting before the user's next turn", () => {
  const betweenTurns = Core.getInterveningDraftSlots(3, {
    teamCount: 12,
    draftSlot: 3,
  });

  assert.equal(betweenTurns.firstPick, 4);
  assert.equal(betweenTurns.lastPick, 21);
  assert.equal(betweenTurns.pickSlots.length, 18);
  assert.deepEqual(betweenTurns.slots, [
    4, 5, 6, 7, 8, 9, 10, 11, 12,
  ]);

  const waiting = Core.getInterveningDraftSlots(10, {
    teamCount: 12,
    draftSlot: 3,
  });

  assert.equal(waiting.firstPick, 10);
  assert.equal(waiting.lastPick, 21);
  assert.equal(waiting.pickSlots.length, 12);

  const turnPick = Core.getInterveningDraftSlots(12, {
    teamCount: 12,
    draftSlot: 12,
  });

  assert.equal(turnPick.nextUserPick, 13);
  assert.equal(turnPick.pickSlots.length, 0);
});

test("learns positional opening tendencies independently by draft slot", () => {
  const makeDraft = (draftId, positions) => ({
    draftId,
    source: "yahoo",
    teamCount: 4,
    completed: true,
    picks: positions.map((pos, index) => ({
      overall: [1, 8, 9][index],
      pos,
    })),
  });
  const tendencies = Core.getDraftSlotPositionTendencies(
    [
      makeDraft("a", ["RB", "WR", "WR"]),
      makeDraft("b", ["WR", "RB", "RB"]),
      makeDraft("c", ["RB", "WR", "RB"]),
    ],
    { teamCount: 4, source: "yahoo", openingRounds: 3 }
  );

  assert.equal(tendencies.sampleDrafts, 3);
  assert.equal(tendencies.slots[1].sampleDrafts, 3);
  assert.equal(tendencies.slots[1].rounds[1].probabilities.RB, 66.7);
  assert.equal(
    tendencies.slots[1].openingSequences.find(
      (opening) => opening.sequence === "RB>WR>WR"
    ).count,
    1
  );

  const nextPick = Core.getDraftSlotNextPositionProbabilities(
    tendencies,
    1,
    ["RB", "WR"],
    3
  );

  assert.equal(nextPick.matchedOpeningPrefix, "RB>WR");
  assert.equal(nextPick.transitionSampleSize, 2);
  assert.ok(nextPick.probabilities.RB > nextPick.probabilities.QB);
  assert.ok(nextPick.probabilities.WR > nextPick.probabilities.TE);
});

test("learns player tendencies by snake draft slot and round", () => {
  const makeDraft = (draftId, picks) => ({
    draftId,
    source: "yahoo",
    teamCount: 4,
    completed: true,
    picks,
  });
  const tendencies = Core.getDraftSlotPlayerTendencies(
    [
      makeDraft("a", [
        { overall: 2, name: "Alpha Runner", playerId: "alpha", pos: "RB" },
        { overall: 7, name: "Beta Receiver", pos: "WR" },
      ]),
      makeDraft("b", [
        { overall: 2, name: "Alpha Runner", pos: "RB" },
        { overall: 7, name: "Gamma Tight End", pos: "TE" },
      ]),
      makeDraft("c", [
        { overall: 2, name: "Delta Runner", pos: "RB" },
        { overall: 7, name: "Alpha Runner", playerId: "alpha", pos: "RB" },
      ]),
      makeDraft("d", [
        { overall: 2, name: "Alpha Runner", pos: "RB" },
      ]),
      {
        draftId: "ignored-incomplete",
        source: "yahoo",
        teamCount: 4,
        completed: false,
        picks: [{ overall: 2, name: "Alpha Runner", pos: "RB" }],
      },
    ],
    { teamCount: 4, source: "yahoo" }
  );

  assert.equal(tendencies.sampleDrafts, 4);
  assert.equal(tendencies.slots[2].sampleDrafts, 4);
  assert.equal(tendencies.slots[2].rounds[1].sampleSize, 4);

  const alphaRoundOne = tendencies.slots[2].rounds[1].players.find(
    (player) => player.name === "Alpha Runner"
  );

  assert.equal(alphaRoundOne.count, 3);
  assert.equal(alphaRoundOne.probability, 75);

  const risk = Core.getPlayerDraftSlotSelectionRisk(
    tendencies,
    { name: "Alpha Runner", id: "alpha" },
    [
      { overall: 2, slot: 2 },
      { overall: 7, slot: 2 },
    ]
  );

  assert.equal(risk.matches.length, 2);
  assert.equal(risk.evidenceCount, 4);
  assert.ok(risk.goneProbability > 0);
  assert.ok(risk.score > 0);
  assert.equal(risk.strongestMatch.round, 1);
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

test("maps composite position ranks to S through D tiers", () => {
  assert.deepEqual(Core.getPositionTier(1), { tier: 1, tierLabel: "S" });
  assert.deepEqual(Core.getPositionTier(5), { tier: 1, tierLabel: "S" });
  assert.deepEqual(Core.getPositionTier(7), { tier: 1, tierLabel: "S" });
  assert.deepEqual(Core.getPositionTier(8), { tier: 2, tierLabel: "A" });
  assert.deepEqual(Core.getPositionTier(12), { tier: 2, tierLabel: "A" });
  assert.deepEqual(Core.getPositionTier(13), { tier: 3, tierLabel: "B" });
  assert.deepEqual(Core.getPositionTier(25), { tier: 4, tierLabel: "C" });
  assert.deepEqual(Core.getPositionTier(37), { tier: 5, tierLabel: "D" });
  assert.deepEqual(Core.getPositionTier(null), { tier: 5, tierLabel: "D" });
});

test("uses total season scoring and adjusts receptions for league format", () => {
  const player = {
    stats: {
      gameLog: [
        { fantasyPoints: 20, receptions: 6 },
        { fantasyPoints: 10, receptions: 2 },
      ],
    },
  };

  assert.equal(Core.getPreviousSeasonFantasyPoints(player, "ppr"), 30);
  assert.equal(Core.getPreviousSeasonFantasyPoints(player, "half-ppr"), 26);
  assert.equal(Core.getPreviousSeasonFantasyPoints(player, "standard"), 22);
});

test("calculates league-specific value over replacement", () => {
  const players = [
    ...Array.from({ length: 30 }, (_, index) => ({
      id: `rb-${index}`,
      pos: "RB",
      projection: 300 - index * 5,
    })),
    ...Array.from({ length: 40 }, (_, index) => ({
      id: `wr-${index}`,
      pos: "WR",
      projection: 310 - index * 4,
    })),
    ...Array.from({ length: 14 }, (_, index) => ({
      id: `qb-${index}`,
      pos: "QB",
      projection: 350 - index * 6,
    })),
    ...Array.from({ length: 14 }, (_, index) => ({
      id: `te-${index}`,
      pos: "TE",
      projection: 240 - index * 5,
    })),
  ];
  const snapshot = Core.getReplacementValueSnapshot(players, {
    teamCount: 12,
    qb: 1,
    rb: 2,
    wr: 2,
    te: 1,
    flex: 1,
    scoring: "ppr",
  });
  const eliteRb = Core.getPlayerReplacementValue(
    players[0],
    snapshot
  );

  assert.ok(snapshot.positions.RB.replacementRank > 24);
  assert.ok(snapshot.positions.WR.replacementRank > 24);
  assert.ok(eliteRb.valueOverReplacement > 0);
});

test("assigns composite tiers independently within each position", () => {
  const players = [];

  for (const position of ["RB", "WR"]) {
    for (let rank = 1; rank <= 13; rank += 1) {
      players.push({
        id: `${position}-${rank}`,
        pos: position,
        rank,
        proj: 201 - rank,
        stats: {
          gameLog: [{ fantasyPoints: 101 - rank, receptions: 0 }],
        },
      });
    }
  }

  const tiered = Core.applyFantasyPointTiers(players, "ppr");
  const find = (id) => tiered.find((player) => player.id === id);

  assert.equal(find("RB-7").tierLabel, "S");
  assert.equal(find("RB-8").tierLabel, "A");
  assert.equal(find("RB-13").tierLabel, "B");
  assert.equal(find("WR-7").tierLabel, "S");
  assert.equal(find("WR-6").lastSeasonPositionRank, 6);
  assert.equal(find("WR-6").projectedSeasonPositionRank, 6);
  assert.equal(find("WR-6").tierScore, 145);
});

test("averages up to three production seasons before blending projection", () => {
  const players = [{
    id: "veteran",
    pos: "WR",
    rank: 1,
    proj: 300,
    stats: {
      gameLog: [{ fantasyPoints: 180, receptions: 0 }],
    },
  }];
  const history = {
    veteran: {
      seasons: {
        2023: { games: 17, points: 240 },
        2024: { games: 17, points: 270 },
        2025: { games: 15, points: 210 },
      },
    },
  };

  const [player] = Core.applyFantasyPointTiers(players, "ppr", history);

  assert.deepEqual(player.historicalFantasyPoints, {
    2023: 240,
    2024: 270,
    2025: 210,
  });
  assert.equal(player.multiYearProductionPoints, 240);
  assert.equal(player.tierScore, 270);
});

test("uses projections alone when a player has no previous NFL season", () => {
  const players = [
    {
      id: "veteran",
      pos: "RB",
      rank: 1,
      proj: 200,
      stats: { gameLog: [{ fantasyPoints: 100, receptions: 0 }] },
    },
    {
      id: "rookie",
      pos: "RB",
      rank: 2,
      proj: 180,
      stats: { gameLog: [] },
    },
  ];

  const tiered = Core.applyFantasyPointTiers(players, "ppr");
  const veteran = tiered.find((player) => player.id === "veteran");
  const rookie = tiered.find((player) => player.id === "rookie");

  assert.equal(veteran.tierScore, 150);
  assert.equal(rookie.tierScore, 180);
  assert.equal(rookie.lastSeasonPositionRank, null);
  assert.equal(rookie.tierPositionRank, 1);
});

test("detects the last player before a position tier drop", () => {
  const players = [
    { id: "a", name: "Alpha", pos: "RB", rank: 9, tier: 1, tierLabel: "S" },
    { id: "b", name: "Beta", pos: "RB", rank: 18, tier: 2, tierLabel: "A" },
    { id: "c", name: "Gamma", pos: "WR", rank: 10, tier: 1 },
  ];

  const warning = Core.getTierDropWarning(players[0], players);

  assert.equal(warning.severity, "high");
  assert.match(warning.message, /Last Tier S RB/);
});

test("checks the full position pool before declaring a tier exhausted", () => {
  const players = [
    { id: "a", name: "Alpha", pos: "RB", rank: 5, tier: 1, tierLabel: "S" },
    { id: "b", name: "Beta", pos: "RB", rank: 8, tier: 2, tierLabel: "A" },
    { id: "c", name: "Gamma", pos: "RB", rank: 12, tier: 1, tierLabel: "S" },
  ];

  assert.equal(Core.getTierDropWarning(players[0], players), null);
  assert.match(
    Core.getTierDropWarning(players[2], players).message,
    /Last Tier S RB/
  );
});

test("flags players unlikely to survive to the following pick", () => {
  const urgency = Core.getAvailabilityUrgency({ adp: 15 }, 22);

  assert.equal(urgency.likelyGone, true);
  assert.ok(urgency.score > 0);

  const wait = Core.getAvailabilityUrgency({ adp: 40 }, 22);

  assert.equal(wait.canWait, true);
  assert.ok(wait.score < 0);
});

test("gradually blends personal mock ADP before the 25-draft goal", () => {
  const profile = Core.getPrioritizedAdp({
    yahooAdp: 40,
    espnAdp: 44,
    sleeperAdp: 42,
    personalAdp: 30,
    completedMocks: 12,
    personalSampleSize: 10,
    goal: 25,
  });

  assert.equal(profile.marketAdp, 41.5);
  assert.equal(profile.personalWeight, 0.216);
  assert.equal(profile.personalPriority, false);
  assert.ok(Math.abs(profile.adp - 39.016) < 0.0001);
});

test("makes personal mock ADP the sole priority at 25 drafts", () => {
  const profile = Core.getPrioritizedAdp({
    yahooAdp: 40,
    espnAdp: 44,
    sleeperAdp: 42,
    personalAdp: 30,
    completedMocks: 25,
    personalSampleSize: 10,
    goal: 25,
  });

  assert.equal(profile.marketAdp, 41.5);
  assert.equal(profile.personalWeight, 1);
  assert.equal(profile.marketWeight, 0);
  assert.equal(profile.personalPriority, true);
  assert.equal(profile.adp, 30);
});

test("keeps market ADP when there is no personal pick sample", () => {
  const profile = Core.getPrioritizedAdp({
    yahooAdp: 40,
    espnAdp: 44,
    sleeperAdp: 42,
    completedMocks: 25,
    personalSampleSize: 0,
  });

  assert.equal(profile.adp, 41.5);
  assert.equal(profile.personalWeight, 0);
  assert.equal(profile.personalPriority, false);
});

test("uses even a sparse personal ADP sample after the 25-draft goal", () => {
  const profile = Core.getPrioritizedAdp({
    yahooAdp: 40,
    espnAdp: 44,
    sleeperAdp: 42,
    personalAdp: 30,
    completedMocks: 25,
    personalSampleSize: 3,
  });

  assert.equal(profile.personalPriority, true);
  assert.equal(profile.personalWeight, 1);
  assert.equal(profile.marketWeight, 0);
  assert.equal(profile.adp, 30);
});

test("continues incorporating updated personal ADP after the 25-draft goal", () => {
  const profile = Core.getPrioritizedAdp({
    yahooAdp: 40,
    espnAdp: 44,
    sleeperAdp: 42,
    personalAdp: 27.4,
    completedMocks: 83,
    personalSampleSize: 61,
  });

  assert.equal(profile.personalPriority, true);
  assert.equal(profile.personalWeight, 1);
  assert.equal(profile.marketWeight, 0);
  assert.equal(profile.adp, 27.4);
});

test("values higher player tiers more strongly", () => {
  assert.equal(Core.getTierRecommendationValue({ tier: 1 }), 42);
  assert.equal(Core.getTierRecommendationValue({ tier: 2 }), 28);
  assert.equal(Core.getTierRecommendationValue({ tier: 3 }), 15);
  assert.equal(Core.getTierRecommendationValue({ tier: 5 }), 0);
});

test("detects a premium position run and limited remaining supply", () => {
  const recent = [
    { pos: "RB", tier: 1 },
    { pos: "RB", tier: 1 },
    { pos: "RB", tier: 2 },
    { pos: "RB", tier: 3 },
    { pos: "WR", tier: 1 },
    { pos: "QB", tier: 1 },
  ];
  const available = [
    { pos: "RB", tier: 1 },
    { pos: "RB", tier: 2 },
    { pos: "RB", tier: 3 },
    { pos: "WR", tier: 1 },
  ];
  const snapshot = Core.getTierMarketSnapshot(
    recent,
    available,
    { RB: 5, WR: 1, QB: 0, TE: 0 }
  );

  assert.equal(snapshot.positions.RB.isRun, true);
  assert.equal(snapshot.positions.RB.recentPremium, 3);
  assert.equal(snapshot.positions.RB.remainingPremium, 2);
  assert.equal(snapshot.positions.RB.shortage, 3);
  assert.ok(snapshot.positions.RB.pressureScore > snapshot.positions.WR.pressureScore);
  assert.ok(
    Core.getPlayerMarketPressure(
      { pos: "RB", tier: 1 },
      snapshot
    ) > 20
  );
});

test("adds a bounded early-round RB scarcity edge in full PPR", () => {
  const availablePlayers = [
    ...Array.from({ length: 8 }, (_, index) => ({
      pos: "RB",
      tier: index < 4 ? 2 : 3,
    })),
    ...Array.from({ length: 14 }, (_, index) => ({
      pos: "WR",
      tier: index < 4 ? 2 : 3,
    })),
  ];
  const scarcity = Core.getPprEarlyRbScarcity({
    scoring: "ppr",
    roundNumber: 2,
    availablePlayers,
    rbNeed: 1,
    flexNeed: 1,
  });

  assert.equal(scarcity.active, true);
  assert.equal(scarcity.rbStarterWorthy, 8);
  assert.equal(scarcity.wrStarterWorthy, 14);
  assert.ok(scarcity.adjustment > 5);
  assert.ok(scarcity.adjustment <= 12);
  assert.ok(
    Core.getTierRecommendationValue({ tier: 1 }) -
      Core.getTierRecommendationValue({ tier: 2 }) >
      scarcity.adjustment
  );
});

test("reduces the PPR RB scarcity edge after RB starters are filled", () => {
  const availablePlayers = [
    ...Array.from({ length: 10 }, () => ({ pos: "RB", tier: 3 })),
    ...Array.from({ length: 14 }, () => ({ pos: "WR", tier: 3 })),
  ];
  const needed = Core.getPprEarlyRbScarcity({
    scoring: "ppr",
    roundNumber: 3,
    availablePlayers,
    rbNeed: 1,
    flexNeed: 1,
  });
  const flexOnly = Core.getPprEarlyRbScarcity({
    scoring: "ppr",
    roundNumber: 3,
    availablePlayers,
    rbNeed: 0,
    flexNeed: 1,
  });

  assert.ok(needed.adjustment > flexOnly.adjustment);
  assert.ok(flexOnly.adjustment > 0);
});

test("does not apply the early RB scarcity signal outside full PPR early rounds", () => {
  const availablePlayers = [
    { pos: "RB", tier: 2 },
    { pos: "WR", tier: 2 },
    { pos: "WR", tier: 3 },
  ];

  assert.equal(
    Core.getPprEarlyRbScarcity({
      scoring: "half-ppr",
      roundNumber: 2,
      availablePlayers,
      rbNeed: 1,
    }).adjustment,
    0
  );
  assert.equal(
    Core.getPprEarlyRbScarcity({
      scoring: "ppr",
      roundNumber: 6,
      availablePlayers,
      rbNeed: 1,
    }).adjustment,
    0
  );
});

test("surfaces an available quarterback for a rostered pass-catcher stack", () => {
  const chase = {
    id: "chase",
    name: "Ja'Marr Chase",
    team: "CIN",
    pos: "WR",
    tier: 1,
  };
  const burrow = {
    id: "burrow",
    name: "Joe Burrow",
    team: "CIN",
    pos: "QB",
    tier: 1,
    rank: 42,
  };
  const targets = Core.getStackTargets(
    [chase],
    [
      burrow,
      { id: "higgins", name: "Tee Higgins", team: "CIN", pos: "WR", tier: 3 },
      { id: "mahomes", name: "Patrick Mahomes", team: "KC", pos: "QB", tier: 1 },
    ]
  );

  assert.equal(targets.length, 2);
  assert.equal(targets[0].player.name, "Joe Burrow");
  assert.equal(targets[0].anchor.name, "Ja'Marr Chase");
  assert.equal(targets[0].bonus, 4);
  assert.equal(targets[1].player.name, "Tee Higgins");
  assert.equal(targets[1].connectionType, "team-affinity");
  assert.equal(targets[1].bonus, 1);
});

test("surfaces all fantasy-relevant same-team players for a rostered quarterback", () => {
  const burrow = {
    id: "burrow",
    name: "Joe Burrow",
    team: "CIN",
    pos: "QB",
    tier: 1,
  };
  const targets = Core.getStackTargets(
    [burrow],
    [
      { id: "chase", name: "Ja'Marr Chase", team: "CIN", pos: "WR", tier: 1, rank: 3 },
      { id: "higgins", name: "Tee Higgins", team: "CIN", pos: "WR", tier: 3, rank: 55 },
      { id: "gesicki", name: "Mike Gesicki", team: "CIN", pos: "TE", tier: 4 },
      { id: "brown", name: "Chase Brown", team: "CIN", pos: "RB", tier: 2 },
    ]
  );

  assert.deepEqual(
    targets.map((target) => target.player.name),
    ["Ja'Marr Chase", "Tee Higgins", "Chase Brown", "Mike Gesicki"]
  );
  assert.equal(
    Core.getPlayerStackBonus(targets[0].player, targets).bonus,
    4
  );
  assert.equal(
    Core.getPlayerStackBonus(
      { id: "brown", name: "Chase Brown" },
      targets
    ).bonus,
    1.5
  );
});

test("surfaces a rostered receiver on a same-team running back target", () => {
  const puka = {
    id: "puka",
    name: "Puka Nacua",
    team: "LAR",
    pos: "WR",
    tier: 1,
    rank: 5,
  };
  const kyren = {
    id: "kyren",
    name: "Kyren Williams",
    team: "LAR",
    pos: "RB",
    tier: 2,
    rank: 34,
  };
  const targets = Core.getStackTargets([puka], [kyren]);

  assert.equal(targets.length, 1);
  assert.equal(targets[0].player.name, "Kyren Williams");
  assert.equal(targets[0].anchor.name, "Puka Nacua");
  assert.equal(targets[0].connectionType, "team-affinity");
  assert.equal(targets[0].bonus, 1.5);
});

test("surfaces a Tier D rookie receiver for a rostered same-team quarterback", () => {
  const hurts = {
    id: "hurts",
    name: "Jalen Hurts",
    team: "PHI",
    pos: "QB",
    tier: 1,
    rank: 70,
  };
  const lemon = {
    id: "lemon",
    name: "Makai Lemon",
    team: "PHI",
    pos: "WR",
    tier: 5,
    rank: 81,
  };
  const targets = Core.getStackTargets([hurts], [lemon]);

  assert.equal(targets.length, 1);
  assert.equal(targets[0].player.name, "Makai Lemon");
  assert.equal(targets[0].anchor.name, "Jalen Hurts");
  assert.equal(targets[0].connectionType, "stack");
  assert.equal(targets[0].bonus, 0.5);
});

test("keeps the stack bonus small enough to remain a close-call tiebreaker", () => {
  const targets = Core.getStackTargets(
    [{ id: "qb", name: "Quarterback", team: "ABC", pos: "QB", tier: 1 }],
    [{ id: "wr", name: "Receiver", team: "ABC", pos: "WR", tier: 1 }]
  );

  assert.ok(targets[0].bonus <= 4);
  assert.ok(
    Core.getTierRecommendationValue({ tier: 1 }) -
      Core.getTierRecommendationValue({ tier: 2 }) >
      targets[0].bonus
  );
});

test("surfaces same-team RB contingencies only in later rounds", () => {
  const starter = {
    id: "starter",
    name: "Lead Back",
    team: "ABC",
    pos: "RB",
    rank: 20,
  };
  const backup = {
    id: "backup",
    name: "Backup Back",
    team: "ABC",
    pos: "RB",
    rank: 145,
    projection: 120,
  };

  assert.equal(
    Core.getRbHandcuffTargets([starter], [backup], 7).length,
    0
  );

  const targets = Core.getRbHandcuffTargets(
    [starter],
    [
      backup,
      { id: "other", name: "Other Back", team: "XYZ", pos: "RB", rank: 130, projection: 130 },
    ],
    11
  );

  assert.equal(targets.length, 1);
  assert.equal(targets[0].player.name, "Backup Back");
  assert.equal(targets[0].anchor.name, "Lead Back");
  assert.equal(
    Core.getPlayerHandcuffBonus(backup, targets).bonus,
    1.5
  );
});

test("compares multi-pick paths using future availability and roster value", () => {
  const rb = { id: "rb", name: "Runner", pos: "RB" };
  const wr = { id: "wr", name: "Receiver", pos: "WR" };
  const laterRb = { id: "later-rb", name: "Later Runner", pos: "RB" };
  const laterWr = { id: "later-wr", name: "Later Receiver", pos: "WR" };
  const paths = Core.simulateDraftPaths({
    candidates: [
      { player: rb, decisionScore: 100 },
      { player: wr, decisionScore: 100 },
    ],
    availablePlayers: [rb, wr, laterRb, laterWr],
    futurePicks: [17, 32],
    getPlayerKey: (player) => player.id,
    getAvailability: (player) =>
      player.id === "later-rb" ? 90 : 60,
    getFutureValue: (player, pick, roster) => {
      const hasRb = roster.some((rosterPlayer) => rosterPlayer.pos === "RB");

      if (!hasRb && player.pos === "RB") return 140;
      return player.pos === "WR" ? 105 : 90;
    },
  });

  assert.equal(paths.length, 2);
  assert.equal(paths[0].selections.length, 2);
  assert.ok(Number.isFinite(paths[0].pathScore));
  assert.notEqual(paths[0].pathAdjustment, paths[1].pathAdjustment);
});

test("adds a wait cost when a valuable needed player is likely to disappear", () => {
  const urgent = Core.getNowVsLaterScore({
    baseScore: 100,
    goneProbability: 85,
    tierValueScore: 42,
    needScore: 50,
    marketPressureScore: 24,
    scarcity: 12,
    projectionScore: 15,
  });
  const safeToWait = Core.getNowVsLaterScore({
    baseScore: 100,
    goneProbability: 15,
    tierValueScore: 42,
    needScore: 50,
    marketPressureScore: 24,
    scarcity: 12,
    projectionScore: 15,
  });

  assert.ok(urgent.waitCost > safeToWait.waitCost);
  assert.ok(urgent.decisionScore > safeToWait.decisionScore);
});

test("calculates historical availability from picked and undrafted players", () => {
  const history = {
    picks: [
      { draftId: "draft-a", overall: 18 },
      { draftId: "draft-b", overall: 26 },
    ],
  };
  const drafts = [
    { draftId: "draft-a", depth: 60, teamCount: 12, scoring: "ppr" },
    { draftId: "draft-b", depth: 50, teamCount: 12, scoring: "ppr" },
    { draftId: "draft-c", depth: 35, teamCount: 12, scoring: "ppr" },
    { draftId: "draft-d", depth: 10, teamCount: 12, scoring: "ppr" },
    { draftId: "draft-e", depth: 50, teamCount: 10, scoring: "ppr" },
  ];

  const metrics = Core.getHistoricalDraftMetrics(
    history,
    drafts,
    22,
    { teamCount: 12, scoring: "ppr" }
  );

  assert.equal(metrics.probabilitySampleSize, 3);
  assert.equal(metrics.availableCount, 2);
  assert.equal(metrics.goneCount, 1);
  assert.equal(Math.round(metrics.availableProbability), 67);
  assert.equal(metrics.averagePick, 22);
  assert.equal(metrics.medianPick, 22);
  assert.equal(metrics.rangeStart, 20);
  assert.equal(metrics.rangeEnd, 24);
  assert.equal(metrics.standardDeviation, 4);
  assert.equal(metrics.volatility, "Stable");
});

test("builds availability curves and fall-past-baseline rates", () => {
  const history = {
    picks: [
      { draftId: "a", overall: 10 },
      { draftId: "b", overall: 20 },
      { draftId: "c", overall: 30 },
    ],
  };
  const drafts = [
    { draftId: "a", depth: 60, source: "yahoo" },
    { draftId: "b", depth: 60, source: "yahoo" },
    { draftId: "c", depth: 60, source: "yahoo" },
  ];
  const curve = Core.getHistoricalAvailabilityAtPicks(
    history,
    drafts,
    [12, 24, 36],
    { source: "yahoo", baselineAdp: 18 }
  );

  assert.equal(curve.length, 3);
  assert.equal(Math.round(curve[0].metrics.availableProbability), 67);
  assert.equal(Math.round(curve[1].metrics.availableProbability), 33);
  assert.equal(curve[2].metrics.availableProbability, 0);
  assert.equal(
    Math.round(curve[0].metrics.fallPastBaselineProbability),
    67
  );
  assert.equal(curve[0].metrics.volatility, "Moderate");
});

test("compares completed mock openings by projected starting lineup", () => {
  const player = (name, pos, projection) => ({
    name,
    pos,
    projection,
  });
  const drafts = [
    {
      draftId: "a",
      completed: true,
      userPicks: [
        player("WR One", "WR", 300),
        player("RB One", "RB", 290),
        player("WR Two", "WR", 280),
        player("QB One", "QB", 340),
        player("RB Two", "RB", 250),
        player("TE One", "TE", 210),
      ],
    },
    {
      draftId: "b",
      completed: true,
      userPicks: [
        player("WR Three", "WR", 295),
        player("RB Three", "RB", 285),
        player("WR Four", "WR", 275),
        player("QB Two", "QB", 335),
        player("RB Four", "RB", 245),
        player("TE Two", "TE", 205),
      ],
    },
    {
      draftId: "c",
      completed: true,
      userPicks: [
        player("RB Five", "RB", 270),
        player("RB Six", "RB", 250),
        player("WR Five", "WR", 240),
      ],
    },
  ];
  const report = Core.getMockDraftStrategyReport(drafts, {
    teamCount: 12,
    qb: 1,
    rb: 2,
    wr: 2,
    te: 1,
    flex: 0,
  });

  assert.equal(report.draftCount, 2);
  assert.equal(report.bestOpening.opening, "WR-RB-WR");
  assert.equal(report.bestOpening.sampleSize, 2);
});

test("matches the current draft path to historical continuations", () => {
  const player = (name, pos, projection) => ({
    name,
    pos,
    projection,
  });
  const drafts = [
    {
      draftId: "path-a",
      completed: true,
      userPicks: [
        player("RB One", "RB", 300),
        player("RB Two", "RB", 285),
        player("WR One", "WR", 275),
        player("WR Two", "WR", 270),
        player("TE One", "TE", 220),
      ],
    },
    {
      draftId: "path-b",
      completed: true,
      userPicks: [
        player("RB Three", "RB", 295),
        player("RB Four", "RB", 280),
        player("WR Three", "WR", 276),
        player("WR Four", "WR", 268),
        player("QB One", "QB", 340),
      ],
    },
    {
      draftId: "path-c",
      completed: true,
      userPicks: [
        player("RB Five", "RB", 292),
        player("RB Six", "RB", 282),
        player("WR Five", "WR", 274),
        player("RB Seven", "RB", 235),
        player("WR Six", "WR", 250),
      ],
    },
    {
      draftId: "different-path",
      completed: true,
      userPicks: [
        player("WR Seven", "WR", 300),
        player("RB Eight", "RB", 280),
        player("WR Eight", "WR", 270),
        player("RB Nine", "RB", 260),
      ],
    },
  ];

  const report = Core.getDraftPathStrategyReport(
    drafts,
    [
      player("My RB One", "RB", 300),
      player("My RB Two", "RB", 290),
      player("My WR One", "WR", 280),
    ],
    { teamCount: 12, qb: 1, rb: 2, wr: 2, te: 1, flex: 1 }
  );

  assert.equal(report.currentPath, "RB-RB-WR");
  assert.equal(report.matchedDraftCount, 3);
  assert.equal(report.nextPickSampleSize, 3);
  assert.equal(report.bestNextPosition.position, "WR");
  assert.equal(
    report.nextPositionOptions.find((option) => option.position === "WR")
      .sampleSize,
    2
  );
  assert.ok(
    Core.getDraftPathPositionFitAdjustment({ pos: "WR" }, report) >
      Core.getDraftPathPositionFitAdjustment({ pos: "RB" }, report)
  );
  assert.ok(
    Core.getDraftPathPositionFitAdjustment({ pos: "WR" }, report) <= 8
  );
});

test("blends small personal samples with the existing availability model", () => {
  assert.equal(
    Core.blendAvailabilityProbability(
      40,
      { availableProbability: 100, probabilitySampleSize: 2 },
      10
    ),
    50
  );

  assert.equal(
    Core.blendAvailabilityProbability(
      40,
      { availableProbability: 80, probabilitySampleSize: 20 },
      10
    ),
    67
  );

  assert.equal(
    Core.blendAvailabilityProbability(40, null, 10),
    40
  );
});

test("learns how opponents change position choices as their rosters fill", () => {
  const behavior = Core.getOpponentRosterBehavior(
    [
      {
        draftId: "behavior-a",
        source: "yahoo",
        teamCount: 2,
        completed: true,
        picks: [
          { overall: 1, pos: "RB" },
          { overall: 2, pos: "WR" },
          { overall: 3, pos: "WR" },
          { overall: 4, pos: "RB" },
          { overall: 5, pos: "RB" },
          { overall: 6, pos: "WR" },
        ],
      },
    ],
    { teamCount: 2, source: "yahoo" }
  );
  const probabilities = Core.getOpponentPositionProbabilities(
    behavior,
    { QB: 0, RB: 2, WR: 0, TE: 0 },
    3
  );

  assert.equal(behavior.sampleDrafts, 1);
  assert.equal(behavior.samplePicks, 6);
  assert.ok(probabilities.probabilities.RB > probabilities.probabilities.WR);
  assert.ok(probabilities.sampleSize > 0);
});

test("applies an offense exposure guardrail only after two teammates", () => {
  const player = { name: "Third Player", team: "PHI", tier: 3 };

  assert.equal(
    Core.getOffenseExposurePenalty(player, [{ team: "PHI" }]),
    0
  );
  assert.equal(
    Core.getOffenseExposurePenalty(
      player,
      [{ team: "PHI" }, { team: "PHI" }]
    ),
    5
  );
  assert.ok(
    Core.getOffenseExposurePenalty(
      { ...player, tier: 1 },
      [{ team: "PHI" }, { team: "PHI" }],
      { stackBonus: 4 }
    ) < 5
  );
});

test("raises starter-completion probability when a scarce need is filled", () => {
  const settings = {
    teamCount: 10,
    qb: 1,
    rb: 1,
    wr: 1,
    te: 1,
    flex: 0,
  };
  const roster = [
    { pos: "QB" },
    { pos: "RB" },
    { pos: "WR" },
  ];
  const tightEnd = { name: "Needed TE", pos: "TE", tier: 3 };
  const available = [tightEnd, { pos: "QB", tier: 2 }];
  const before = Core.getStarterCompletionOutlook(
    roster,
    available,
    settings
  );
  const after = Core.getStarterCompletionOutlook(
    [...roster, tightEnd],
    available.filter((player) => player !== tightEnd),
    settings
  );

  assert.ok(before.probability < after.probability);
  assert.equal(after.probability, 100);
});

test("controls bench allocation without hard-coding a position", () => {
  const settings = {
    qb: 1,
    rb: 2,
    wr: 2,
    te: 1,
    flex: 1,
    bench: 6,
    scoring: "ppr",
  };
  const incompleteRoster = [
    { pos: "QB" },
    { pos: "RB" },
    { pos: "RB" },
    { pos: "WR" },
  ];
  const completeRoster = [
    { pos: "QB" },
    { pos: "RB" },
    { pos: "RB" },
    { pos: "WR" },
    { pos: "WR" },
    { pos: "WR" },
    { pos: "TE" },
  ];

  assert.equal(
    Core.getBenchAllocationAdjustment(
      { pos: "QB" },
      incompleteRoster,
      settings,
      8
    ),
    -9
  );
  assert.ok(
    Core.getBenchAllocationAdjustment(
      { pos: "RB" },
      completeRoster,
      settings,
      10
    ) > 0
  );
});

test("prices the opportunity cost of passing on the last player before a tier cliff", () => {
  const target = { name: "Target", pos: "WR", tier: 2, rank: 10 };
  const cliff = Core.getTierCliffOpportunityCost(
    target,
    [target, { name: "Next", pos: "WR", tier: 3, rank: 28 }],
    10
  );
  const deepTier = Core.getTierCliffOpportunityCost(
    target,
    [
      target,
      { pos: "WR", tier: 2, rank: 11 },
      { pos: "WR", tier: 2, rank: 12 },
      { pos: "WR", tier: 2, rank: 13 },
    ],
    2
  );

  assert.ok(cliff > deepTier);
  assert.ok(cliff >= 10);
});

test("calibrates saved forecasts against completed Yahoo boards", () => {
  const records = [];
  const drafts = [];

  for (let index = 0; index < 5; index += 1) {
    const draftId = `calibration-${index}`;
    records.push({
      draftId,
      targetPick: 20,
      playerId: "primary",
      playerName: "Primary Player",
      alternateId: "alternate",
      alternateName: "Alternate Player",
      predictedAvailableProbability: 30,
    });
    drafts.push({
      draftId,
      completed: true,
      depth: 40,
      picks: [{ overall: 20, playerId: index < 3 ? "primary" : "alternate" }],
      userPicks: [
        {
          overall: 20,
          playerId: index < 3 ? "primary" : "alternate",
        },
      ],
    });
  }

  const report = Core.getAvailabilityCalibrationReport(records, drafts);

  assert.equal(report.sampleSize, 5);
  assert.equal(report.actualRate, 100);
  assert.equal(report.averagePredicted, 30);
  assert.equal(report.recommendationSelections, 3);
  assert.equal(report.alternateSelections, 2);
  assert.ok(Core.calibrateAvailabilityProbability(30, report) > 30);
});
