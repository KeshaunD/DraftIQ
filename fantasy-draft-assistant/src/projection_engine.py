import json
from pathlib import Path
from statistics import mean, stdev

from projection_adjustments import apply_projection_adjustments

BASE_DIR = Path(__file__).resolve().parent.parent

GAME_LOGS_FILE = BASE_DIR / "data" / "player_game_logs.json"
PROJECTIONS_FILE = BASE_DIR / "data" / "player_projections.json"


def load_json(file_path):
    with open(file_path, "r", encoding="utf-8") as file:
        return json.load(file)


def save_json(file_path, data):
    with open(file_path, "w", encoding="utf-8") as file:
        json.dump(data, file, indent=4)


def calculate_ppr_points(stats):
    return (
        stats.get("passingYards", 0) * 0.04
        + stats.get("passingTouchdowns", 0) * 4
        - stats.get("interceptions", 0) * 2
        + stats.get("rushingYards", 0) * 0.1
        + stats.get("rushingTouchdowns", 0) * 6
        + stats.get("receptions", 0)
        + stats.get("receivingYards", 0) * 0.1
        + stats.get("receivingTouchdowns", 0) * 6
        - stats.get("fumblesLost", 0) * 2
    )


def main():
    game_logs = load_json(GAME_LOGS_FILE)
    projections = []

    for player_id, player_data in game_logs.items():
        games = player_data.get("games", [])

        if not games:
            continue

        weekly_points = []

        for game in games:
            stats = game.get("stats", {})
            points = calculate_ppr_points(stats)
            weekly_points.append(points)

        average = mean(weekly_points)
        consistency = stdev(weekly_points) if len(weekly_points) > 1 else 0

        projection = average * 17
        floor = max(0, projection - (consistency * 17))
        ceiling = projection + (consistency * 17)

        player_projection = {
            "id": player_id,
            "name": player_data.get("name"),
            "team": player_data.get("team"),
            "position": player_data.get("position"),
            "games_played": len(weekly_points),
            "average_ppr": round(average, 2),
            "projection": round(projection, 2),
            "floor": round(floor, 2),
            "ceiling": round(ceiling, 2),
            "highest_game": round(max(weekly_points), 2),
            "lowest_game": round(min(weekly_points), 2),
            "consistency": round(consistency, 2),
        }

        player_projection = apply_projection_adjustments(player_projection)
        projections.append(player_projection)

    projections.sort(
        key=lambda player: player["adjusted_projection"],
        reverse=True
    )

    save_json(PROJECTIONS_FILE, projections)

    print(f"Created {len(projections)} player projections.")
    print(f"Saved to {PROJECTIONS_FILE}")


if __name__ == "__main__":
    main()