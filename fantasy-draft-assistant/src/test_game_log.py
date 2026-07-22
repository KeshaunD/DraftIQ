import json
from pathlib import Path

import requests

from espn_api import get_json
from game_logs import parse_game_logs


DATA_DIR = Path("data")


def find_player_by_name(player_name):
    with open(DATA_DIR / "players.json", "r") as file:
        players = json.load(file)

    for player in players:
        if player["name"].lower() == player_name.lower():
            return player

    return None


def try_url(url):
    try:
        data = get_json(url)

        print("WORKED:")
        print(url)

        games = parse_game_logs(data)

        print(f"Parsed {len(games)} games")

        for game in games:
            print(json.dumps(game, indent=2))

        return data

    except requests.exceptions.HTTPError:
        print(f"Failed: {url}")
        return None


def main():
    player = find_player_by_name("Amon-Ra St. Brown")

    if player is None:
        print("Player not found.")
        return

    espn_id = player["espn_id"]

    print(player)

    urls = [
        f"https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/{espn_id}/gamelog",
        f"https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/{espn_id}/gamelog?season=2025",
        f"https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes/{espn_id}/gamelog",
        f"https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes/{espn_id}/eventlog",
    ]

    for url in urls:
        data = try_url(url)

        if data:
            break


if __name__ == "__main__":
    main()