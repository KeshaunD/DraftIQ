import json
import time
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parent))

from espn_api import get_json


DATA_DIR = Path("data")
PLAYERS_FILE = DATA_DIR / "players.json"


def load_json(path):
    with open(path, "r") as file:
        return json.load(file)


def save_json(path, data):
    with open(path, "w") as file:
        json.dump(data, file, indent=2)


def search_espn_player(player_name):
    url = (
        "https://site.api.espn.com/apis/search/v2"
        f"?query={player_name}&limit=10"
    )

    data = get_json(url)

    for result in data.get("results", []):
        for item in result.get("contents", []):
            athlete = item.get("athlete", {})

            if athlete.get("id"):
                return athlete.get("id")

    return None


def main():
    players = load_json(PLAYERS_FILE)

    updated = 0
    missing = 0

    for player in players:
        if player.get("espn_id"):
            continue

        if player.get("position") not in ["WR", "RB", "QB", "TE"]:
            continue

        print(f"Searching: {player['name']}")

        espn_id = search_espn_player(player["name"])

        if espn_id:
            player["espn_id"] = espn_id
            updated += 1
            print(f"Updated {player['name']} -> {espn_id}")
        else:
            missing += 1
            print(f"Still missing: {player['name']}")

        time.sleep(0.25)

    save_json(PLAYERS_FILE, players)

    print()
    print("Done.")
    print(f"Updated ESPN IDs: {updated}")
    print(f"Still missing: {missing}")


if __name__ == "__main__":
    main()