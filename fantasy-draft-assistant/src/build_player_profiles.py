import json
import sys
from pathlib import Path

from league_settings import get_scoring_rules

from stats_engine import (
    get_season_totals,
    average_fantasy_points,
    ceiling,
    floor,
)


DATA_DIR = Path("data")


def load_json(path, default=None):
    if not path.exists():
        return default if default is not None else {}

    with open(path, "r") as file:
        return json.load(file)


def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)

    with open(path, "w") as file:
        json.dump(data, file, indent=2)


def build_headshot_url(espn_id):
    if not espn_id:
        return None

    return f"https://a.espncdn.com/i/headshots/nfl/players/full/{espn_id}.png"


def main():
    league_name = sys.argv[1] if len(sys.argv) > 1 else "plantation"

    print(f"Building profiles for league: {league_name}")

    scoring_rules = get_scoring_rules(league_name)

    game_logs = load_json(DATA_DIR / "player_game_logs.json", default={})
    players = load_json(DATA_DIR / "players.json", default=[])

    players_by_id = {
        str(player.get("espn_id") or player.get("id")): player
        for player in players
        if player.get("espn_id") or player.get("id")
    }

    player_profiles = {}

    for espn_id, player_log in game_logs.items():
        espn_id = str(espn_id)
        base_player = players_by_id.get(espn_id, {})

        name = player_log.get("name") or base_player.get("name")
        print(f"Building profile for {name}...")

        profile = {
            "id": espn_id,
            "espn_id": espn_id,
            "name": name,
            "team": player_log.get("team") or base_player.get("team"),
            "position": player_log.get("position") or base_player.get("position"),
            "image": build_headshot_url(espn_id),

            "season_totals": get_season_totals(player_log, scoring_rules),
            "ppg": average_fantasy_points(player_log, scoring_rules),
            "best_game": ceiling(player_log, scoring_rules),
            "worst_game": floor(player_log, scoring_rules),

            "gameLog": player_log.get("games", []),
            "sources": {
                "player_info": "players.json",
                "game_logs": "player_game_logs.json",
            },
        }

        player_profiles[espn_id] = profile

    league_output = DATA_DIR / "leagues" / league_name / "player_profiles.json"
    save_json(league_output, player_profiles)

    root_output = DATA_DIR / "player_database.json"
    save_json(root_output, player_profiles)

    print()
    print(f"Saved {len(player_profiles)} player profiles.")
    print(f"League output -> {league_output}")
    print(f"Database output -> {root_output}")


if __name__ == "__main__":
    main()