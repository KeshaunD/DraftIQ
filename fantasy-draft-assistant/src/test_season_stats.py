import json
from pathlib import Path

import requests

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


def try_stats_url(url):
    try:
        return get_json(url)
    except requests.exceptions.HTTPError as error:
        print(f"Failed: {url}")
        return None


def main():
    player = find_player_by_name("Mike Evans")

    if player is None:
        print("Player not found.")
        return

    espn_id = player["espn_id"]

    for season in [2023, 2024, 2025]:
        print(f"\nTrying {player['name']} stats for {season}")

        urls = [
            f"https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes/{espn_id}/statistics?season={season}",
            f"https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes/{espn_id}/statistics/{season}",
            f"https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/{season}/types/2/athletes/{espn_id}/statistics",
            f"https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes/16737/statistics?seasontype=2&season=2023",
        ]

        for url in urls:
            stats_data = try_stats_url(url)

            if stats_data:
                print("WORKED:")
                print(url)

                summary = build_career_summary(player, stats_data)
                print(json.dumps(summary, indent=2))
                break


if __name__ == "__main__":
    main()