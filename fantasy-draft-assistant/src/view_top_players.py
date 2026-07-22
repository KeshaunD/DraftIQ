import json
import sys
from pathlib import Path


DATA_DIR = Path("data")


def main():
    league_name = sys.argv[1] if len(sys.argv) > 1 else "plantation"
    position = sys.argv[2].upper() if len(sys.argv) > 2 else None
    limit = int(sys.argv[3]) if len(sys.argv) > 3 else 25

    league_dir = DATA_DIR / "leagues" / league_name

    if position:
        file_path = league_dir / "rankings_by_position.json"

        with open(file_path, "r") as file:
            rankings_by_position = json.load(file)

        players = rankings_by_position.get(position, [])
        print(f"\nTop {limit} {position}s\n")

    else:
        file_path = league_dir / "rankings.json"

        with open(file_path, "r") as file:
            players = json.load(file)

        print(f"\nTop {limit} Overall\n")

    for player in players[:limit]:
        rank = player.get("rank")
        position_rank = player.get("position_rank")

        rank_display = f"#{rank}" if rank else f"{player['position']}{position_rank}"

        print(
            f"{rank_display:>6}  "
            f"{player['name']:<25} "
            f"{player['position']:<3} "
            f"{player['team']:<3} "
            f"{player['ppg']} PPG"
        )


if __name__ == "__main__":
    main()