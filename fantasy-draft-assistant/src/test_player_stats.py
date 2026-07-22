import json
from pathlib import Path

from espn_api import get_json
from player_stats import build_career_summary


DATA_DIR = Path("data")


def find_player_by_name(player_name):
    with open(DATA_DIR / "players.json", "r") as file:
        players = json.load(file)

    for player in players:
        if player["name"].lower() == player_name.lower():
            return player

    return None


def main():
    player = find_player_by_name("Mike Evans")

    if player is None:
        print("Player not found.")
        return

    espn_id = player["espn_id"]

    stats_url = (
        f"https://sports.core.api.espn.com/v2/sports/football/"
        f"leagues/nfl/athletes/{espn_id}/statistics"
    )

    stats_data = get_json(stats_url)

    summary = build_career_summary(player, stats_data)

    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()