import json
import sys
from pathlib import Path


DATA_DIR = Path("data")


def load_json(path):
    with open(path, "r") as file:
        return json.load(file)


def main():
    if len(sys.argv) < 3:
        print("Usage:")
        print("python src\\view_available_players.py <league> <draft> [limit]")
        return

    league_name = sys.argv[1]
    draft_name = sys.argv[2]
    limit = int(sys.argv[3]) if len(sys.argv) > 3 else 25

    league_dir = DATA_DIR / "leagues" / league_name

    rankings = load_json(league_dir / "rankings.json")

    draft_state = load_json(
        league_dir / "drafts" / draft_name / "draft_state.json"
    )

    drafted_ids = {
        player["id"]
        for player in draft_state["drafted_players"]
    }

    available_players = [
        player
        for player in rankings
        if player["id"] not in drafted_ids
    ]

    print()
    print("=" * 90)
    print(f"Top {limit} Available Players")
    print("=" * 90)
    print(f"{'Rank':<5} {'Player':<26} {'Pos':<4} {'Team':<4} {'Proj':>8} {'Avg PPG':>9}")

    for player in available_players[:limit]:
        print(
            f"{player['overall_rank']:<5}"
            f"{player['name']:<26}"
            f"{player['position']:<4}"
            f"{player['team']:<4}"
            f"{player['projection']:>8.1f}"
            f"{player['average_ppr']:>9.2f}"
        )


if __name__ == "__main__":
    main()