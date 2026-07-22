import json
import sys
from pathlib import Path


DATA_DIR = Path("data")


def load_json(path):
    with open(path, "r", encoding="utf-8") as file:
        return json.load(file)


def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)

    with open(path, "w", encoding="utf-8") as file:
        json.dump(data, file, indent=2)


def get_value(player, keys, default=None):
    for key in keys:
        if key in player and player[key] not in (None, "", "-"):
            return player[key]

    return default


def to_number(value, default=None):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def estimate_points(position, position_rank, overall_rank):
    """
    Baseline placeholder projection model.
    This is not meant to be perfect yet.
    It gives DraftIQ realistic-ish projected points until we build real stat projections.
    """

    position = str(position or "").upper()

    if position == "QB":
        return max(150, 385 - ((position_rank - 1) * 7.0))

    if position == "RB":
        return max(65, 340 - ((position_rank - 1) * 5.2))

    if position == "WR":
        return max(60, 330 - ((position_rank - 1) * 4.1))

    if position == "TE":
        return max(45, 285 - ((position_rank - 1) * 7.0))

    return max(30, 180 - ((overall_rank - 1) * 0.8))


def main():
    season = int(sys.argv[1]) if len(sys.argv) > 1 else 2026
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 250

    consensus_path = DATA_DIR / "rankings" / "consensus_rankings.json"
    output_path = DATA_DIR / "projections" / f"fantasy_projections_{season}.json"

    consensus_players = load_json(consensus_path)

    projections = {}
    position_counts = {}

    for index, player in enumerate(consensus_players[:limit], start=1):
        name = get_value(player, ["name", "player", "Player"])
        team = get_value(player, ["team", "tm", "Team", "Tm"], "")
        position = get_value(player, ["pos", "position", "fantasyPosition", "FantPos"], "")

        if not name:
            continue

        position = str(position or "").upper()
        position_counts[position] = position_counts.get(position, 0) + 1
        position_rank = position_counts[position]

        overall_rank = int(to_number(
            get_value(player, ["rank", "overallRank", "consensus_rank", "OvRank"]),
            index
        ))

        existing_projection = to_number(
            get_value(
                player,
                [
                    "projection",
                    "proj",
                    "projected_fantasy_points",
                    "fantasy_points",
                    "fantasyPoints",
                    "ppr",
                    "PPR",
                    "consensusProjection"
                ],
                None
            ),
            None
        )

        if existing_projection is not None:
            projected_points = round(existing_projection, 2)
            projection_source = "consensus_existing_projection"
        else:
            projected_points = round(
                estimate_points(position, position_rank, overall_rank),
                2
            )
            projection_source = "baseline_rank_model"

        projected_games = 17
        projected_ppg = round(projected_points / projected_games, 2)

        projections[name] = {
            "name": name,
            "team": team,
            "position": position,
            "rank": overall_rank,
            "positionRank": position_rank,
            "projection": projected_points,
            "projectedPpg": projected_ppg,
            "projectedGames": projected_games,
            "projectionSource": projection_source,

            # Compatibility keys for exporter/future scripts
            "projected_fantasy_points": projected_points,
            "projected_ppg": projected_ppg,
            "source": projection_source,
        }

    save_json(output_path, projections)

    print(f"Saved {len(projections)} DraftIQ baseline projections.")
    print(f"Output -> {output_path}")


if __name__ == "__main__":
    main()