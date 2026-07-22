"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeLeagueList,
  normalizeLeagueSettings,
  normalizeRosterResponse,
  normalizeTeams,
} = require("../yahoo-normalize.js");

test("normalizes Yahoo league metadata and settings", () => {
  const data = {
    fantasy_content: {
      league: [
        { league_key: "461.l.12345" },
        { league_id: "12345" },
        { name: "Sunday Legends" },
        { num_teams: 12 },
        {
          settings: [
            {
              roster_positions: {
                0: { roster_position: [{ position: "QB" }, { count: 1 }] },
                1: { roster_position: [{ position: "RB" }, { count: 2 }] },
                2: { roster_position: [{ position: "WR" }, { count: 3 }] },
                3: { roster_position: [{ position: "TE" }, { count: 1 }] },
                4: { roster_position: [{ position: "W/R/T" }, { count: 2 }] },
                5: { roster_position: [{ position: "BN" }, { count: 6 }] },
              },
              stat_categories: {
                stats: {
                  0: {
                    stat: [
                      { stat_id: 11 },
                      { name: "Receptions" },
                      { display_name: "Rec" },
                    ],
                  },
                },
              },
              stat_modifiers: {
                stats: {
                  0: { stat: [{ stat_id: 11 }, { value: 0.5 }] },
                },
              },
            },
          ],
        },
      ],
    },
  };

  assert.equal(normalizeLeagueList(data)[0].name, "Sunday Legends");
  assert.deepEqual(normalizeLeagueSettings(data).settings, {
    teamCount: 12,
    qb: 1,
    rb: 2,
    wr: 3,
    te: 1,
    bench: 6,
    flex: 2,
    scoring: "half-ppr",
  });
});

test("normalizes all Yahoo teams and identifies the logged-in roster", () => {
  const teamsData = {
    teams: {
      0: {
        team: [
          { team_key: "461.l.12345.t.1" },
          { team_id: 1 },
          { name: "Mile High Club" },
          { managers: [{ manager: [{ nickname: "Coach" }, { is_current_login: 1 }] }] },
          { draft_position: 7 },
        ],
      },
      1: {
        team: [
          { team_key: "461.l.12345.t.2" },
          { team_id: 2 },
          { name: "Other Team" },
        ],
      },
    },
  };
  const teams = normalizeTeams(teamsData);
  const rosterData = {
    team: [
      ...teamsData.teams[0].team,
      {
        roster: {
          players: {
            0: {
              player: [
                { player_key: "461.p.101" },
                { player_id: 101 },
                { name: { full: "Bijan Robinson" } },
                { editorial_team_abbr: "ATL" },
                { display_position: "RB" },
                { selected_position: { position: "RB" } },
              ],
            },
          },
        },
      },
    ],
  };
  const roster = normalizeRosterResponse(rosterData, teams[0]);

  assert.equal(teams.length, 2);
  assert.equal(roster.isCurrentUser, true);
  assert.equal(roster.draftPosition, 7);
  assert.deepEqual(roster.players[0], {
    key: "461.p.101",
    id: "101",
    name: "Bijan Robinson",
    team: "ATL",
    pos: "RB",
    rosterPosition: "RB",
    status: "",
  });
});
