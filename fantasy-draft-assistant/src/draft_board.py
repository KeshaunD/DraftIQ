import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

RANKINGS_FILE = BASE_DIR / "data" / "leagues" / "plantation" / "rankings.json"
DRAFT_STATE_FILE = BASE_DIR / "data" / "leagues" / "plantation" / "drafts" / "mock_001" / "draft_state.json"


def load_json(file_path):
    with open(file_path, "r", encoding="utf-8") as file:
        return json.load(file)


def save_json(file_path, data):
    with open(file_path, "w", encoding="utf-8") as file:
        json.dump(data, file, indent=4)


def get_available_players(rankings, draft_state):
    drafted_names = {
        player["name"].lower()
        for player in draft_state["drafted_players"]
    }

    return [
        player for player in rankings
        if player["name"].lower() not in drafted_names
    ]


def show_players(players, limit=25):
    for index, player in enumerate(players[:limit], start=1):
        print(
            f"{index}. "
            f"{player['name']} - "
            f"{player['position']} - "
            f"{player['team']} - "
            f"{player['adjusted_projection']} pts"
        )


def view_overall_board(rankings, draft_state):
    available_players = get_available_players(rankings, draft_state)
    print("\n=== Overall Draft Board ===\n")
    show_players(available_players)


def view_by_position(rankings, draft_state):
    position = input("\nEnter position (QB, RB, WR, TE): ").upper()
    available_players = get_available_players(rankings, draft_state)

    filtered_players = [
        player for player in available_players
        if player["position"] == position
    ]

    if not filtered_players:
        print(f"\nNo available players found for position: {position}")
        return

    print(f"\n=== Top Available {position}s ===\n")
    show_players(filtered_players)


def draft_player(rankings, draft_state):
    search_name = input("\nEnter player name to draft: ").lower()
    available_players = get_available_players(rankings, draft_state)

    matches = [
        player for player in available_players
        if search_name in player["name"].lower()
    ]

    if not matches:
        print("\nNo available player found with that name.")
        return

    if len(matches) > 1:
        print("\nMultiple matches found:")

        for index, player in enumerate(matches[:10], start=1):
            print(
                f"{index}. "
                f"{player['name']} - "
                f"{player['position']} - "
                f"{player['team']} - "
                f"{player['adjusted_projection']} pts"
            )

        choice = input("\nChoose player number or press Enter to cancel: ")

        if not choice:
            print("\nDraft cancelled.")
            return

        try:
            selected_index = int(choice) - 1
            drafted_player = matches[:10][selected_index]
        except (ValueError, IndexError):
            print("\nInvalid selection.")
            return
    else:
        drafted_player = matches[0]

    drafted_entry = {
        "pick": draft_state["current_pick"],
        "id": drafted_player["id"],
        "name": drafted_player["name"],
        "team": drafted_player["team"],
        "position": drafted_player["position"],
        "projection": drafted_player["adjusted_projection"]
    }

    draft_state["drafted_players"].append(drafted_entry)

    my_pick = input("\nWas this your pick? (y/n): ").lower()

    if my_pick == "y":
        draft_state.setdefault("my_team", [])
        draft_state["my_team"].append(drafted_entry)

    draft_state["current_pick"] += 1
    save_json(DRAFT_STATE_FILE, draft_state)

    print(
        f"\nDrafted: {drafted_player['name']} "
        f"({drafted_player['position']} - {drafted_player['team']})"
    )


def view_drafted_players(draft_state):
    drafted_players = draft_state["drafted_players"]

    if not drafted_players:
        print("\nNo players drafted yet.")
        return

    print("\n=== Drafted Players ===\n")

    for player in drafted_players:
        print(
            f"Pick {player['pick']}: "
            f"{player['name']} - "
            f"{player['position']} - "
            f"{player['team']} - "
            f"{player['projection']} pts"
        )


def search_player(rankings, draft_state):
    search_name = input("\nSearch player name: ").lower()
    available_players = get_available_players(rankings, draft_state)

    matches = [
        player for player in available_players
        if search_name in player["name"].lower()
    ]

    if not matches:
        print("\nNo available players found.")
        return

    print("\n=== Search Results ===\n")
    show_players(matches, limit=10)


