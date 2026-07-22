(function (root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.DraftIQCore = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  const DEFAULT_LEAGUE_SETTINGS = Object.freeze({
    teamCount: 12,
    draftSlot: 1,
    qb: 1,
    rb: 2,
    wr: 3,
    te: 1,
    flex: 2,
    bench: 6,
    scoring: "ppr",
  });

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function wholeNumber(value, fallback, min, max) {
    const parsed = Number.parseInt(value, 10);

    if (!Number.isFinite(parsed)) return fallback;

    return clamp(parsed, min, max);
  }

  function normalizeLeagueSettings(input = {}) {
    const teamCount = wholeNumber(
      input.teamCount,
      DEFAULT_LEAGUE_SETTINGS.teamCount,
      2,
      20
    );

    const scoringOptions = new Set(["standard", "half-ppr", "ppr"]);

    return {
      teamCount,
      draftSlot: wholeNumber(
        input.draftSlot,
        DEFAULT_LEAGUE_SETTINGS.draftSlot,
        1,
        teamCount
      ),
      qb: wholeNumber(input.qb, DEFAULT_LEAGUE_SETTINGS.qb, 0, 4),
      rb: wholeNumber(input.rb, DEFAULT_LEAGUE_SETTINGS.rb, 0, 8),
      wr: wholeNumber(input.wr, DEFAULT_LEAGUE_SETTINGS.wr, 0, 8),
      te: wholeNumber(input.te, DEFAULT_LEAGUE_SETTINGS.te, 0, 4),
      flex: wholeNumber(input.flex, DEFAULT_LEAGUE_SETTINGS.flex, 0, 6),
      bench: wholeNumber(input.bench, DEFAULT_LEAGUE_SETTINGS.bench, 0, 16),
      scoring: scoringOptions.has(input.scoring)
        ? input.scoring
        : DEFAULT_LEAGUE_SETTINGS.scoring,
    };
  }

  function getOverallPick(roundNumber, draftSlot, teamCount) {
    const round = wholeNumber(roundNumber, 1, 1, 99);
    const teams = wholeNumber(teamCount, 12, 2, 20);
    const slot = wholeNumber(draftSlot, 1, 1, teams);
    const pickWithinRound = round % 2 === 1 ? slot : teams - slot + 1;

    return (round - 1) * teams + pickWithinRound;
  }

  function getSnakeDraftSlot(overallPick, teamCount) {
    const teams = wholeNumber(teamCount, 12, 2, 20);
    const pick = wholeNumber(overallPick, 1, 1, 9999);
    const round = Math.ceil(pick / teams);
    const pickWithinRound = ((pick - 1) % teams) + 1;

    return round % 2 === 1
      ? pickWithinRound
      : teams - pickWithinRound + 1;
  }

  function getUserPickContext(currentOverallPick, inputSettings = {}) {
    const settings = normalizeLeagueSettings(inputSettings);
    const currentPick = wholeNumber(currentOverallPick, 1, 1, 9999);
    const userPicks = [];

    for (let round = 1; round <= 40; round += 1) {
      userPicks.push(
        getOverallPick(round, settings.draftSlot, settings.teamCount)
      );
    }

    let nextIndex = userPicks.findIndex((pick) => pick >= currentPick);

    if (nextIndex < 0) nextIndex = userPicks.length - 1;

    const nextUserPick = userPicks[nextIndex];
    const followingUserPick = userPicks[nextIndex + 1] || nextUserPick;
    const isUserTurn = nextUserPick === currentPick;

    return {
      currentPick,
      currentRound: Math.max(
        1,
        Math.ceil(currentPick / settings.teamCount)
      ),
      nextUserPick,
      followingUserPick,
      picksUntilNext: Math.max(0, nextUserPick - currentPick),
      isUserTurn,
      lookaheadPick: isUserTurn ? followingUserPick : nextUserPick,
    };
  }

  function getUpcomingUserPicks(
    currentOverallPick,
    inputSettings = {},
    count = 3
  ) {
    const settings = normalizeLeagueSettings(inputSettings);
    const currentPick = wholeNumber(currentOverallPick, 1, 1, 9999);
    const targetCount = wholeNumber(count, 3, 1, 10);
    const picks = [];
    let round = Math.max(1, Math.ceil(currentPick / settings.teamCount));

    while (picks.length < targetCount && round <= 99) {
      const overall = getOverallPick(
        round,
        settings.draftSlot,
        settings.teamCount
      );

      if (overall >= currentPick) {
        picks.push(overall);
      }

      round += 1;
    }

    return picks;
  }

  function getInterveningDraftSlots(currentOverallPick, inputSettings = {}) {
    const settings = normalizeLeagueSettings(inputSettings);
    const context = getUserPickContext(currentOverallPick, settings);
    const firstPick = context.isUserTurn
      ? context.currentPick + 1
      : context.currentPick;
    const lastPick = context.lookaheadPick - 1;
    const pickSlots = [];
    const seenSlots = new Set();
    const slots = [];

    for (let overall = firstPick; overall <= lastPick; overall += 1) {
      const slot = getSnakeDraftSlot(overall, settings.teamCount);

      if (slot === settings.draftSlot) continue;

      pickSlots.push({ overall, slot });

      if (!seenSlots.has(slot)) {
        seenSlots.add(slot);
        slots.push(slot);
      }
    }

    return {
      firstPick,
      lastPick,
      nextUserPick: context.lookaheadPick,
      pickSlots,
      slots,
    };
  }

  function getDraftSlotPositionTendencies(drafts = [], options = {}) {
    const teamCount = wholeNumber(options.teamCount, 12, 2, 32);
    const openingRounds = wholeNumber(options.openingRounds, 3, 2, 6);
    const source = String(options.source || "").toLowerCase();
    const validPositions = ["QB", "RB", "WR", "TE"];
    const slots = {};
    const leagueRounds = {};
    let sampleDrafts = 0;

    const ensureProfile = (container, key) => {
      if (!container[key]) {
        container[key] = {
          sampleSize: 0,
          counts: { QB: 0, RB: 0, WR: 0, TE: 0 },
        };
      }

      return container[key];
    };

    (Array.isArray(drafts) ? drafts : []).forEach((draft) => {
      const draftTeamCount = numberOrNull(draft?.teamCount) ?? teamCount;
      const draftSource = String(draft?.source || "").toLowerCase();
      const picks = Array.isArray(draft?.picks) ? draft.picks : [];

      if (
        !draft?.completed ||
        draftTeamCount !== teamCount ||
        (source && draftSource && draftSource !== source) ||
        !picks.length
      ) {
        return;
      }

      sampleDrafts += 1;
      const positionsBySlot = new Map();

      [...picks]
        .sort((a, b) => (numberOrNull(a?.overall) ?? 9999) - (numberOrNull(b?.overall) ?? 9999))
        .forEach((pick) => {
          const overall = numberOrNull(pick?.overall);
          const position = String(pick?.pos || pick?.position || "").toUpperCase();

          if (overall === null || !validPositions.includes(position)) return;

          const slot = getSnakeDraftSlot(overall, teamCount);
          const round = Math.ceil(overall / teamCount);
          const slotProfile = slots[slot] || {
            sampleDrafts: 0,
            rounds: {},
            transitions: {},
            openingSequenceCounts: {},
          };
          const roundProfile = ensureProfile(slotProfile.rounds, round);
          const leagueRoundProfile = ensureProfile(leagueRounds, round);

          roundProfile.sampleSize += 1;
          roundProfile.counts[position] += 1;
          leagueRoundProfile.sampleSize += 1;
          leagueRoundProfile.counts[position] += 1;
          slots[slot] = slotProfile;

          const sequence = positionsBySlot.get(slot) || [];
          sequence.push(position);
          positionsBySlot.set(slot, sequence);
        });

      positionsBySlot.forEach((positions, slot) => {
        const slotProfile = slots[slot];

        slotProfile.sampleDrafts += 1;

        for (let index = 0; index < Math.min(openingRounds, positions.length); index += 1) {
          const prefix = index === 0
            ? "START"
            : positions.slice(0, index).join(">");
          const transition = ensureProfile(slotProfile.transitions, prefix);
          const position = positions[index];

          transition.sampleSize += 1;
          transition.counts[position] += 1;
        }

        if (positions.length >= openingRounds) {
          const opening = positions.slice(0, openingRounds).join(">");
          slotProfile.openingSequenceCounts[opening] =
            (slotProfile.openingSequenceCounts[opening] || 0) + 1;
        }
      });
    });

    const finalizeProfile = (profile) => {
      const sampleSize = profile?.sampleSize || 0;
      const probabilities = {};

      validPositions.forEach((position) => {
        probabilities[position] = sampleSize
          ? Number(((profile.counts[position] / sampleSize) * 100).toFixed(1))
          : 0;
      });

      return { ...profile, probabilities };
    };

    Object.values(slots).forEach((slotProfile) => {
      Object.keys(slotProfile.rounds).forEach((round) => {
        slotProfile.rounds[round] = finalizeProfile(slotProfile.rounds[round]);
      });
      Object.keys(slotProfile.transitions).forEach((prefix) => {
        slotProfile.transitions[prefix] = finalizeProfile(
          slotProfile.transitions[prefix]
        );
      });
      slotProfile.openingSequences = Object.entries(
        slotProfile.openingSequenceCounts
      )
        .map(([sequence, count]) => ({
          sequence,
          positions: sequence.split(">"),
          count,
          probability: slotProfile.sampleDrafts
            ? Number(((count / slotProfile.sampleDrafts) * 100).toFixed(1))
            : 0,
        }))
        .sort((a, b) => b.count - a.count || a.sequence.localeCompare(b.sequence));
      delete slotProfile.openingSequenceCounts;
    });

    Object.keys(leagueRounds).forEach((round) => {
      leagueRounds[round] = finalizeProfile(leagueRounds[round]);
    });

    return {
      teamCount,
      openingRounds,
      sampleDrafts,
      slots,
      leagueRounds,
    };
  }

  function getDraftSlotNextPositionProbabilities(
    tendencies,
    draftSlot,
    rosterPositions = [],
    nextRound = null
  ) {
    const validPositions = ["QB", "RB", "WR", "TE"];
    const slot = tendencies?.slots?.[draftSlot] || null;
    const round = numberOrNull(nextRound);
    const slotRound = round === null ? null : slot?.rounds?.[round];
    const leagueRound = round === null ? null : tendencies?.leagueRounds?.[round];
    const positions = (Array.isArray(rosterPositions) ? rosterPositions : [])
      .map((position) => String(position || "").toUpperCase())
      .filter((position) => validPositions.includes(position));
    const prefix = positions.length === 0
      ? "START"
      : positions.slice(0, tendencies?.openingRounds || 3).join(">");
    const transition = positions.length < (tendencies?.openingRounds || 3)
      ? slot?.transitions?.[prefix]
      : null;
    const probabilities = {};
    const roundSampleSize = slotRound?.sampleSize || 0;
    const transitionSampleSize = transition?.sampleSize || 0;
    const transitionWeight = transitionSampleSize
      ? clamp(transitionSampleSize / 8, 0.2, 0.75)
      : 0;

    validPositions.forEach((position) => {
      const leagueProbability = numberOrNull(
        leagueRound?.probabilities?.[position]
      ) ?? 25;
      const slotProbability = numberOrNull(
        slotRound?.probabilities?.[position]
      );
      const smoothedRoundProbability = slotProbability === null
        ? leagueProbability
        : (
            slotProbability * (roundSampleSize / (roundSampleSize + 3)) +
            leagueProbability * (3 / (roundSampleSize + 3))
          );
      const transitionProbability = numberOrNull(
        transition?.probabilities?.[position]
      );

      probabilities[position] = Number((
        transitionProbability === null
          ? smoothedRoundProbability
          : transitionProbability * transitionWeight +
            smoothedRoundProbability * (1 - transitionWeight)
      ).toFixed(1));
    });

    return {
      probabilities,
      sampleSize: Math.max(roundSampleSize, transitionSampleSize),
      roundSampleSize,
      transitionSampleSize,
      matchedOpeningPrefix: transition ? prefix : null,
    };
  }

  function getOpponentRosterBehavior(drafts = [], options = {}) {
    const teamCount = wholeNumber(options.teamCount, 12, 2, 32);
    const source = String(options.source || "").toLowerCase();
    const positions = ["QB", "RB", "WR", "TE"];
    const behavior = Object.fromEntries(
      positions.map((position) => [position, { states: {} }])
    );
    let sampleDrafts = 0;
    let samplePicks = 0;

    const phaseForRound = (round) => {
      if (round <= 5) return "early";
      if (round <= 10) return "middle";
      return "late";
    };

    (Array.isArray(drafts) ? drafts : []).forEach((draft) => {
      const draftTeamCount = numberOrNull(draft?.teamCount) ?? teamCount;
      const draftSource = String(draft?.source || "").toLowerCase();
      const picks = Array.isArray(draft?.picks) ? draft.picks : [];

      if (
        !draft?.completed ||
        draftTeamCount !== teamCount ||
        (source && draftSource && draftSource !== source) ||
        !picks.length
      ) {
        return;
      }

      sampleDrafts += 1;
      const countsBySlot = new Map();

      [...picks]
        .sort((a, b) => (numberOrNull(a?.overall) ?? 9999) - (numberOrNull(b?.overall) ?? 9999))
        .forEach((pick) => {
          const overall = numberOrNull(pick?.overall);
          const selectedPosition = String(
            pick?.pos || pick?.position || ""
          ).toUpperCase();

          if (overall === null || !positions.includes(selectedPosition)) return;

          const slot = getSnakeDraftSlot(overall, teamCount);
          const round = Math.ceil(overall / teamCount);
          const phase = phaseForRound(round);
          const counts = countsBySlot.get(slot) || {
            QB: 0,
            RB: 0,
            WR: 0,
            TE: 0,
          };

          positions.forEach((position) => {
            const bucket = Math.min(2, counts[position] || 0);
            const key = `${phase}:${bucket}`;
            const state = behavior[position].states[key] || {
              opportunities: 0,
              selections: 0,
            };

            state.opportunities += 1;
            if (selectedPosition === position) state.selections += 1;
            behavior[position].states[key] = state;
          });

          counts[selectedPosition] += 1;
          countsBySlot.set(slot, counts);
          samplePicks += 1;
        });
    });

    positions.forEach((position) => {
      Object.values(behavior[position].states).forEach((state) => {
        state.probability = state.opportunities
          ? Number(((state.selections / state.opportunities) * 100).toFixed(1))
          : 0;
      });
    });

    return { teamCount, sampleDrafts, samplePicks, positions: behavior };
  }

  function getOpponentPositionProbabilities(
    behavior,
    rosterCounts = {},
    roundNumber = 1
  ) {
    const positions = ["QB", "RB", "WR", "TE"];
    const round = Math.max(1, numberOrNull(roundNumber) ?? 1);
    const phase = round <= 5 ? "early" : round <= 10 ? "middle" : "late";
    const raw = {};
    let total = 0;
    let sampleSize = 0;

    positions.forEach((position) => {
      const bucket = Math.min(2, Math.max(0, numberOrNull(rosterCounts[position]) ?? 0));
      const state = behavior?.positions?.[position]?.states?.[`${phase}:${bucket}`];
      const probability = numberOrNull(state?.probability) ?? 25;

      raw[position] = probability;
      total += probability;
      sampleSize = Math.max(sampleSize, state?.opportunities || 0);
    });

    const probabilities = {};
    positions.forEach((position) => {
      probabilities[position] = Number((
        total ? (raw[position] / total) * 100 : 25
      ).toFixed(1));
    });

    return { probabilities, sampleSize, phase };
  }

  function getOffenseExposurePenalty(player, rosterPlayers = [], options = {}) {
    const team = String(player?.team || "").toUpperCase();

    if (!team || team === "-") return 0;

    const existing = (Array.isArray(rosterPlayers) ? rosterPlayers : [])
      .filter((rosterPlayer) =>
        String(rosterPlayer?.team || "").toUpperCase() === team
      ).length;

    if (existing < 2) return 0;

    const tier = numberOrNull(player?.tier) ?? 5;
    const stackBonus = Math.max(0, numberOrNull(options.stackBonus) ?? 0);
    const basePenalty = ({ 2: 5, 3: 10, 4: 15 })[Math.min(4, existing)] || 18;
    const eliteReduction = tier === 1 ? 2 : tier === 2 ? 1 : 0;
    const correlationReduction = Math.min(2, stackBonus * 0.5);

    return Number(clamp(
      basePenalty - eliteReduction - correlationReduction,
      1,
      18
    ).toFixed(1));
  }

  function getStarterCompletionOutlook(
    rosterPlayers = [],
    availablePlayers = [],
    inputSettings = {}
  ) {
    const settings = normalizeLeagueSettings(inputSettings);
    const positions = ["QB", "RB", "WR", "TE"];
    const counts = { QB: 0, RB: 0, WR: 0, TE: 0 };

    (Array.isArray(rosterPlayers) ? rosterPlayers : []).forEach((player) => {
      const position = String(player?.pos || player?.position || "").toUpperCase();
      if (positions.includes(position)) counts[position] += 1;
    });

    const needs = getRosterNeeds(counts, settings);
    const supply = { QB: 0, RB: 0, WR: 0, TE: 0 };

    (Array.isArray(availablePlayers) ? availablePlayers : []).forEach((player) => {
      const position = String(player?.pos || player?.position || "").toUpperCase();
      const tier = numberOrNull(player?.tier);
      if (positions.includes(position) && tier !== null && tier <= 3) {
        supply[position] += 1;
      }
    });

    const probabilities = {};
    const weightedProbabilities = [];

    positions.forEach((position) => {
      const missing = needs.baseNeeds[position] || 0;
      const expectedShare = supply[position] / settings.teamCount;
      const probability = missing === 0
        ? 100
        : clamp((expectedShare / missing) * 100, 5, 100);

      probabilities[position] = Number(probability.toFixed(1));
      for (let index = 0; index < missing; index += 1) {
        weightedProbabilities.push(probability / 100);
      }
    });

    if (needs.flexNeed > 0) {
      const flexSupply = supply.RB + supply.WR + supply.TE;
      const flexProbability = clamp(
        ((flexSupply / settings.teamCount) / needs.flexNeed) * 100,
        5,
        100
      );

      probabilities.FLEX = Number(flexProbability.toFixed(1));
      for (let index = 0; index < needs.flexNeed; index += 1) {
        weightedProbabilities.push(flexProbability / 100);
      }
    } else {
      probabilities.FLEX = 100;
    }

    const overallProbability = weightedProbabilities.length
      ? Math.pow(
          weightedProbabilities.reduce((product, value) => product * value, 1),
          1 / weightedProbabilities.length
        ) * 100
      : 100;

    return {
      probability: Number(overallProbability.toFixed(1)),
      probabilities,
      needs,
      supply,
      atRiskPositions: Object.entries(probabilities)
        .filter(([, probability]) => probability < 60)
        .map(([position]) => position),
    };
  }

  function getBenchAllocationPlan(
    rosterPlayers = [],
    inputSettings = {},
    roundNumber = 1
  ) {
    const settings = normalizeLeagueSettings(inputSettings);
    const positions = ["QB", "RB", "WR", "TE"];
    const counts = { QB: 0, RB: 0, WR: 0, TE: 0 };

    (Array.isArray(rosterPlayers) ? rosterPlayers : []).forEach((player) => {
      const position = String(player?.pos || player?.position || "").toUpperCase();
      if (positions.includes(position)) counts[position] += 1;
    });

    const starterUse = {
      QB: Math.min(counts.QB, settings.qb),
      RB: Math.min(counts.RB, settings.rb),
      WR: Math.min(counts.WR, settings.wr),
      TE: Math.min(counts.TE, settings.te),
    };
    let flexRemaining = settings.flex;
    const flexOrder = settings.scoring === "ppr"
      ? ["WR", "RB", "TE"]
      : ["RB", "WR", "TE"];

    flexOrder.forEach((position) => {
      const excess = Math.max(0, counts[position] - starterUse[position]);
      const used = Math.min(excess, flexRemaining);
      starterUse[position] += used;
      flexRemaining -= used;
    });

    const benchCounts = Object.fromEntries(
      positions.map((position) => [
        position,
        Math.max(0, counts[position] - starterUse[position]),
      ])
    );
    const targets = {
      QB: settings.bench >= 7 ? 1 : 0,
      RB: Math.max(1, Math.ceil(settings.bench * 0.42)),
      WR: Math.max(1, Math.ceil(settings.bench * (settings.scoring === "ppr" ? 0.42 : 0.34))),
      TE: settings.bench >= 7 ? 1 : 0,
    };

    while (Object.values(targets).reduce((sum, value) => sum + value, 0) > settings.bench) {
      if (targets.QB > 0) targets.QB -= 1;
      else if (targets.TE > 0) targets.TE -= 1;
      else if (targets.WR > targets.RB) targets.WR -= 1;
      else targets.RB -= 1;
    }

    return {
      roundNumber,
      counts,
      starterUse,
      benchCounts,
      targets,
      gaps: Object.fromEntries(
        positions.map((position) => [
          position,
          Math.max(0, targets[position] - benchCounts[position]),
        ])
      ),
      needs: getRosterNeeds(counts, settings),
    };
  }

  function getBenchAllocationAdjustment(
    player,
    rosterPlayers = [],
    inputSettings = {},
    roundNumber = 1
  ) {
    const position = String(player?.pos || player?.position || "").toUpperCase();
    if (!["QB", "RB", "WR", "TE"].includes(position)) return 0;

    const plan = getBenchAllocationPlan(rosterPlayers, inputSettings, roundNumber);
    const baseNeed = plan.needs.baseNeeds[position] || 0;
    const canFillFlex = ["RB", "WR", "TE"].includes(position) && plan.needs.flexNeed > 0;

    if (baseNeed > 0 || canFillFlex) return 0;

    if (!plan.needs.startersFilled) {
      return ["QB", "TE"].includes(position) ? -9 : -3;
    }

    if (plan.gaps[position] > 0) {
      return ["RB", "WR"].includes(position) ? 5 : 2;
    }

    return ["QB", "TE"].includes(position) ? -8 : -2;
  }

  function getTierCliffOpportunityCost(
    player,
    availablePlayers = [],
    picksUntilNext = 0
  ) {
    const position = String(player?.pos || player?.position || "").toUpperCase();
    const currentTier = numberOrNull(player?.tier);
    const currentRank = numberOrNull(player?.rank) ?? numberOrNull(player?.adp) ?? 9999;

    if (!position || currentTier === null) return 0;

    const samePosition = (Array.isArray(availablePlayers) ? availablePlayers : [])
      .filter((candidate) =>
        String(candidate?.pos || candidate?.position || "").toUpperCase() === position &&
        candidate !== player
      )
      .sort((a, b) => {
        const aTier = numberOrNull(a?.tier) ?? 99;
        const bTier = numberOrNull(b?.tier) ?? 99;
        const aRank = numberOrNull(a?.rank) ?? numberOrNull(a?.adp) ?? 9999;
        const bRank = numberOrNull(b?.rank) ?? numberOrNull(b?.adp) ?? 9999;
        return aTier - bTier || aRank - bRank;
      });
    const next = samePosition[0];
    const nextTier = numberOrNull(next?.tier) ?? currentTier;
    const nextRank = numberOrNull(next?.rank) ?? numberOrNull(next?.adp) ?? currentRank;
    const sameTierRemaining = samePosition.filter(
      (candidate) => numberOrNull(candidate?.tier) === currentTier
    ).length;
    const tierDrop = Math.max(0, nextTier - currentTier);
    const rankDrop = Math.max(0, nextRank - currentRank);
    const exhaustionRisk = Math.max(
      0,
      (numberOrNull(picksUntilNext) ?? 0) - sameTierRemaining
    );

    return Number(clamp(
      tierDrop * 4 + rankDrop * 0.18 + exhaustionRisk * 0.45,
      0,
      14
    ).toFixed(1));
  }

  function getAvailabilityCalibrationReport(records = [], drafts = []) {
    const draftsById = new Map(
      (Array.isArray(drafts) ? drafts : [])
        .filter((draft) => draft?.draftId)
        .map((draft) => [String(draft.draftId), draft])
    );
    const evaluated = [];

    (Array.isArray(records) ? records : []).forEach((record) => {
      const draft = draftsById.get(String(record?.draftId || ""));
      const targetPick = numberOrNull(record?.targetPick);
      const predicted = numberOrNull(record?.predictedAvailableProbability);
      const picks = Array.isArray(draft?.picks) ? draft.picks : [];
      const depth = numberOrNull(draft?.depth) ?? numberOrNull(draft?.totalPicks) ?? 0;

      if (!draft || targetPick === null || predicted === null || depth < targetPick) return;

      const playerId = String(record?.playerId || "");
      const playerName = String(record?.playerName || "").toLowerCase();
      const selected = picks.find((pick) =>
        (playerId && String(pick?.playerId || "") === playerId) ||
        (playerName && String(pick?.name || "").toLowerCase() === playerName)
      );
      const selectedAt = numberOrNull(selected?.overall);
      const actualAvailable = selectedAt === null || selectedAt >= targetPick ? 1 : 0;
      const predictedRate = clamp(predicted, 0, 100) / 100;
      const userPick = (Array.isArray(draft?.userPicks) ? draft.userPicks : [])
        .find((pick) => numberOrNull(pick?.overall) === targetPick);
      const userPickId = String(userPick?.playerId || userPick?.id || "");
      const userPickName = String(userPick?.name || "").toLowerCase();
      const alternateId = String(record?.alternateId || "");
      const alternateName = String(record?.alternateName || "").toLowerCase();
      const selectedRecommended = Boolean(
        userPick && (
          (playerId && userPickId === playerId) ||
          (playerName && userPickName === playerName)
        )
      );
      const selectedAlternate = Boolean(
        userPick && (
          (alternateId && userPickId === alternateId) ||
          (alternateName && userPickName === alternateName)
        )
      );

      evaluated.push({
        ...record,
        actualAvailable,
        selectedAt,
        selectedRecommended,
        selectedAlternate,
        squaredError: Math.pow(predictedRate - actualAvailable, 2),
      });
    });

    const buckets = [
      [0, 19],
      [20, 39],
      [40, 59],
      [60, 79],
      [80, 100],
    ].map(([min, max]) => {
      const matches = evaluated.filter((record) => {
        const probability = numberOrNull(record.predictedAvailableProbability) ?? 0;
        return probability >= min && probability <= max;
      });
      const averagePredicted = matches.length
        ? matches.reduce((sum, record) => sum + record.predictedAvailableProbability, 0) / matches.length
        : null;
      const actualRate = matches.length
        ? (matches.reduce((sum, record) => sum + record.actualAvailable, 0) / matches.length) * 100
        : null;

      return { min, max, sampleSize: matches.length, averagePredicted, actualRate };
    });
    const actualRate = evaluated.length
      ? (evaluated.reduce((sum, record) => sum + record.actualAvailable, 0) / evaluated.length) * 100
      : null;
    const averagePredicted = evaluated.length
      ? evaluated.reduce((sum, record) => sum + record.predictedAvailableProbability, 0) / evaluated.length
      : null;
    const recommendationSelections = evaluated.filter(
      (record) => record.selectedRecommended
    ).length;
    const alternateSelections = evaluated.filter(
      (record) => record.selectedAlternate
    ).length;

    return {
      sampleSize: evaluated.length,
      brierScore: evaluated.length
        ? evaluated.reduce((sum, record) => sum + record.squaredError, 0) / evaluated.length
        : null,
      averagePredicted,
      actualRate,
      bias: actualRate === null || averagePredicted === null
        ? null
        : actualRate - averagePredicted,
      recommendationSelections,
      alternateSelections,
      followedRate: evaluated.length
        ? ((recommendationSelections + alternateSelections) / evaluated.length) * 100
        : null,
      buckets,
      evaluated,
    };
  }

  function calibrateAvailabilityProbability(probability, calibrationReport) {
    const raw = clamp(numberOrNull(probability) ?? 50, 0, 100);
    const bucket = (calibrationReport?.buckets || []).find(
      (candidate) => raw >= candidate.min && raw <= candidate.max
    );
    const bucketSample = bucket?.sampleSize || 0;
    const overallSample = calibrationReport?.sampleSize || 0;
    const bucketAdjustment = bucketSample >= 3 && bucket.actualRate !== null
      ? (bucket.actualRate - bucket.averagePredicted) * (bucketSample / (bucketSample + 12))
      : 0;
    const overallAdjustment = overallSample >= 5 && calibrationReport?.bias !== null
      ? calibrationReport.bias * (overallSample / (overallSample + 25))
      : 0;

    return Math.round(clamp(
      raw + clamp(bucketAdjustment + overallAdjustment, -15, 15),
      1,
      99
    ));
  }

  function getRosterNeeds(counts = {}, inputSettings = {}) {
    const settings = normalizeLeagueSettings(inputSettings);
    const normalizedCounts = {
      QB: Number(counts.QB) || 0,
      RB: Number(counts.RB) || 0,
      WR: Number(counts.WR) || 0,
      TE: Number(counts.TE) || 0,
    };

    const baseNeeds = {
      QB: Math.max(0, settings.qb - normalizedCounts.QB),
      RB: Math.max(0, settings.rb - normalizedCounts.RB),
      WR: Math.max(0, settings.wr - normalizedCounts.WR),
      TE: Math.max(0, settings.te - normalizedCounts.TE),
    };

    const flexFilled = Math.min(
      settings.flex,
      Math.max(0, normalizedCounts.RB - settings.rb) +
        Math.max(0, normalizedCounts.WR - settings.wr) +
        Math.max(0, normalizedCounts.TE - settings.te)
    );

    return {
      baseNeeds,
      flexFilled,
      flexNeed: Math.max(0, settings.flex - flexFilled),
      startersFilled:
        baseNeeds.QB === 0 &&
        baseNeeds.RB === 0 &&
        baseNeeds.WR === 0 &&
        baseNeeds.TE === 0 &&
        flexFilled >= settings.flex,
    };
  }

  function getPositionTier(positionRank) {
    const rank = numberOrNull(positionRank);

    if (rank !== null && rank <= 7) {
      return { tier: 1, tierLabel: "S" };
    }

    if (rank !== null && rank <= 12) {
      return { tier: 2, tierLabel: "A" };
    }

    if (rank !== null && rank <= 24) {
      return { tier: 3, tierLabel: "B" };
    }

    if (rank !== null && rank <= 36) {
      return { tier: 4, tierLabel: "C" };
    }

    return { tier: 5, tierLabel: "D" };
  }

  function getPreviousSeasonFantasyPoints(player, scoring = "ppr") {
    const gameLog = Array.isArray(player?.stats?.gameLog)
      ? player.stats.gameLog
      : [];
    const receptionMultiplier = scoring === "ppr"
      ? 1
      : scoring === "standard"
        ? 0
        : 0.5;

    return gameLog.reduce((total, game) => {
      const pprPoints = numberOrNull(game?.fantasyPoints) ?? 0;
      const receptions = numberOrNull(game?.receptions) ?? 0;

      return total + pprPoints - receptions * (1 - receptionMultiplier);
    }, 0);
  }

  function getProjectedSeasonFantasyPoints(player) {
    return (
      numberOrNull(player?.proj) ??
      numberOrNull(player?.projection) ??
      numberOrNull(player?.stats?.projection)
    );
  }

  function getReplacementValueSnapshot(players = [], inputSettings = {}) {
    const settings = normalizeLeagueSettings(inputSettings);
    const flexShares = settings.scoring === "ppr"
      ? { RB: 0.4, WR: 0.52, TE: 0.08 }
      : settings.scoring === "standard"
        ? { RB: 0.55, WR: 0.4, TE: 0.05 }
        : { RB: 0.47, WR: 0.47, TE: 0.06 };
    const baseSlots = {
      QB: settings.qb,
      RB: settings.rb,
      WR: settings.wr,
      TE: settings.te,
    };
    const positions = {};

    ["QB", "RB", "WR", "TE"].forEach((position) => {
      const projected = (Array.isArray(players) ? players : [])
        .filter(
          (player) =>
            String(player?.pos || player?.position || "").toUpperCase() ===
            position
        )
        .map((player) => ({
          player,
          projection: getProjectedSeasonFantasyPoints(player),
        }))
        .filter((entry) => entry.projection !== null)
        .sort((a, b) => b.projection - a.projection);
      const flexDemand =
        (flexShares[position] || 0) * settings.flex;
      const starterDemand = Math.max(
        1,
        Math.ceil(
          settings.teamCount *
            (baseSlots[position] + flexDemand)
        )
      );
      const replacementIndex = Math.min(
        Math.max(0, starterDemand - 1),
        Math.max(0, projected.length - 1)
      );
      const replacementProjection = projected.length
        ? projected[replacementIndex].projection
        : 0;

      positions[position] = {
        starterDemand,
        replacementRank: replacementIndex + 1,
        replacementProjection,
        replacementPlayer: projected[replacementIndex]?.player || null,
      };
    });

    return {
      settings,
      positions,
    };
  }

  function getPlayerReplacementValue(player, snapshot = {}) {
    const position = String(
      player?.pos || player?.position || ""
    ).toUpperCase();
    const projection = getProjectedSeasonFantasyPoints(player);
    const replacementProjection = numberOrNull(
      snapshot?.positions?.[position]?.replacementProjection
    );

    if (projection === null || replacementProjection === null) {
      return {
        projection,
        replacementProjection,
        valueOverReplacement: null,
      };
    }

    return {
      projection,
      replacementProjection,
      valueOverReplacement: projection - replacementProjection,
    };
  }

  function applyFantasyPointTiers(
    players = [],
    scoring = "ppr",
    historicalPoints = {}
  ) {
    const normalizedScoring = ["standard", "half-ppr", "ppr"].includes(scoring)
      ? scoring
      : "ppr";
    const decorated = (Array.isArray(players) ? players : []).map(
      (player, index) => {
        const gameLog = Array.isArray(player?.stats?.gameLog)
          ? player.stats.gameLog
          : [];
        const currentGameLogPoints = getPreviousSeasonFantasyPoints(
          player,
          normalizedScoring
        );
        const playerHistory = historicalPoints?.[String(player?.id)] || {};
        const historicalFantasyPoints = {};
        const productionSeasons = [];

        [2023, 2024, 2025].forEach((season) => {
          const historicalSeason = playerHistory?.seasons?.[season];
          const games = numberOrNull(historicalSeason?.games) ?? 0;
          let points = numberOrNull(historicalSeason?.points);

          if (season === 2025 && points === null && gameLog.length > 0) {
            points = currentGameLogPoints;
          }

          if (points !== null && (games > 0 || season === 2025 && gameLog.length > 0)) {
            historicalFantasyPoints[season] = points;
            productionSeasons.push(points);
          }
        });

        const lastSeasonFantasyPoints =
          numberOrNull(historicalFantasyPoints[2025]) ?? 0;
        const multiYearProductionPoints = productionSeasons.length
          ? productionSeasons.reduce((sum, points) => sum + points, 0) /
            productionSeasons.length
          : 0;
        const projectedSeasonFantasyPoints = getProjectedSeasonFantasyPoints(
          player
        );
        const hasPreviousSeason = historicalFantasyPoints[2025] !== undefined;
        const hasProduction = productionSeasons.length > 0;
        const hasProjection =
          projectedSeasonFantasyPoints !== null &&
          projectedSeasonFantasyPoints > 0;
        const tierScore = hasProduction && hasProjection
          ? (multiYearProductionPoints + projectedSeasonFantasyPoints) / 2
          : hasProduction
            ? multiYearProductionPoints
            : hasProjection
              ? projectedSeasonFantasyPoints
              : 0;

        return {
          player,
          index,
          position: String(player?.pos || player?.position || "").toUpperCase(),
          hasPreviousSeason,
          hasProduction,
          hasProjection,
          historicalFantasyPoints,
          lastSeasonFantasyPoints,
          multiYearProductionPoints,
          projectedSeasonFantasyPoints,
          tierScore,
        };
      }
    );
    const tierPositionRanks = new Map();
    const lastSeasonPositionRanks = new Map();
    const multiYearProductionPositionRanks = new Map();
    const projectedSeasonPositionRanks = new Map();

    function rankPositionEntries(entries, scoreKey, rankMap) {
      entries
        .sort((a, b) =>
          b[scoreKey] - a[scoreKey] ||
          playerRank(a.player) - playerRank(b.player) ||
          a.index - b.index
        )
        .forEach((entry, index) => {
          rankMap.set(entry.index, index + 1);
        });
    }

    ["QB", "RB", "WR", "TE"].forEach((position) => {
      const positionEntries = decorated.filter(
        (entry) => entry.position === position
      );

      rankPositionEntries(
        [...positionEntries],
        "tierScore",
        tierPositionRanks
      );
      rankPositionEntries(
        positionEntries.filter((entry) => entry.hasPreviousSeason),
        "lastSeasonFantasyPoints",
        lastSeasonPositionRanks
      );
      rankPositionEntries(
        positionEntries.filter((entry) => entry.hasProduction),
        "multiYearProductionPoints",
        multiYearProductionPositionRanks
      );
      rankPositionEntries(
        positionEntries.filter((entry) => entry.hasProjection),
        "projectedSeasonFantasyPoints",
        projectedSeasonPositionRanks
      );
    });

    return decorated.map((entry) => {
      const positionRank = tierPositionRanks.get(entry.index) ?? null;
      const tier = getPositionTier(positionRank);

      return {
        ...entry.player,
        ...tier,
        historicalFantasyPoints: Object.fromEntries(
          Object.entries(entry.historicalFantasyPoints).map(([season, points]) => [
            season,
            Math.round(points * 10) / 10,
          ])
        ),
        lastSeasonFantasyPoints:
          Math.round(entry.lastSeasonFantasyPoints * 10) / 10,
        multiYearProductionPoints:
          Math.round(entry.multiYearProductionPoints * 10) / 10,
        projectedSeasonFantasyPoints:
          entry.projectedSeasonFantasyPoints === null
            ? null
            : Math.round(entry.projectedSeasonFantasyPoints * 10) / 10,
        tierScore: Math.round(entry.tierScore * 10) / 10,
        tierPositionRank: positionRank,
        lastSeasonPositionRank:
          lastSeasonPositionRanks.get(entry.index) ?? null,
        multiYearProductionPositionRank:
          multiYearProductionPositionRanks.get(entry.index) ?? null,
        projectedSeasonPositionRank:
          projectedSeasonPositionRanks.get(entry.index) ?? null,
        tierBasis:
          "50% average 2023-2025 PPR production + 50% 2026 projected PPR points",
      };
    });
  }

  function applyPreviousSeasonTiers(
    players = [],
    scoring = "ppr",
    historicalPoints = {}
  ) {
    return applyFantasyPointTiers(players, scoring, historicalPoints);
  }

  function numberOrNull(value) {
    if (value === null || value === undefined || value === "" || value === "-") {
      return null;
    }

    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function playerRank(player) {
    return (
      numberOrNull(player?.rank) ??
      numberOrNull(player?.overall_rank) ??
      numberOrNull(player?.adp) ??
      9999
    );
  }

  function getTierDropWarning(player, availablePlayers = []) {
    if (!player) return null;

    const pos = String(player.pos || player.position || "").toUpperCase();
    const samePosition = availablePlayers
      .filter(
        (candidate) =>
          String(candidate.pos || candidate.position || "").toUpperCase() ===
          pos
      )
      .sort((a, b) =>
        (numberOrNull(a?.tier) ?? 999) -
          (numberOrNull(b?.tier) ?? 999) ||
        playerRank(a) - playerRank(b)
      );

    const playerId = String(player.id ?? player.name ?? "");
    const index = samePosition.findIndex(
      (candidate) => String(candidate.id ?? candidate.name ?? "") === playerId
    );

    if (index < 0) return null;

    const next = samePosition[index + 1];
    const currentTier = numberOrNull(player.tier);
    const nextTier = numberOrNull(next?.tier);
    const currentTierLabel = player.tierLabel || currentTier;
    const rankGap = next ? playerRank(next) - playerRank(player) : 20;

    if (
      currentTier !== null &&
      currentTier < 5 &&
      (!next || (nextTier !== null && nextTier > currentTier))
    ) {
      return {
        severity: "high",
        message: `Last Tier ${currentTierLabel} ${pos} before a tier drop`,
        rankGap,
      };
    }

    if (rankGap >= 12) {
      return {
        severity: "medium",
        message: `${pos} value drops ${Math.round(rankGap)} ranks after this player`,
        rankGap,
      };
    }

    return null;
  }

  function getAvailabilityUrgency(player, lookaheadPick) {
    const adp = numberOrNull(player?.adp);

    if (adp === null || !Number.isFinite(Number(lookaheadPick))) {
      return { score: 0, likelyGone: false, canWait: false };
    }

    const gap = Number(lookaheadPick) - adp;

    return {
      score: clamp((gap + 2) * 1.5, -10, 30),
      likelyGone: adp <= Number(lookaheadPick) + 2,
      canWait: adp >= Number(lookaheadPick) + 10,
      gap,
    };
  }

  function getPrioritizedAdp(input = {}) {
    const marketSources = [
      { value: numberOrNull(input.yahooAdp), weight: 0.5 },
      { value: numberOrNull(input.espnAdp), weight: 0.25 },
      { value: numberOrNull(input.sleeperAdp), weight: 0.25 },
    ].filter((source) => source.value !== null && source.value > 0);
    const marketWeight = marketSources.reduce(
      (sum, source) => sum + source.weight,
      0
    );
    const marketAdp = marketWeight
      ? marketSources.reduce(
          (sum, source) => sum + source.value * source.weight,
          0
        ) / marketWeight
      : numberOrNull(input.fallbackAdp);
    const personalAdp = numberOrNull(input.personalAdp);
    const completedMocks = Math.max(
      0,
      numberOrNull(input.completedMocks) ?? 0
    );
    const goal = Math.max(1, numberOrNull(input.goal) ?? 25);
    const personalSampleSize = Math.max(
      0,
      numberOrNull(input.personalSampleSize) ?? 0
    );

    if (
      personalAdp === null ||
      personalAdp <= 0 ||
      personalSampleSize === 0
    ) {
      return {
        adp: marketAdp,
        marketAdp,
        personalAdp: null,
        personalWeight: 0,
        marketWeight: 1,
        personalPriority: false,
      };
    }

    const reachedGoal = completedMocks >= goal;
    const personalPriority = reachedGoal;
    const progress = clamp(completedMocks / goal, 0, 1);
    const sampleConfidence = clamp(personalSampleSize / 10, 0, 1);
    const personalWeight = personalPriority
      ? 1
      : 0.45 * progress * sampleConfidence;

    if (marketAdp === null) {
      return {
        adp: personalAdp,
        marketAdp: null,
        personalAdp,
        personalWeight: 1,
        marketWeight: 0,
        personalPriority: true,
      };
    }

    return {
      adp:
        personalAdp * personalWeight +
        marketAdp * (1 - personalWeight),
      marketAdp,
      personalAdp,
      personalWeight,
      marketWeight: 1 - personalWeight,
      personalPriority,
    };
  }

  function getTierRecommendationValue(player) {
    const tier = numberOrNull(player?.tier);

    return ({
      1: 42,
      2: 28,
      3: 15,
      4: 6,
      5: 0,
    })[tier] ?? 0;
  }

  function getTierMarketSnapshot(
    recentPlayers = [],
    availablePlayers = [],
    positionPressure = {}
  ) {
    const positions = {};
    const validRecentPlayers = (Array.isArray(recentPlayers)
      ? recentPlayers
      : []
    ).filter((player) =>
      ["QB", "RB", "WR", "TE"].includes(
        String(player?.pos || player?.position || "").toUpperCase()
      )
    );
    const available = Array.isArray(availablePlayers)
      ? availablePlayers
      : [];

    ["QB", "RB", "WR", "TE"].forEach((position) => {
      const recentAtPosition = validRecentPlayers.filter(
        (player) =>
          String(player?.pos || player?.position || "").toUpperCase() ===
          position
      );
      const availableAtPosition = available.filter(
        (player) =>
          String(player?.pos || player?.position || "").toUpperCase() ===
          position
      );
      const recentS = recentAtPosition.filter(
        (player) => numberOrNull(player?.tier) === 1
      ).length;
      const recentA = recentAtPosition.filter(
        (player) => numberOrNull(player?.tier) === 2
      ).length;
      const remainingS = availableAtPosition.filter(
        (player) => numberOrNull(player?.tier) === 1
      ).length;
      const remainingA = availableAtPosition.filter(
        (player) => numberOrNull(player?.tier) === 2
      ).length;
      const recentPremium = recentS + recentA;
      const remainingPremium = remainingS + remainingA;
      const teamsNeeding = Math.max(
        0,
        numberOrNull(positionPressure?.[position]) ?? 0
      );
      const shortage = Math.max(0, teamsNeeding - remainingPremium);
      const runScore = clamp(
        Math.max(0, recentAtPosition.length - 2) * 3 + recentPremium * 2,
        0,
        20
      );
      const demandScore = clamp(teamsNeeding * 1.5, 0, 12);
      const shortageScore = clamp(shortage * 4, 0, 16);

      positions[position] = {
        sampleSize: validRecentPlayers.length,
        recentPicks: recentAtPosition.length,
        recentS,
        recentA,
        recentPremium,
        remainingS,
        remainingA,
        remainingPremium,
        teamsNeeding,
        shortage,
        isRun:
          recentAtPosition.length >= 4 ||
          recentPremium >= 3,
        pressureScore: clamp(
          runScore + demandScore + shortageScore,
          0,
          40
        ),
      };
    });

    return {
      recentSampleSize: validRecentPlayers.length,
      positions,
    };
  }

  function getPlayerMarketPressure(player, marketSnapshot) {
    const position = String(
      player?.pos || player?.position || ""
    ).toUpperCase();
    const tier = numberOrNull(player?.tier);
    const tierMultiplier = ({
      1: 1,
      2: 0.85,
      3: 0.45,
      4: 0.15,
      5: 0,
    })[tier] ?? 0;
    const pressure = numberOrNull(
      marketSnapshot?.positions?.[position]?.pressureScore
    ) ?? 0;

    return pressure * tierMultiplier;
  }

  function getPprEarlyRbScarcity(input = {}) {
    const scoring = String(input.scoring || "").toLowerCase();
    const roundNumber = Math.max(
      1,
      numberOrNull(input.roundNumber) ?? 1
    );
    const availablePlayers = Array.isArray(input.availablePlayers)
      ? input.availablePlayers
      : [];
    const starterWorthy = availablePlayers.filter((player) => {
      const position = String(
        player?.pos || player?.position || ""
      ).toUpperCase();
      const tier = numberOrNull(player?.tier);

      return ["RB", "WR"].includes(position) &&
        tier !== null &&
        tier <= 3;
    });
    const premium = starterWorthy.filter(
      (player) => numberOrNull(player?.tier) <= 2
    );
    const rbStarterWorthy = starterWorthy.filter(
      (player) => String(player?.pos || player?.position || "").toUpperCase() === "RB"
    ).length;
    const wrStarterWorthy = starterWorthy.filter(
      (player) => String(player?.pos || player?.position || "").toUpperCase() === "WR"
    ).length;
    const rbPremium = premium.filter(
      (player) => String(player?.pos || player?.position || "").toUpperCase() === "RB"
    ).length;
    const wrPremium = premium.filter(
      (player) => String(player?.pos || player?.position || "").toUpperCase() === "WR"
    ).length;
    const rbNeed = Math.max(0, numberOrNull(input.rbNeed) ?? 0);
    const flexNeed = Math.max(0, numberOrNull(input.flexNeed) ?? 0);
    const active = scoring === "ppr" && roundNumber <= 5;

    if (!active || (rbNeed === 0 && flexNeed === 0)) {
      return {
        active: false,
        adjustment: 0,
        rbStarterWorthy,
        wrStarterWorthy,
        rbPremium,
        wrPremium,
      };
    }

    const roundMultiplier = ({
      1: 0.65,
      2: 1,
      3: 1,
      4: 0.8,
      5: 0.45,
    })[Math.floor(roundNumber)] ?? 0;
    const starterSupplyGap = wrStarterWorthy - rbStarterWorthy;
    const premiumSupplyGap = wrPremium - rbPremium;
    const supplyAdjustment = clamp(starterSupplyGap * 0.75, -4, 6);
    const premiumAdjustment = clamp(premiumSupplyGap * 0.6, -2, 3);
    const rosterMultiplier = rbNeed > 0 ? 1 : 0.45;
    const adjustment = clamp(
      (5 + supplyAdjustment + premiumAdjustment) *
        roundMultiplier *
        rosterMultiplier,
      0,
      12
    );

    return {
      active: adjustment > 0,
      adjustment,
      rbStarterWorthy,
      wrStarterWorthy,
      rbPremium,
      wrPremium,
      starterSupplyGap,
      premiumSupplyGap,
    };
  }

  function stackPlayerKey(player) {
    const id = player?.id ?? player?.playerId;

    if (id !== null && id !== undefined && id !== "") {
      return `id:${String(id)}`;
    }

    return `name:${String(player?.name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")}`;
  }

  function isStackPair(firstPlayer, secondPlayer) {
    const firstPosition = String(
      firstPlayer?.pos || firstPlayer?.position || ""
    ).toUpperCase();
    const secondPosition = String(
      secondPlayer?.pos || secondPlayer?.position || ""
    ).toUpperCase();

    return (
      ["QB", "RB", "WR", "TE"].includes(firstPosition) &&
      ["QB", "RB", "WR", "TE"].includes(secondPosition) &&
      stackPlayerKey(firstPlayer) !== stackPlayerKey(secondPlayer)
    );
  }

  function isTraditionalStackPair(firstPlayer, secondPlayer) {
    const firstPosition = String(
      firstPlayer?.pos || firstPlayer?.position || ""
    ).toUpperCase();
    const secondPosition = String(
      secondPlayer?.pos || secondPlayer?.position || ""
    ).toUpperCase();

    return (
      (firstPosition === "QB" && ["WR", "TE"].includes(secondPosition)) ||
      (secondPosition === "QB" && ["WR", "TE"].includes(firstPosition))
    );
  }

  function getStackTargets(rosterPlayers = [], availablePlayers = []) {
    const roster = Array.isArray(rosterPlayers) ? rosterPlayers : [];
    const available = Array.isArray(availablePlayers) ? availablePlayers : [];

    return available
      .map((candidate) => {
        const team = String(candidate?.team || "").toUpperCase();
        const tier = numberOrNull(candidate?.tier);

        if (
          !team ||
          team === "-" ||
          tier === null ||
          tier > 5 ||
          !["QB", "RB", "WR", "TE"].includes(
            String(candidate?.pos || candidate?.position || "").toUpperCase()
          )
        ) {
          return null;
        }

        const anchors = roster.filter((rosterPlayer) => {
          return (
            String(rosterPlayer?.team || "").toUpperCase() === team &&
            isStackPair(candidate, rosterPlayer)
          );
        });

        if (!anchors.length) return null;

        const sortedAnchors = [...anchors].sort((a, b) => {
          const aTraditional = isTraditionalStackPair(candidate, a) ? 1 : 0;
          const bTraditional = isTraditionalStackPair(candidate, b) ? 1 : 0;
          const aTier = numberOrNull(a?.tier) ?? 99;
          const bTier = numberOrNull(b?.tier) ?? 99;
          const aRank = numberOrNull(a?.rank) ?? 9999;
          const bRank = numberOrNull(b?.rank) ?? 9999;

          return bTraditional - aTraditional || aTier - bTier || aRank - bRank;
        });
        const anchor = sortedAnchors[0];
        const traditionalStack = isTraditionalStackPair(candidate, anchor);
        const traditionalBonus = ({
          1: 4,
          2: 3,
          3: 2,
          4: 1,
          5: 0.5,
        })[tier] ?? 0;
        const bonus = traditionalStack
          ? traditionalBonus
          : traditionalBonus * 0.5;

        return {
          player: candidate,
          playerKey: stackPlayerKey(candidate),
          anchor,
          anchors: sortedAnchors,
          bonus,
          connectionType: traditionalStack ? "stack" : "team-affinity",
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const aTier = numberOrNull(a.player?.tier) ?? 99;
        const bTier = numberOrNull(b.player?.tier) ?? 99;
        const aRank = numberOrNull(a.player?.rank) ?? 9999;
        const bRank = numberOrNull(b.player?.rank) ?? 9999;

        return (
          b.bonus - a.bonus ||
          aTier - bTier ||
          aRank - bRank
        );
      });
  }

  function getPlayerStackBonus(player, stackTargets = []) {
    const playerKey = stackPlayerKey(player);
    const target = (Array.isArray(stackTargets) ? stackTargets : [])
      .find((candidate) => candidate?.playerKey === playerKey);

    return target
      ? {
          bonus: numberOrNull(target.bonus) ?? 0,
          target,
        }
      : {
          bonus: 0,
          target: null,
        };
  }

  function getRbHandcuffTargets(
    rosterPlayers = [],
    availablePlayers = [],
    roundNumber = 1
  ) {
    const round = Math.max(1, numberOrNull(roundNumber) ?? 1);

    if (round < 8) return [];

    const rosterRbs = (Array.isArray(rosterPlayers) ? rosterPlayers : [])
      .filter(
        (player) =>
          String(player?.pos || player?.position || "").toUpperCase() === "RB"
      );
    const roundBonus = round >= 13
      ? 2
      : round >= 11
        ? 1.5
        : 0.75;

    return (Array.isArray(availablePlayers) ? availablePlayers : [])
      .filter(
        (candidate) =>
          String(candidate?.pos || candidate?.position || "").toUpperCase() ===
          "RB"
      )
      .map((candidate) => {
        const candidateTeam = String(candidate?.team || "").toUpperCase();
        const candidateRank = numberOrNull(candidate?.rank) ?? 9999;
        const candidateProjection = getProjectedSeasonFantasyPoints(candidate);

        if (candidateRank > 220 || candidateProjection === null) {
          return null;
        }

        const anchor = rosterRbs
          .filter((rosterRb) => {
            const anchorRank = numberOrNull(rosterRb?.rank) ?? 9999;

            return (
              candidateTeam &&
              candidateTeam !== "-" &&
              String(rosterRb?.team || "").toUpperCase() === candidateTeam &&
              anchorRank < candidateRank
            );
          })
          .sort(
            (a, b) =>
              (numberOrNull(a?.rank) ?? 9999) -
              (numberOrNull(b?.rank) ?? 9999)
          )[0];

        if (!anchor) return null;

        return {
          player: candidate,
          playerKey: stackPlayerKey(candidate),
          anchor,
          bonus: roundBonus,
        };
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          (numberOrNull(a.player?.rank) ?? 9999) -
          (numberOrNull(b.player?.rank) ?? 9999)
      );
  }

  function getPlayerHandcuffBonus(player, handcuffTargets = []) {
    const playerKey = stackPlayerKey(player);
    const target = (Array.isArray(handcuffTargets) ? handcuffTargets : [])
      .find((candidate) => candidate?.playerKey === playerKey);

    return target
      ? {
          bonus: numberOrNull(target.bonus) ?? 0,
          target,
        }
      : {
          bonus: 0,
          target: null,
        };
  }

  function simulateDraftPaths(input = {}) {
    const candidates = Array.isArray(input.candidates)
      ? input.candidates.slice(0, Math.max(1, input.maxCandidates || 8))
      : [];
    const availablePlayers = Array.isArray(input.availablePlayers)
      ? input.availablePlayers
      : [];
    const currentRoster = Array.isArray(input.currentRoster)
      ? input.currentRoster
      : [];
    const futurePicks = Array.isArray(input.futurePicks)
      ? input.futurePicks.slice(0, 3)
      : [];
    const getAvailability = typeof input.getAvailability === "function"
      ? input.getAvailability
      : () => 50;
    const getFutureValue = typeof input.getFutureValue === "function"
      ? input.getFutureValue
      : () => 0;
    const getKey = typeof input.getPlayerKey === "function"
      ? input.getPlayerKey
      : stackPlayerKey;
    const paths = candidates.map((candidate) => {
      const firstPlayer = candidate.player || candidate;
      const roster = [...currentRoster, firstPlayer];
      const usedKeys = new Set([getKey(firstPlayer)]);
      const selections = [];
      let futureValue = 0;

      futurePicks.forEach((pick) => {
        const options = availablePlayers
          .filter((player) => !usedKeys.has(getKey(player)))
          .map((player) => {
            const probability = clamp(
              numberOrNull(getAvailability(player, pick, roster)) ?? 50,
              0,
              100
            );
            const playerValue =
              numberOrNull(getFutureValue(player, pick, roster)) ?? 0;

            return {
              player,
              probability,
              playerValue,
              expectedValue: playerValue * (probability / 100),
            };
          })
          .filter((option) => option.probability >= 20)
          .sort(
            (a, b) =>
              b.expectedValue - a.expectedValue ||
              b.playerValue - a.playerValue
          );
        const selected = options[0];

        if (!selected) return;

        selections.push({
          pick,
          ...selected,
        });
        futureValue += selected.expectedValue;
        usedKeys.add(getKey(selected.player));
        roster.push(selected.player);
      });

      return {
        candidate,
        firstPlayer,
        selections,
        futureValue,
        pathAdjustment: 0,
        pathScore: numberOrNull(candidate.decisionScore) ?? 0,
      };
    });
    const averageFutureValue = paths.length
      ? paths.reduce((sum, path) => sum + path.futureValue, 0) / paths.length
      : 0;

    paths.forEach((path) => {
      path.pathAdjustment = clamp(
        (path.futureValue - averageFutureValue) * 0.12,
        -10,
        10
      );
      path.pathScore =
        (numberOrNull(path.candidate?.decisionScore) ?? 0) +
        path.pathAdjustment;
    });

    return paths.sort((a, b) => b.pathScore - a.pathScore);
  }

  function getNowVsLaterScore(input = {}) {
    const baseScore = numberOrNull(input.baseScore) ?? 0;
    const goneProbability = clamp(
      numberOrNull(input.goneProbability) ?? 0,
      0,
      100
    );
    const valueAtRisk =
      Math.max(0, numberOrNull(input.tierValueScore) ?? 0) +
      Math.max(0, numberOrNull(input.needScore) ?? 0) * 0.35 +
      Math.max(0, numberOrNull(input.marketPressureScore) ?? 0) +
      Math.max(0, numberOrNull(input.scarcity) ?? 0) * 0.5 +
      Math.max(0, numberOrNull(input.pprRbScarcityScore) ?? 0) * 0.5 +
      Math.max(0, numberOrNull(input.stackScore) ?? 0) * 0.35 +
      Math.max(0, numberOrNull(input.handcuffScore) ?? 0) * 0.2 +
      Math.max(0, numberOrNull(input.projectionScore) ?? 0) * 0.25;
    const waitCost = (goneProbability / 100) * valueAtRisk;

    return {
      decisionScore: baseScore + waitCost,
      waitCost,
      valueAtRisk,
    };
  }

  function percentile(values, percentileValue) {
    const numbers = (Array.isArray(values) ? values : [])
      .map(numberOrNull)
      .filter((value) => value !== null)
      .sort((a, b) => a - b);

    if (!numbers.length) return null;
    if (numbers.length === 1) return numbers[0];

    const position = clamp(Number(percentileValue) || 0, 0, 1) *
      (numbers.length - 1);
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.ceil(position);
    const fraction = position - lowerIndex;

    return numbers[lowerIndex] +
      (numbers[upperIndex] - numbers[lowerIndex]) * fraction;
  }

  function draftMatchesCohort(draft = {}, cohort = {}) {
    const fields = ["teamCount", "scoring", "source"];

    return fields.every((field) => {
      const expected = cohort[field];
      const actual = draft[field];

      if (
        expected === null ||
        expected === undefined ||
        expected === "" ||
        actual === null ||
        actual === undefined ||
        actual === ""
      ) {
        return true;
      }

      return String(actual).toLowerCase() === String(expected).toLowerCase();
    });
  }

  function getHistoricalDraftMetrics(
    playerHistory,
    draftContexts = [],
    targetPick,
    cohort = {}
  ) {
    const target = numberOrNull(targetPick);
    const contexts = (Array.isArray(draftContexts) ? draftContexts : [])
      .filter((draft) => draft?.draftId && draftMatchesCohort(draft, cohort));
    const contextIds = new Set(
      contexts.map((draft) => String(draft.draftId))
    );
    const picks = (Array.isArray(playerHistory?.picks)
      ? playerHistory.picks
      : [])
      .map((pick) => ({
        ...pick,
        overall: numberOrNull(pick?.overall),
      }))
      .filter(
        (pick) =>
          pick.draftId &&
          pick.overall !== null &&
          contextIds.has(String(pick.draftId))
      );
    const pickByDraftId = new Map(
      picks.map((pick) => [String(pick.draftId), pick.overall])
    );
    let availableCount = 0;
    let goneCount = 0;

    if (target !== null) {
      contexts.forEach((draft) => {
        const draftId = String(draft.draftId);
        const playerPick = pickByDraftId.get(draftId);
        const depth =
          numberOrNull(draft.depth) ??
          numberOrNull(draft.totalPicks) ??
          0;

        if (playerPick !== undefined) {
          if (playerPick >= target) {
            availableCount += 1;
          } else {
            goneCount += 1;
          }

          return;
        }

        if (depth >= target) {
          availableCount += 1;
        }
      });
    }

    const pickNumbers = picks.map((pick) => pick.overall);
    const pickTotal = pickNumbers.reduce((sum, value) => sum + value, 0);
    const probabilitySampleSize = availableCount + goneCount;
    const averagePick = pickNumbers.length
      ? pickTotal / pickNumbers.length
      : null;
    const variance = averagePick === null
      ? null
      : pickNumbers.reduce(
          (sum, value) => sum + Math.pow(value - averagePick, 2),
          0
        ) / pickNumbers.length;
    const standardDeviation = variance === null
      ? null
      : Math.sqrt(variance);
    const baselineAdp = numberOrNull(cohort?.baselineAdp);
    const fallPastBaselineCount = baselineAdp === null
      ? 0
      : pickNumbers.filter((pick) => pick > baselineAdp).length;

    return {
      probabilitySampleSize,
      pickSampleSize: pickNumbers.length,
      availableCount,
      goneCount,
      availableProbability: probabilitySampleSize
        ? (availableCount / probabilitySampleSize) * 100
        : null,
      averagePick,
      medianPick: percentile(pickNumbers, 0.5),
      rangeStart: percentile(pickNumbers, 0.25),
      rangeEnd: percentile(pickNumbers, 0.75),
      earliestPick: pickNumbers.length ? Math.min(...pickNumbers) : null,
      latestPick: pickNumbers.length ? Math.max(...pickNumbers) : null,
      standardDeviation,
      volatility: standardDeviation === null
        ? null
        : standardDeviation <= 4
          ? "Stable"
          : standardDeviation <= 9
            ? "Moderate"
            : "Volatile",
      baselineAdp,
      fallPastBaselineCount,
      fallPastBaselineProbability:
        baselineAdp !== null && pickNumbers.length
          ? (fallPastBaselineCount / pickNumbers.length) * 100
          : null,
    };
  }

  function getHistoricalAvailabilityAtPicks(
    playerHistory,
    draftContexts = [],
    targetPicks = [],
    cohort = {}
  ) {
    return (Array.isArray(targetPicks) ? targetPicks : [])
      .map((pick) => ({
        pick: numberOrNull(pick),
        metrics: getHistoricalDraftMetrics(
          playerHistory,
          draftContexts,
          pick,
          cohort
        ),
      }))
      .filter((entry) => entry.pick !== null);
  }

  function getProjectedLineupValue(players = [], inputSettings = {}) {
    const settings = normalizeLeagueSettings(inputSettings);
    const decorated = (Array.isArray(players) ? players : [])
      .map((player) => ({
        player,
        position: String(
          player?.pos || player?.position || ""
        ).toUpperCase(),
        projection: getProjectedSeasonFantasyPoints(player) ?? 0,
      }))
      .filter((entry) => ["QB", "RB", "WR", "TE"].includes(entry.position));
    const used = new Set();
    const starters = [];

    ["QB", "RB", "WR", "TE"].forEach((position) => {
      const required = settings[position.toLowerCase()] || 0;
      decorated
        .filter((entry) => entry.position === position)
        .sort((a, b) => b.projection - a.projection)
        .slice(0, required)
        .forEach((entry) => {
          used.add(entry);
          starters.push(entry);
        });
    });

    decorated
      .filter(
        (entry) =>
          !used.has(entry) &&
          ["RB", "WR", "TE"].includes(entry.position)
      )
      .sort((a, b) => b.projection - a.projection)
      .slice(0, settings.flex)
      .forEach((entry) => {
        used.add(entry);
        starters.push(entry);
      });

    const bench = decorated
      .filter((entry) => !used.has(entry))
      .sort((a, b) => b.projection - a.projection);

    return {
      starters: starters.map((entry) => entry.player),
      bench: bench.map((entry) => entry.player),
      starterProjection: starters.reduce(
        (sum, entry) => sum + entry.projection,
        0
      ),
      benchProjection: bench.reduce(
        (sum, entry) => sum + entry.projection,
        0
      ),
    };
  }

  function getMockDraftStrategyReport(
    drafts = [],
    inputSettings = {},
    replacementSnapshot = null
  ) {
    const settings = normalizeLeagueSettings(inputSettings);
    const minimumUserPicks = Math.max(
      3,
      settings.qb +
        settings.rb +
        settings.wr +
        settings.te +
        settings.flex
    );
    const eligibleDrafts = (Array.isArray(drafts) ? drafts : [])
      .filter(
        (draft) =>
          draft?.completed &&
          Array.isArray(draft.userPicks) &&
          draft.userPicks.length >= minimumUserPicks
      )
      .map((draft) => {
        const userPicks = draft.userPicks.filter(Boolean);
        const opening = userPicks
          .slice(0, 3)
          .map((player) =>
            String(player?.pos || player?.position || "?").toUpperCase()
          )
          .join("-");
        const lineup = getProjectedLineupValue(userPicks, settings);
        const totalVorp = replacementSnapshot
          ? userPicks.reduce((sum, player) => {
              const vorp = getPlayerReplacementValue(
                player,
                replacementSnapshot
              ).valueOverReplacement;

              return sum + Math.max(0, vorp ?? 0);
            }, 0)
          : 0;

        return {
          draftId: draft.draftId,
          opening,
          userPicks,
          lineup,
          totalVorp,
        };
      });
    const groupsByOpening = new Map();

    eligibleDrafts.forEach((draft) => {
      if (!groupsByOpening.has(draft.opening)) {
        groupsByOpening.set(draft.opening, []);
      }

      groupsByOpening.get(draft.opening).push(draft);
    });

    const openings = Array.from(groupsByOpening.entries())
      .map(([opening, groupedDrafts]) => ({
        opening,
        sampleSize: groupedDrafts.length,
        averageStarterProjection:
          groupedDrafts.reduce(
            (sum, draft) => sum + draft.lineup.starterProjection,
            0
          ) / groupedDrafts.length,
        averageTotalVorp:
          groupedDrafts.reduce(
            (sum, draft) => sum + draft.totalVorp,
            0
          ) / groupedDrafts.length,
      }))
      .sort(
        (a, b) =>
          b.averageStarterProjection - a.averageStarterProjection ||
          b.averageTotalVorp - a.averageTotalVorp ||
          b.sampleSize - a.sampleSize
      );
    const qualifiedOpenings = openings.filter(
      (opening) => opening.sampleSize >= 2
    );

    return {
      draftCount: eligibleDrafts.length,
      openings,
      bestOpening: qualifiedOpenings[0] || openings[0] || null,
    };
  }

  function blendAvailabilityProbability(
    priorAvailableProbability,
    historicalMetrics,
    priorStrength = 10
  ) {
    const prior = clamp(
      numberOrNull(priorAvailableProbability) ?? 50,
      0,
      100
    );
    const historical = numberOrNull(
      historicalMetrics?.availableProbability
    );
    const sampleSize = Math.max(
      0,
      numberOrNull(historicalMetrics?.probabilitySampleSize) ?? 0
    );
    const strength = Math.max(0, numberOrNull(priorStrength) ?? 10);

    if (historical === null || sampleSize === 0) {
      return Math.round(prior);
    }

    const historicalWeight = sampleSize / (sampleSize + strength);

    return Math.round(
      clamp(
        historical * historicalWeight + prior * (1 - historicalWeight),
        0,
        100
      )
    );
  }

  return Object.freeze({
    DEFAULT_LEAGUE_SETTINGS,
    clamp,
    normalizeLeagueSettings,
    getOverallPick,
    getSnakeDraftSlot,
    getUserPickContext,
    getUpcomingUserPicks,
    getInterveningDraftSlots,
    getDraftSlotPositionTendencies,
    getDraftSlotNextPositionProbabilities,
    getOpponentRosterBehavior,
    getOpponentPositionProbabilities,
    getOffenseExposurePenalty,
    getStarterCompletionOutlook,
    getBenchAllocationPlan,
    getBenchAllocationAdjustment,
    getTierCliffOpportunityCost,
    getAvailabilityCalibrationReport,
    calibrateAvailabilityProbability,
    getRosterNeeds,
    getPositionTier,
    getPreviousSeasonFantasyPoints,
    getProjectedSeasonFantasyPoints,
    getReplacementValueSnapshot,
    getPlayerReplacementValue,
    applyFantasyPointTiers,
    applyPreviousSeasonTiers,
    getTierDropWarning,
    getAvailabilityUrgency,
    getPrioritizedAdp,
    getTierRecommendationValue,
    getTierMarketSnapshot,
    getPlayerMarketPressure,
    getPprEarlyRbScarcity,
    getStackTargets,
    getPlayerStackBonus,
    getRbHandcuffTargets,
    getPlayerHandcuffBonus,
    simulateDraftPaths,
    getNowVsLaterScore,
    getHistoricalDraftMetrics,
    getHistoricalAvailabilityAtPicks,
    getProjectedLineupValue,
    getMockDraftStrategyReport,
    blendAvailabilityProbability,
  });
});
