def build_ai_prompt(recommendation):
    team_counts = recommendation["team_counts"]
    best_overall = recommendation["best_overall"]
    best_team_fit = recommendation["best_team_fit"]
    reason_flags = recommendation["reason_flags"]

    prompt = f"""
You are a fantasy football draft assistant.

Current roster:
QB: {team_counts.get("QB", 0)}
RB: {team_counts.get("RB", 0)}
WR: {team_counts.get("WR", 0)}
TE: {team_counts.get("TE", 0)}

Best overall available:
{best_overall["name"]}, {best_overall["position"]}, {best_overall["team"]}
Projection: {best_overall["projection"]}
Overall Rank: {best_overall["overall_rank"]}

Best team fit:
{best_team_fit["name"]}, {best_team_fit["position"]}, {best_team_fit["team"]}
Projection: {best_team_fit["projection"]}
Overall Rank: {best_team_fit["overall_rank"]}

Reason flags:
{reason_flags}

Write a short draft recommendation explaining who to pick and why.
Make it sound like a helpful fantasy football co-manager.
"""
    return prompt