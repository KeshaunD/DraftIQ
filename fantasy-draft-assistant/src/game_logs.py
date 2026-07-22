OFFENSIVE_STATS = {
    "completions",
    "passingAttempts",
    "passingYards",
    "passingTouchdowns",
    "interceptions",
    "rushingAttempts",
    "rushingYards",
    "rushingTouchdowns",
    "receivingTargets",
    "receptions",
    "receivingYards",
    "receivingTouchdowns",
    "fumbles",
    "fumblesLost",
}


def clean_stat_value(value):
    if value in (None, "-", ""):
        return 0

    try:
        number = float(value)
        if number.is_integer():
            return int(number)
        return number
    except ValueError:
        return 0


def parse_game_logs(data):
    games = []

    stat_names = data.get("names", [])
    events_lookup = data.get("events", {})
    season_types = data.get("seasonTypes", [])

    for season_type in season_types:
        season_display = season_type.get("displayName", "")

        try:
            season = int(season_display.split()[0])
        except (ValueError, IndexError):
            season = None

        for category in season_type.get("categories", []):
            season_type_name = category.get("displayName")

            # Only keep regular season games.
            if season_type_name != "Regular Season Stats":
                continue

            for event in category.get("events", []):
                event_id = event.get("eventId")
                event_info = events_lookup.get(event_id, {})

                raw_stats = dict(zip(stat_names, event.get("stats", [])))

                fantasy_stats = {
                    stat_name: clean_stat_value(stat_value)
                    for stat_name, stat_value in raw_stats.items()
                    if stat_name in OFFENSIVE_STATS
                }

                game = {
                    "season": season,
                    "season_type": season_type_name,
                    "espn_week": event_info.get("week"),
                    "game_date": event_info.get("gameDate"),
                    "opponent": event_info.get("opponent", {}).get("abbreviation"),
                    "home_away": event_info.get("atVs"),
                    "result": event_info.get("gameResult"),
                    "score": event_info.get("score"),
                    "event_id": event_id,
                    "stats": fantasy_stats,
                }

                games.append(game)

    return games