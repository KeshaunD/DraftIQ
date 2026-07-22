def flatten_stats(stats_data):
    """
    Converts ESPN's nested stats response into a simple dictionary.
    """

    flattened = {}

    categories = stats_data.get("splits", {}).get("categories", [])

    for category in categories:
        for stat in category.get("stats", []):
            stat_name = stat.get("name")
            stat_value = stat.get("value")

            if stat_name:
                flattened[stat_name] = stat_value

    return flattened


def build_career_summary(player, stats_data):
    """
    Creates the clean career summary we care about for fantasy.
    """

    stats = flatten_stats(stats_data)

    return {
        "espn_id": player["espn_id"],
        "name": player["name"],
        "team": player["team"],
        "position": player["position"],
        "career": {
            "games_played": stats.get("gamesPlayed"),
            "passing_completions": stats.get("completions"),
            "passing_yards": stats.get("passingYards"),
            "passing_tds": stats.get("passingTouchdowns"),
            "interceptions": stats.get("interceptions"),
            "rushing_attempts": stats.get("rushingAttempts"),
            "rushing_yards": stats.get("rushingYards"),
            "rushing_tds": stats.get("rushingTouchdowns"),
            "targets": stats.get("receivingTargets"),
            "receptions": stats.get("receptions"),
            "receiving_yards": stats.get("receivingYards"),
            "receiving_tds": stats.get("receivingTouchdowns"),
            "receiving_yards_per_game": stats.get("receivingYardsPerGame"),
            "yards_per_reception": stats.get("yardsPerReception"),
            "fumbles_lost": stats.get("fumblesLost"),
        },
    }