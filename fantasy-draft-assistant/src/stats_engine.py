"""
Fantasy Statistics Engine

This module performs calculations on raw player statistics.

Nothing in here communicates with ESPN.
Everything operates on data we've already downloaded.
"""


def safe_int(value):
    if value in (None, "-", ""):
        return 0

    try:
        return int(float(value))
    except ValueError:
        return 0


def calculate_fantasy_points(game, scoring_rules):
    """
    Calculate fantasy points using loaded league scoring rules.
    """

    stats = game["stats"]

    points = 0

    # Passing
    points += safe_int(stats.get("passingYards")) * scoring_rules["passing_yards"]
    points += safe_int(stats.get("passingTouchdowns")) * scoring_rules["passing_touchdowns"]
    points += safe_int(stats.get("interceptions")) * scoring_rules["interceptions"]

    # Rushing
    points += safe_int(stats.get("rushingYards")) * scoring_rules["rushing_yards"]
    points += safe_int(stats.get("rushingTouchdowns")) * scoring_rules["rushing_touchdowns"]

    # Receiving
    points += safe_int(stats.get("receptions")) * scoring_rules["receptions"]
    points += safe_int(stats.get("receivingYards")) * scoring_rules["receiving_yards"]
    points += safe_int(stats.get("receivingTouchdowns")) * scoring_rules["receiving_touchdowns"]

    # Fumbles
    points += safe_int(stats.get("fumblesLost")) * scoring_rules["fumbles_lost"]

    return round(points, 2)


def get_season_totals(player, scoring_rules):
    totals = {
        "games": 0,
        "passingYards": 0,
        "passingTouchdowns": 0,
        "interceptions": 0,
        "rushingAttempts": 0,
        "rushingYards": 0,
        "rushingTouchdowns": 0,
        "receivingTargets": 0,
        "receptions": 0,
        "receivingYards": 0,
        "receivingTouchdowns": 0,
        "fumbles": 0,
        "fumblesLost": 0,
        "fantasy_points": 0,
    }

    for game in player["games"]:
        totals["games"] += 1

        for stat_name in totals.keys():
            if stat_name in ("games", "fantasy_points"):
                continue

            totals[stat_name] += safe_int(game["stats"].get(stat_name))

        totals["fantasy_points"] += calculate_fantasy_points(game, scoring_rules)

    totals["fantasy_points"] = round(totals["fantasy_points"], 2)

    return totals


def average_fantasy_points(player, scoring_rules):
    if not player["games"]:
        return 0

    total = 0

    for game in player["games"]:
        total += calculate_fantasy_points(game, scoring_rules)

    return round(total / len(player["games"]), 2)


def ceiling(player, scoring_rules):
    if not player["games"]:
        return None

    best_game = None
    best_points = -1

    for game in player["games"]:
        points = calculate_fantasy_points(game, scoring_rules)

        if points > best_points:
            best_points = points

            best_game = {
                "espn_week": game.get("espn_week") or game.get("week"),
                "game_date": game.get("game_date"),
                "opponent": game.get("opponent"),
                "home_away": game.get("home_away"),
                "result": game.get("result"),
                "score": game.get("score"),
                "points": round(points, 2),
                "season": game["season"],
                "season_type": game["season_type"],
                "event_id": game["event_id"],
                "stats": game["stats"],
            }

    return best_game


def floor(player, scoring_rules):
    if not player["games"]:
        return None

    worst_game = None
    worst_points = float("inf")

    for game in player["games"]:
        points = calculate_fantasy_points(game, scoring_rules)

        if points < worst_points:
            worst_points = points

            worst_game = {
                "espn_week": game.get("espn_week"),
                "game_date": game.get("game_date"),
                "opponent": game.get("opponent"),
                "home_away": game.get("home_away"),
                "result": game.get("result"),
                "score": game.get("score"),
                "points": round(points, 2),
                "season": game["season"],
                "season_type": game["season_type"],
                "event_id": game["event_id"],
                "stats": game["stats"],
            }

    return worst_game