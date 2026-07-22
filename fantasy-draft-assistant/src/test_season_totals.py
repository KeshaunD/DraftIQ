import json
from pathlib import Path

from league_settings import get_scoring_rules
from stats_engine import (
    get_season_totals,
    average_fantasy_points,
    ceiling,
    floor,
)

DATA_DIR = Path("data")


def main():
    scoring_rules = get_scoring_rules("plantation_yahoo.json")

    with open(DATA_DIR / "player_game_logs.json", "r") as file:
        players = json.load(file)

    amon = players["4374302"]

    totals = get_season_totals(amon, scoring_rules)

    print(amon["name"])
    print()

    print("Season Totals")
    print(json.dumps(totals, indent=4))

    print()
    print(f"Average PPG: {average_fantasy_points(amon, scoring_rules)}")

    print("\nBest Game")
    print(json.dumps(ceiling(amon, scoring_rules), indent=4))

    print("\nWorst Game")
    print(json.dumps(floor(amon, scoring_rules), indent=4))


if __name__ == "__main__":
    main()