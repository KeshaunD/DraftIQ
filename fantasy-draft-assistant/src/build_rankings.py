import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

PROJECTIONS_FILE = BASE_DIR / "data" / "player_projections.json"
CONSENSUS_FILE = BASE_DIR / "data" / "rankings" / "consensus_rankings.json"
RANKINGS_FILE = BASE_DIR / "data" / "leagues" / "plantation" / "rankings.json"


def load_json(file_path):
    with open(file_path, "r", encoding="utf-8") as file:
        return json.load(file)


def save_json(file_path, data):
    with open(file_path, "w", encoding="utf-8") as file:
        json.dump(data, file, indent=4)


def build_consensus_lookup(consensus_rankings):
    return {
        player["name"].lower(): player
        for player in consensus_rankings
    }


def main():
    projections = load_json(PROJECTIONS_FILE)
    consensus_rankings = load_json(CONSENSUS_FILE)
    consensus_lookup = build_consensus_lookup(consensus_rankings)

    rankings = sorted(
        projections,
        key=lambda player: player.get("adjusted_projection", player.get("projection", 0)),
        reverse=True
    )

    for index, player in enumerate(rankings, start=1):
        player["overall_rank"] = index

        consensus_player = consensus_lookup.get(player["name"].lower())

        if consensus_player:
            player["consensus_rank"] = consensus_player["consensus_rank"]
            player["sources_used"] = consensus_player["sources_used"]
            player["source_ranks"] = consensus_player["source_ranks"]
            player["value_score"] = round(
                consensus_player["consensus_rank"] - index,
                2
            )
        else:
            player["consensus_rank"] = None
            player["sources_used"] = 0
            player["source_ranks"] = {}
            player["value_score"] = None

    save_json(RANKINGS_FILE, rankings)

    print(f"Created {len(rankings)} rankings.")
    print(f"Saved to {RANKINGS_FILE}")


if __name__ == "__main__":
    main()