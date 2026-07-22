import json
import time
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

import requests

from espn_api import get_json


DATA_DIR = Path("data")
WR_FOLDER = DATA_DIR / "historical" / "wr"
PLAYERS_FILE = DATA_DIR / "players.json"


def load_json(path):
    with open(path, "r") as file:
        return json.load(file)


def save_json(path, data):
    with open(path, "w") as file:
        json.dump(data, file, indent=2)


def normalize_name(name):
    name = name.lower()

    replacements = {
        ".": "",
        "'": "",
        "’": "",
        "-": " ",
    }

    for old, new in replacements.items():
        name = name.replace(old, new)

    suffixes = [" jr", " sr", " ii", " iii", " iv"]
    for suffix in suffixes:
        name = name.replace(suffix, "")

    initials = {
        "kj": "k j",
        "dj": "d j",
        "aj": "a j",
        "jj": "j j",
        "dk": "d k",
    }

    parts = name.split()
    parts = [initials.get(part, part) for part in parts]

    return " ".join(parts).strip()


def build_player_lookup():
    players = load_json(PLAYERS_FILE)
    lookup = {}

    for player in players:
        lookup[normalize_name(player["name"])] = player

    return lookup


def find_espn_id(player, lookup):
    normalized = normalize_name(player["name"])

    if normalized in lookup:
        return lookup[normalized].get("espn_id")

    for name, espn_player in lookup.items():
        if normalized in name or name in normalized:
            return espn_player.get("espn_id")

    return None


def fetch_rookie_gamelog(espn_id, rookie_year):
    url = (
        "https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/"
        f"athletes/{espn_id}/gamelog?season={rookie_year}"
    )

    return get_json(url)


def safe_int(value):
    if value in (None, "-", ""):
        return 0

    try:
        return int(float(value))
    except ValueError:
        return 0


def parse_receiving_stats(data):
    names = data.get("names", [])
    season_types = data.get("seasonTypes", [])

    totals = {
        "games": 0,
        "targets": 0,
        "receptions": 0,
        "receiving_yards": 0,
        "receiving_touchdowns": 0,
    }

    for season_type in season_types:
        for category in season_type.get("categories", []):
            if category.get("displayName") != "Regular Season Stats":
                continue

            for event in category.get("events", []):
                raw_stats = dict(zip(names, event.get("stats", [])))

                totals["games"] += 1
                totals["targets"] += safe_int(raw_stats.get("receivingTargets"))
                totals["receptions"] += safe_int(raw_stats.get("receptions"))
                totals["receiving_yards"] += safe_int(raw_stats.get("receivingYards"))
                totals["receiving_touchdowns"] += safe_int(raw_stats.get("receivingTouchdowns"))

    return totals


def main():
    player_lookup = build_player_lookup()

    for round_number in range(1, 8):
        round_file = WR_FOLDER / f"round_{round_number}.json"

        if not round_file.exists():
            print(f"Missing {round_file}")
            continue

        players = load_json(round_file)

        print()
        print(f"Processing Round {round_number}")

        for player in players:
            if player.get("rookie_stats"):
                print(f"Skipping {player['name']} - already has stats")
                continue

            if player["draft_year"] >= 2026:
                print(f"Skipping {player['name']} - rookie season not complete")
                continue

            print(f"Fetching {player['name']}...")

            try:
                espn_id = find_espn_id(player, player_lookup)

                if espn_id is None:
                    print(f"Could not find ESPN ID for {player['name']}")
                    continue

                data = fetch_rookie_gamelog(espn_id, player["draft_year"])
                rookie_stats = parse_receiving_stats(data)

                if rookie_stats["games"] == 0:
                    print(f"No rookie receiving stats found for {player['name']}")
                    continue

                player["espn_id"] = espn_id
                player["rookie_stats"] = rookie_stats

                print(f"Updated {player['name']}: {rookie_stats}")

                time.sleep(0.25)

            except requests.exceptions.HTTPError:
                print(f"ESPN request failed for {player['name']}")
            except Exception as error:
                print(f"Error for {player['name']}: {error}")

        save_json(round_file, players)
        print(f"Saved {round_file}")


if __name__ == "__main__":
    main()