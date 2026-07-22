import json
from pathlib import Path

from stats_engine import calculate_ppr_points


DATA_DIR = Path("data")


def main():

    # Load the game log database.
    with open(DATA_DIR / "player_game_logs.json", "r") as file:
        players = json.load(file)

    # Grab Amon-Ra by ESPN ID.
    amon = players["4374302"]

    print(f"\n{amon['name']}\n")

    total_points = 0

    for i, game in enumerate(amon["games"], start=1):

        points = calculate_ppr_points(game)

        total_points += points

        print(
            f"Week {i:>2}: "
            f"{points:>5} pts   "
            f"{game['stats']}"
        )

    print()
    print(f"Season Total: {round(total_points,2)}")
    print(f"PPG: {round(total_points / len(amon['games']),2)}")


if __name__ == "__main__":
    main()