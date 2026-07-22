import json
import sys
from pathlib import Path

from league_settings import get_scoring_rules
from rookie_projection_engine import project_rookie_stats
from team_environment import calculate_team_modifiers

DATA_DIR = Path("data")


def load_json(path):
    with open(path, "r") as file:
        return json.load(file)


def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)

    with open(path, "w") as file:
        json.dump(data, file, indent=2)


def calculate_projected_points(projected_stats, scoring_rules):
    points = 0

    # Passing
    points += projected_stats.get("passing_yards", 0) * scoring_rules["passing_yards"]
    points += projected_stats.get("passing_touchdowns", 0) * scoring_rules["passing_touchdowns"]
    points += projected_stats.get("interceptions", 0) * scoring_rules["interceptions"]

    # Rushing
    points += projected_stats.get("rushing_yards", 0) * scoring_rules["rushing_yards"]
    points += projected_stats.get("rushing_touchdowns", 0) * scoring_rules["rushing_touchdowns"]

    # Receiving
    points += projected_stats.get("receptions", 0) * scoring_rules["receptions"]
    points += projected_stats.get("receiving_yards", 0) * scoring_rules["receiving_yards"]
    points += projected_stats.get("receiving_touchdowns", 0) * scoring_rules["receiving_touchdowns"]

    # Turnovers
    points += projected_stats.get("fumbles_lost", 0) * scoring_rules["fumbles_lost"]

    return round(points, 2)


def main():
    league_name = sys.argv[1] if len(sys.argv) > 1 else "plantation"

    scoring_rules = get_scoring_rules(league_name)

    stat_projections = load_json(
        DATA_DIR / "projections" / "stat_projections.json"
    )

    # Load team offensive environment
    team_stats_path = DATA_DIR / "team_stats" / "team_offense_2025.json"

    if team_stats_path.exists():
        team_stats = load_json(team_stats_path)
        team_modifiers = calculate_team_modifiers(team_stats)
    else:
        team_modifiers = {}

    fantasy_projections = []

    for player in stat_projections:

        # Build rookie projections automatically
        if player.get("projection_model") == "rookie_college_translation":
            player["projected_stats"] = project_rookie_stats(player)

        projected_stats = player["projected_stats"]

        # Apply team environment modifiers
        modifiers = team_modifiers.get(
            player["team"],
            {
                "passing_modifier": 1.0,
                "receiving_modifier": 1.0,
                "rushing_modifier": 1.0,
            },
        )

        projected_stats["passing_yards"] *= modifiers["passing_modifier"]
        projected_stats["passing_touchdowns"] *= modifiers["passing_modifier"]

        projected_stats["rushing_yards"] *= modifiers["rushing_modifier"]
        projected_stats["rushing_touchdowns"] *= modifiers["rushing_modifier"]

        projected_stats["receiving_yards"] *= modifiers["receiving_modifier"]
        projected_stats["receiving_touchdowns"] *= modifiers["receiving_modifier"]

        # Round all projected stats
        projected_stats = {
            stat: round(value, 2)
            for stat, value in projected_stats.items()
        }

        player["projected_stats"] = projected_stats

        projected_points = calculate_projected_points(
            projected_stats,
            scoring_rules
        )

        fantasy_projections.append({
            "id": player["id"],
            "name": player["name"],
            "team": player["team"],
            "position": player["position"],
            "projection_model": player.get(
                "projection_model",
                "veteran_nfl_history"
            ),
            "projected_games": player.get("projected_games", 17),
            "projected_stats": projected_stats,
            "projected_fantasy_points": projected_points,
            "sources": player.get("sources", [])
        })

    output_file = (
        DATA_DIR
        / "leagues"
        / league_name
        / "fantasy_projections.json"
    )

    save_json(output_file, fantasy_projections)

    print(f"Saved {len(fantasy_projections)} fantasy projections.")
    print(f"Output -> {output_file}")


if __name__ == "__main__":
    main()