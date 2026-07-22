import json
import sys
from pathlib import Path


DATA_DIR = Path("data")
POSITIONS = ["QB", "RB", "WR", "TE", "PK"]


def main():
    league_name = sys.argv[1] if len(sys.argv) > 1 else "plantation"

    league_dir = DATA_DIR / "leagues" / league_name
    rankings_path = league_dir / "rankings.json"

    with open(rankings_path, "r") as file:
        rankings = json.load(file)

    rankings_by_position = {}

    for position in POSITIONS:
        position_players = [
            player for player in rankings
            if player["position"] == position
        ]

        for index, player in enumerate(position_players, start=1):
            player["position_rank"] = index

        rankings_by_position[position] = position_players

    output_file = league_dir / "rankings_by_position.json"

    with open(output_file, "w") as file:
        json.dump(rankings_by_position, file, indent=2)

    print(f"Saved position rankings.")
    print(f"Output -> {output_file}")


if __name__ == "__main__":
    main()