import json
import sys
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent

CONSENSUS_FILE = (
    BASE_DIR
    / "data"
    / "rankings"
    / "consensus_rankings.json"
)


def load_json(file_path):
    with open(file_path, "r", encoding="utf-8") as file:
        return json.load(file)


def save_json(file_path, data):
    file_path.parent.mkdir(parents=True, exist_ok=True)

    with open(file_path, "w", encoding="utf-8") as file:
        json.dump(data, file, indent=4)


def build_consensus_lookup(consensus_rankings):
    return {
        player["name"].strip().lower(): player
        for player in consensus_rankings
        if player.get("name")
    }


def normalize_projections(projections):
    if isinstance(projections, dict):
        return list(projections.values())

    if isinstance(projections, list):
        return projections

    raise ValueError(
        "Projection data must be a list or dictionary."
    )


def get_projection_score(player):
    return player.get(
        "adjusted_projection",
        player.get(
            "projection",
            player.get("projected_fantasy_points", 0),
        ),
    )


def main():
    league_name = (
        sys.argv[1]
        if len(sys.argv) > 1
        else "plantation"
    )

    season = (
        sys.argv[2]
        if len(sys.argv) > 2
        else "2026"
    )

    projections_file = (
        BASE_DIR
        / "data"
        / "projections"
        / f"fantasy_projections_{season}.json"
    )

    rankings_file = (
        BASE_DIR
        / "data"
        / "leagues"
        / league_name
        / "rankings.json"
    )

    if not projections_file.exists():
        raise FileNotFoundError(
            f"Projection file not found: {projections_file}"
        )

    if not CONSENSUS_FILE.exists():
        raise FileNotFoundError(
            f"Consensus file not found: {CONSENSUS_FILE}"
        )

    projections_data = load_json(projections_file)
    projections = normalize_projections(projections_data)

    consensus_rankings = load_json(CONSENSUS_FILE)
    consensus_lookup = build_consensus_lookup(
        consensus_rankings
    )

    rankings = sorted(
        projections,
        key=get_projection_score,
        reverse=True,
    )

    for index, player in enumerate(rankings, start=1):
        player["overall_rank"] = index

        player_name = (
            player.get("name")
            or player.get("displayName")
            or ""
        )

        consensus_player = consensus_lookup.get(
            player_name.strip().lower()
        )

        if consensus_player:
            player["consensus_rank"] = (
                consensus_player["consensus_rank"]
            )
            player["sources_used"] = (
                consensus_player["sources_used"]
            )
            player["source_ranks"] = (
                consensus_player["source_ranks"]
            )
            player["value_score"] = round(
                consensus_player["consensus_rank"]
                - index,
                2,
            )
        else:
            player["consensus_rank"] = None
            player["sources_used"] = 0
            player["source_ranks"] = {}
            player["value_score"] = None

    save_json(rankings_file, rankings)

    print(f"Loaded projections from {projections_file}")
    print(f"Created {len(rankings)} rankings.")
    print(f"Saved to {rankings_file}")


if __name__ == "__main__":
    main()