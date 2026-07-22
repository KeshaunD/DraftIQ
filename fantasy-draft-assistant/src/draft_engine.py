import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

RANKINGS_FILE = BASE_DIR / "data" / "leagues" / "plantation" / "rankings.json"
DRAFT_STATE_FILE = BASE_DIR / "data" / "leagues" / "plantation" / "draft_state.json"


def load_json(file_path, default=None):
    if not file_path.exists():
        return default

    with open(file_path, "r", encoding="utf-8") as file:
        return json.load(file)


def save_json(file_path, data):
    file_path.parent.mkdir(parents=True, exist_ok=True)

    with open(file_path, "w", encoding="utf-8") as file:
        json.dump(data, file, indent=4)


def normalize_name(name):
    return name.lower().strip()


def create_initial_draft_state():
    return {
        "drafted_players": [],
        "my_roster": [],
        "current_pick": 1
    }


def get_available_players(rankings, drafted_players):
    drafted_names = {
        normalize_name(player["name"])
        for player in drafted_players
    }

    return [
        player
        for player in rankings
        if normalize_name(player["name"]) not in drafted_names
    ]


def draft_player(player_name, drafted_by_me=False):
    rankings = load_json(RANKINGS_FILE, [])
    draft_state = load_json(DRAFT_STATE_FILE, create_initial_draft_state())

    player_lookup = {
        normalize_name(player["name"]): player
        for player in rankings
    }

    player_key = normalize_name(player_name)

    if player_key not in player_lookup:
        print(f"Could not find player: {player_name}")
        return

    drafted_player = player_lookup[player_key]

    draft_state["drafted_players"].append({
        "name": drafted_player["name"],
        "team": drafted_player.get("team"),
        "position": drafted_player.get("position"),
        "overall_rank": drafted_player.get("overall_rank"),
        "consensus_rank": drafted_player.get("consensus_rank"),
        "pick": draft_state["current_pick"]
    })

    if drafted_by_me:
        draft_state["my_roster"].append(drafted_player)

    draft_state["current_pick"] += 1

    save_json(DRAFT_STATE_FILE, draft_state)

    print(f"Drafted: {drafted_player['name']}")


def show_best_available(limit=10):
    rankings = load_json(RANKINGS_FILE, [])
    draft_state = load_json(DRAFT_STATE_FILE, create_initial_draft_state())

    available_players = get_available_players(
        rankings,
        draft_state["drafted_players"]
    )

    print("\nBest Available")
    print("=" * 40)

    for player in available_players[:limit]:
        print(
            f"{player['overall_rank']}. {player['name']} "
            f"{player.get('position', '')} "
            f"- Projection: {player.get('adjusted_projection')} "
            f"- Consensus: {player.get('consensus_rank')}"
        )


def main():
    show_best_available()


if __name__ == "__main__":
    main()