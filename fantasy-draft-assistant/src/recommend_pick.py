import json
import sys
from pathlib import Path

from recommendation_engine import build_recommendation
from ai_advisor import build_ai_prompt


DATA_DIR = Path("data")


def load_json(path):
    with open(path, "r") as file:
        return json.load(file)


def main():
    if len(sys.argv) < 3:
        print("Usage:")
        print("python src\\recommend_pick.py <league> <draft> [--json] [--prompt]")
        return

    league_name = sys.argv[1]
    draft_name = sys.argv[2]
    json_mode = "--json" in sys.argv
    prompt_mode = "--prompt" in sys.argv

    league_dir = DATA_DIR / "leagues" / league_name

    rankings = load_json(league_dir / "rankings.json")
    draft_state = load_json(
        league_dir / "drafts" / draft_name / "draft_state.json"
    )

    recommendation = build_recommendation(draft_state, rankings)

    if recommendation is None:
        print("No available players left.")
        return

    if json_mode:
        print(json.dumps(recommendation, indent=2))
        return

    if prompt_mode:
        print(build_ai_prompt(recommendation))
        return

    team_counts = recommendation["team_counts"]
    best_overall = recommendation["best_overall"]
    best_team_fit = recommendation["best_team_fit"]

    print()
    print("=" * 70)
    print("DRAFT RECOMMENDATION")
    print("=" * 70)

    print("\nYour Team")
    print(
        f"QB: {team_counts.get('QB', 0)}  "
        f"RB: {team_counts.get('RB', 0)}  "
        f"WR: {team_counts.get('WR', 0)}  "
        f"TE: {team_counts.get('TE', 0)}"
    )

    print("\nBest Overall Available")
    print(
        f"{best_overall['overall_rank']}. "
        f"{best_overall['name']} - {best_overall['position']} - {best_overall['team']} "
        f"({best_overall['projection']} proj)"
    )

    print("\nBest Team Fit")
    print(
        f"{best_team_fit['overall_rank']}. "
        f"{best_team_fit['name']} - {best_team_fit['position']} - {best_team_fit['team']} "
        f"({best_team_fit['projection']} proj)"
    )

    print("\nReason Flags")
    for reason in recommendation["reason_flags"]:
        print(f"- {reason}")


if __name__ == "__main__":
    main()