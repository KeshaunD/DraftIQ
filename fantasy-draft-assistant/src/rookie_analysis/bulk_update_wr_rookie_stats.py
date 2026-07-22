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


def parse_stat_line(line):
    parts = line.strip().split()

    if len(parts) != 5:
        raise ValueError("Expected: games targets receptions yards touchdowns")

    games, targets, receptions, yards, touchdowns = parts

    return {
        "games": int(games),
        "targets": int(targets),
        "receptions": int(receptions),
        "receiving_yards": int(yards),
        "receiving_touchdowns": int(touchdowns),
    }


def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("python src\\rookie_analysis\\bulk_update_wr_rookie_stats.py <round>")
        return

    draft_round = sys.argv[1]
    round_file = DATA_DIR / "historical" / "wr" / f"round_{draft_round}.json"

    players = load_json(round_file)

    print()
    print(f"Updating WR Round {draft_round}")
    print("Paste stats as:")
    print("games targets receptions receiving_yards receiving_touchdowns")
    print("Example: 16 108 67 908 6")
    print("Press Enter with no input to skip a player.")
    print()

    for player in players:
        if player.get("rookie_stats"):
            continue

        print(f"{player['name']} ({player['draft_year']}, {player['team']})")
        line = input("> ").strip()

        if line == "":
            print("Skipped.")
            print()
            continue

        try:
            player["rookie_stats"] = parse_stat_line(line)
            print("Updated.")
            print()
        except ValueError as error:
            print(f"Invalid input: {error}")
            print("Skipped.")
            print()

    save_json(round_file, players)

    print(f"Saved -> {round_file}")


if __name__ == "__main__":
    main()