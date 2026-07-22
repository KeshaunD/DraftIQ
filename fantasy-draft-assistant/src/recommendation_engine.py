from collections import Counter


CORE_POSITIONS = {"RB", "WR", "TE"}


def count_positions(players):
    return Counter(player["position"] for player in players)


def best_available_by_position(available_players, position):
    for player in available_players:
        if player["position"] == position:
            return player
    return None


def build_recommendation(draft_state, rankings):
    my_team = draft_state.get("my_team", [])

    drafted_ids = {
        player["id"]
        for player in draft_state["drafted_players"]
    }

    available_players = [
        player for player in rankings
        if player["id"] not in drafted_ids
    ]

    if not available_players:
        return None

    team_counts = count_positions(my_team)

    best_overall = available_players[0]
    best_rb = best_available_by_position(available_players, "RB")
    best_wr = best_available_by_position(available_players, "WR")
    best_te = best_available_by_position(available_players, "TE")

    best_team_fit = best_overall
    reason_flags = ["Best player available"]

    if team_counts["RB"] == 0 and best_rb:
        best_team_fit = best_rb
        reason_flags = [
            "No RBs on roster",
            "RB production can drop quickly",
            "RB value is close enough to best overall"
        ]

    elif team_counts["RB"] <= 1 and best_rb and best_rb["overall_rank"] <= best_overall["overall_rank"] + 8:
        best_team_fit = best_rb
        reason_flags = [
            "RB depth is still a need",
            "Available RB is close enough in overall value",
            "Avoiding RB cliff risk"
        ]

    elif team_counts["WR"] == 0 and best_wr:
        best_team_fit = best_wr
        reason_flags = [
            "No WRs on roster",
            "WR is a required core position"
        ]

    elif team_counts["TE"] == 0 and best_te and best_te["overall_rank"] <= best_overall["overall_rank"] + 10:
        best_team_fit = best_te
        reason_flags = [
            "No TE on roster",
            "TE value is close enough",
            "Potential positional advantage"
        ]

    return {
        "team_counts": dict(team_counts),
        "best_overall": best_overall,
        "best_team_fit": best_team_fit,
        "reason_flags": reason_flags,
        "available_count": len(available_players),
        "top_available": available_players[:10],
    }