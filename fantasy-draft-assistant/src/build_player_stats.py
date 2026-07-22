import json
from pathlib import Path

import requests

from espn_api import get_json
from player_stats import build_career_summary


DATA_DIR = Path("data")


def main():

    # Load our player database.
    with open(DATA_DIR / "players.json", "r") as file:
        players = json.load(file)

    # Dictionary that will hold every player's career stats.
    player_stats = {}

    # Loop through every fantasy player.
    for player in players:

        print(f"Fetching {player['name']}...")

        stats_url = (
            f"https://sports.core.api.espn.com/v2/sports/football/"
            f"leagues/nfl/athletes/{player['espn_id']}/statistics"
        )

        try:
            stats_data = get_json(stats_url)

        except requests.exceptions.HTTPError:
            print(f"Skipping {player['name']} (no stats found)")
            continue

        summary = build_career_summary(player, stats_data)

        # Store using the ESPN ID as the key.
        player_stats[player["espn_id"]] = summary

    # Save the completed database.
    with open(DATA_DIR / "player_career_stats.json", "w") as file:
        json.dump(player_stats, file, indent=2)

    print(f"\nSaved {len(player_stats)} player career stats.")
    print("Output: data/player_career_stats.json")


if __name__ == "__main__":
    main()