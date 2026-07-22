import json
import sys
from pathlib import Path


DATA_DIR = Path("data")


def load_json(path):
    with open(path, "r") as file:
        return json.load(file)


def save_json(path, data):
    with open(path, "w") as file:
        json.dump(data, file, indent=2)


def get_number(prompt):
    value = input(prompt).strip()

    if value == "":
        return 0

    return int(value)


def main():
    if len(sys.argv) < 3:
        print("Usage:")
        print('python src\\rookie_analysis\\update_wr_rookie_stats.py <round> "<player name>"')
        return

    draft_round = sys.argv[1]
    player_name = sys.argv[2]

    round_file = DATA_DIR / "historical" / "wr" / f"round_{draft_round}.json"

    players = load_json(round_file)

    for player in players:
        if player["name"].lower() == player_name.lower():
            print(f"Updating {player['name']}")

            player["rookie_stats"] = {
                "games": get_number("Games: "),
                "targets": get_number("Targets: "),
                "receptions": get_number("Receptions: "),
                "receiving_yards": get_number("Receiving yards: "),
                "receiving_touchdowns": get_number("Receiving TDs: ")
            }

            save_json(round_file, players)

            print(f"Updated {player['name']}")
            print(f"Saved -> {round_file}")
            return

    print(f"Player not found: {player_name}")


if __name__ == "__main__":
    main()