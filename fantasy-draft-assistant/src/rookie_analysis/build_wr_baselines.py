import json
from pathlib import Path
from statistics import mean, median, stdev


DATA_DIR = Path("data")


def load_json(path):
    with open(path, "r") as file:
        return json.load(file)


def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)

    with open(path, "w") as file:
        json.dump(data, file, indent=2)


def percentile(values, percent):
    if not values:
        return 0

    values = sorted(values)
    index = round((percent / 100) * (len(values) - 1))
    return values[index]


def summarize(values):
    if not values:
        return {
            "average": 0,
            "median": 0,
            "min": 0,
            "max": 0,
            "p25": 0,
            "p75": 0,
            "p90": 0,
            "std_dev": 0
        }

    return {
        "average": round(mean(values), 2),
        "median": round(median(values), 2),
        "min": min(values),
        "max": max(values),
        "p25": percentile(values, 25),
        "p75": percentile(values, 75),
        "p90": percentile(values, 90),
        "std_dev": round(stdev(values), 2) if len(values) > 1 else 0
    }


def main():
    history_path = DATA_DIR / "historical" / "rookie_wr_history.json"
    players = load_json(history_path)

    grouped = {}

    for player in players:
        draft_round = str(player["draft_round"])
        grouped.setdefault(draft_round, []).append(player)

    baselines = {}

    for draft_round, round_players in grouped.items():
        games = []
        targets = []
        receptions = []
        receiving_yards = []
        receiving_touchdowns = []

        for player in round_players:
            stats = player["rookie_stats"]

            games.append(stats.get("games", 0))
            targets.append(stats.get("targets", 0))
            receptions.append(stats.get("receptions", 0))
            receiving_yards.append(stats.get("receiving_yards", 0))
            receiving_touchdowns.append(stats.get("receiving_touchdowns", 0))

        baselines[draft_round] = {
            "sample_size": len(round_players),
            "games": summarize(games),
            "targets": summarize(targets),
            "receptions": summarize(receptions),
            "receiving_yards": summarize(receiving_yards),
            "receiving_touchdowns": summarize(receiving_touchdowns),
            "hit_rates": {
                "500_yards": round(
                    sum(1 for value in receiving_yards if value >= 500) / len(receiving_yards),
                    3
                ),
                "800_yards": round(
                    sum(1 for value in receiving_yards if value >= 800) / len(receiving_yards),
                    3
                ),
                "1000_yards": round(
                    sum(1 for value in receiving_yards if value >= 1000) / len(receiving_yards),
                    3
                ),
                "under_300_yards": round(
                    sum(1 for value in receiving_yards if value < 300) / len(receiving_yards),
                    3
                )
            }
        }

    output_file = DATA_DIR / "rookie_baselines" / "wr_by_draft_round.json"
    save_json(output_file, baselines)

    print(f"Saved WR rookie baselines.")
    print(f"Output -> {output_file}")


if __name__ == "__main__":
    main()