def view_my_team(draft_state):
    my_team = draft_state.get("my_team", [])

    if not my_team:
        print("\nYour team is empty.")
        return

    print("\n=== My Team ===\n")

    for player in my_team:
        print(
            f"{player['name']} - "
            f"{player['position']} - "
            f"{player['team']} - "
            f"{player['projection']} pts"
        )


def get_position_counts(my_team):
    counts = {
        "QB": 0,
        "RB": 0,
        "WR": 0,
        "TE": 0
    }

    for player in my_team:
        position = player["position"]

        if position in counts:
            counts[position] += 1

    return counts


def get_position_need_bonus(position, position_counts):
    if position == "QB" and position_counts["QB"] < 1:
        return 35

    if position == "RB":
        if position_counts["RB"] == 0:
            return 45
        if position_counts["RB"] == 1:
            return 30

    if position == "WR":
        if position_counts["WR"] == 0:
            return 45
        if position_counts["WR"] == 1:
            return 30

    if position == "TE" and position_counts["TE"] < 1:
        return 25

    return 0


def get_position_scarcity_bonus(player, available_players):
    same_position_players = [
        p for p in available_players
        if p["position"] == player["position"]
    ]

    if len(same_position_players) <= 3:
        return 25

    if len(same_position_players) <= 6:
        return 15

    if len(same_position_players) <= 10:
        return 8

    return 0


def score_recommendation(player, available_players, position_counts):
    projection_score = player["adjusted_projection"]
    need_bonus = get_position_need_bonus(player["position"], position_counts)
    scarcity_bonus = get_position_scarcity_bonus(player, available_players)
    total_score = projection_score + need_bonus + scarcity_bonus

    return {
        "player": player,
        "score": round(total_score, 2),
        "projection_score": projection_score,
        "need_bonus": need_bonus,
        "scarcity_bonus": scarcity_bonus
    }


def show_recommendation(rankings, draft_state):
    available_players = get_available_players(rankings, draft_state)

    if not available_players:
        print("\nNo available players left.")
        return

    my_team = draft_state.get("my_team", [])
    position_counts = get_position_counts(my_team)

    print("\n=== Best Available ===\n")
    show_players(available_players, limit=5)

    scored_players = [
        score_recommendation(player, available_players, position_counts)
        for player in available_players[:50]
    ]

    scored_players.sort(key=lambda item: item["score"], reverse=True)

    best = scored_players[0]
    recommendation = best["player"]

    print("\n=== Recommendation ===\n")
    print(
        f"Recommended Pick: {recommendation['name']} - "
        f"{recommendation['position']} - "
        f"{recommendation['team']} - "
        f"{recommendation['adjusted_projection']} pts"
    )

    print(f"\nRecommendation Score: {best['score']}")

    print("\nScore Breakdown:")
    print(f"- Projection score: {best['projection_score']}")
    print(f"- Roster need bonus: +{best['need_bonus']}")
    print(f"- Position scarcity bonus: +{best['scarcity_bonus']}")

    print("\nReason:")

    if best["need_bonus"] > 0:
        print(f"- You still need help at {recommendation['position']}.")
    else:
        print("- Your main starting roster needs are mostly covered.")

    if best["scarcity_bonus"] > 0:
        print(f"- Available {recommendation['position']} depth is getting thinner.")

    print("- This player has the best combined value based on projection, need, and scarcity.")


def main():
    rankings = load_json(RANKINGS_FILE)
    draft_state = load_json(DRAFT_STATE_FILE)

    while True:
        print("\n=== Fantasy Draft Board ===")
        print("1. View overall board")
        print("2. View by position")
        print("3. Draft player")
        print("4. View drafted players")
        print("5. Search player")
        print("6. View my team")
        print("7. Recommendation")
        print("8. Exit")

        choice = input("\nChoose an option: ")

        if choice == "1":
            view_overall_board(rankings, draft_state)
        elif choice == "2":
            view_by_position(rankings, draft_state)
        elif choice == "3":
            draft_player(rankings, draft_state)
        elif choice == "4":
            view_drafted_players(draft_state)
        elif choice == "5":
            search_player(rankings, draft_state)
        elif choice == "6":
            view_my_team(draft_state)
        elif choice == "7":
            show_recommendation(rankings, draft_state)
        elif choice == "8":
            print("\nExiting draft board.")
            break
        else:
            print("\nInvalid option. Try again.")


if __name__ == "__main__":
    main()