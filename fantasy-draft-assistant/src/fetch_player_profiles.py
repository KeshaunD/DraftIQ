import json
import sys
import time
from pathlib import Path

from espn_api import get_json


DATA_DIR = Path("data")

PLAYERS_FILE = DATA_DIR / "players.json"
OUTPUT_FILE = DATA_DIR / "player_profiles.json"


def load_json(path):
    with open(path, "r") as file:
        return json.load(file)


def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)

    with open(path, "w") as file:
        json.dump(data, file, indent=2)


def safe_float(value):
    if value in (None, "", "-"):
        return 0.0

    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def calculate_ppr_points(stats):
    passing_yards = safe_float(stats.get("passingYards"))
    passing_tds = safe_float(stats.get("passingTouchdowns"))
    interceptions = safe_float(stats.get("interceptions"))

    rushing_yards = safe_float(stats.get("rushingYards"))
    rushing_tds = safe_float(stats.get("rushingTouchdowns"))

    receptions = safe_float(stats.get("receptions"))
    receiving_yards = safe_float(stats.get("receivingYards"))
    receiving_tds = safe_float(stats.get("receivingTouchdowns"))

    fumbles_lost = safe_float(stats.get("fumblesLost"))

    points = 0
    points += passing_yards * 0.04
    points += passing_tds * 4
    points += interceptions * -2

    points += rushing_yards * 0.1
    points += rushing_tds * 6

    points += receptions * 1
    points += receiving_yards * 0.1
    points += receiving_tds * 6

    points += fumbles_lost * -2

    return round(points, 2)


def fetch_gamelog(espn_id, season):
    url = (
        "https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/"
        f"athletes/{espn_id}/gamelog?season={season}"
    )

    return get_json(url)


def parse_game_log(data):
    names = data.get("names", [])
    season_types = data.get("seasonTypes", [])

    games = []

    for season_type in season_types:
        for category in season_type.get("categories", []):
            if category.get("displayName") != "Regular Season Stats":
                continue

            for event in category.get("events", []):
                raw_stats = dict(zip(names, event.get("stats", [])))

                fantasy_points = calculate_ppr_points(raw_stats)

                games.append({
                    "week": event.get("week"),
                    "opponent": event.get("opponent", {}).get("abbreviation", "-"),
                    "fantasyPoints": fantasy_points,
                    "passingYards": safe_float(raw_stats.get("passingYards")),
                    "passingTouchdowns": safe_float(raw_stats.get("passingTouchdowns")),
                    "interceptions": safe_float(raw_stats.get("interceptions")),
                    "rushingYards": safe_float(raw_stats.get("rushingYards")),
                    "rushingTouchdowns": safe_float(raw_stats.get("rushingTouchdowns")),
                    "receptions": safe_float(raw_stats.get("receptions")),
                    "receivingYards": safe_float(raw_stats.get("receivingYards")),
                    "receivingTouchdowns": safe_float(raw_stats.get("receivingTouchdowns")),
                    "fumblesLost": safe_float(raw_stats.get("fumblesLost")),
                })

    return games


def summarize_games(games):
    if not games:
        return {
            "games": 0,
            "ppg": 0,
            "floor": 0,
            "ceiling": 0,
            "boomRate": 0,
            "bustRate": 0,
            "consistency": 0,
            "rushYardsPerGame": 0,
            "receivingYardsPerGame": 0,
            "targetsPerGame": 0,
            "touchdownsPerGame": 0,
        }

    total_points = sum(game["fantasyPoints"] for game in games)
    games_played = len(games)

    boom_games = sum(game["fantasyPoints"] >= 25 for game in games)
    bust_games = sum(game["fantasyPoints"] < 10 for game in games)

    total_touchdowns = sum(
        game["rushingTouchdowns"] + game["receivingTouchdowns"] + game["passingTouchdowns"]
        for game in games
    )

    return {
        "games": games_played,
        "ppg": round(total_points / games_played, 2),
        "floor": round(min(game["fantasyPoints"] for game in games), 2),
        "ceiling": round(max(game["fantasyPoints"] for game in games), 2),
        "boomRate": round(boom_games / games_played, 3),
        "bustRate": round(bust_games / games_played, 3),
        "consistency": round(1 - (bust_games / games_played), 3),
        "rushYardsPerGame": round(sum(game["rushingYards"] for game in games) / games_played, 2),
        "receivingYardsPerGame": round(sum(game["receivingYards"] for game in games) / games_played, 2),
        "targetsPerGame": round(sum(game.get("targets", 0) for game in games) / games_played, 2),
        "touchdownsPerGame": round(total_touchdowns / games_played, 2),
    }


def main():
    season = int(sys.argv[1]) if len(sys.argv) > 1 else 2025
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 250

    players = load_json(PLAYERS_FILE)

    profiles = {}

    for player in players[:limit]:
        espn_id = player.get("espn_id") or player.get("id")

        if not espn_id:
            continue

        print(f"Fetching {player.get('name')}...")

        try:
            data = fetch_gamelog(espn_id, season)
            games = parse_game_log(data)
            season_summary = summarize_games(games)

            profiles[str(espn_id)] = {
                "id": str(espn_id),
                "name": player.get("name"),
                "team": player.get("team"),
                "position": player.get("position"),
                "season": season_summary,
                "gameLog": games,
            }

            time.sleep(0.25)

        except Exception as error:
            print(f"Failed {player.get('name')}: {error}")

    save_json(OUTPUT_FILE, profiles)

    print()
    print(f"Saved {len(profiles)} player profiles.")
    print(f"Output -> {OUTPUT_FILE}")


if __name__ == "__main__":
    main()