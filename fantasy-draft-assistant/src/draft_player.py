import json
import sys
from pathlib import Path


DATA_DIR = Path("data")


def load_json(path, default):
    if not path.exists():
        return default

    with open(path, "r") as file:
        return json.load(file)


def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)

    with open(path, "w") as file:
        json.dump(data, file, indent=2)


def main():
    if len(sys.argv) < 4:
        print('Usage: python src\\draft_player.py <league> <draft> "<player name>"')
        return

    league_name = sys.argv[1]
    draft_name = sys.argv[2]
    player_name = sys.argv[3]

    league_dir = DATA_DIR / "leagues" / league_name
    rankings_path = league_dir / "rankings.json"
    draft_state_path = league_dir / "drafts" / draft_name / "draft_state.json"

    rankings = load_json(rankings_path, [])
    draft_state = load_json(
        draft_state_path,
        {
            "draft_name": draft_name,
            "drafted_players": []
        }
    )

    matching_player = None

    for player in rankings:
        if player["name"].lower() == player_name.lower():
            matching_player = player
            break

    if matching_player is None:
        print(f"Player not found: {player_name}")
        return

    drafted_players = draft_state["drafted_players"]

    if any(player["id"] == matching_player["id"] for player in drafted_players):
        print(f"{matching_player['name']} is already drafted in {draft_name}.")
        return

    drafted_players.append({
        "id": matching_player["id"],
        "name": matching_player["name"],
        "position": matching_player["position"],
        "team": matching_player["team"]
    })

    save_json(draft_state_path, draft_state)

    print(f"Drafted: {matching_player['name']}")
    print(f"League: {league_name}")
    print(f"Draft: {draft_name}")
    print(f"Saved -> {draft_state_path}")


if __name__ == "__main__":
    main()