import json
from pathlib import Path

import requests

from espn_api import fetch_game_logs
from game_logs import parse_game_logs


DATA_DIR = Path("data")


def main():

    with open(DATA_DIR / "players.json", "r") as file:
        players = json.load(file)

    all_game_logs = {}

    for player in players:

        print(f"Fetching {player['name']}...")

        try:
            data = fetch_game_logs(player["espn_id"])

        except requests.exceptions.HTTPError:
            print(f"Skipping {player['name']}")
            continue

        games = parse_game_logs(data)

        all_game_logs[player["espn_id"]] = {
            "name": player["name"],
            "team": player["team"],
            "position": player["position"],
            "games": games,
        }

    with open(DATA_DIR / "player_game_logs.json", "w") as file:
        json.dump(all_game_logs, file, indent=2)

    print()
    print(f"Saved {len(all_game_logs)} player game logs.")
    print("Output -> data/player_game_logs.json")


if __name__ == "__main__":
    main()