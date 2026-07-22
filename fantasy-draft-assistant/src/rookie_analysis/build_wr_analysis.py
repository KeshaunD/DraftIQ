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


def analyze_round(round_file):
    players = load_json(round_file)

    games = []
    targets = []
    receptions = []
    yards = []
    touchdowns = []

    for player in players:
        stats = player.get("rookie_stats", {})

        if not stats:
            continue

        games.append(stats.get("games", 0))
        targets.append(stats.get("targets", 0))
        receptions.append(stats.get("receptions", 0))
        yards.append(stats.get("receiving_yards", 0))
        touchdowns.append(stats.get("receiving_touchdowns", 0))

    if not yards:
        return {"sample_size": 0}

    return {
        "sample_size": len(yards),
        "games": summarize(games),
        "targets": summarize(targets),
        "receptions": summarize(receptions),
        "receiving_yards": summarize(yards),
        "receiving_touchdowns": summarize(touchdowns),
        "success_rates": {
            "elite_1000": round(sum(y >= 1000 for y in yards) / len(yards), 3),
            "great_800": round(sum(y >= 800 for y in yards) / len(yards), 3),
            "starter_600": round(sum(y >= 600 for y in yards) / len(yards), 3),
            "contributor_300": round(sum(y >= 300 for y in yards) / len(yards), 3),
            "bust_under_300": round(sum(y < 300 for y in yards) / len(yards), 3)
        }
    }


def main():
    wr_folder = DATA_DIR / "historical" / "wr"

    analysis = {}

    for i in range(1, 8):
        round_key = f"round_{i}"
        round_file = wr_folder / f"{round_key}.json"

        if not round_file.exists():
            analysis[round_key] = {"sample_size": 0}
            continue

        analysis[round_key] = analyze_round(round_file)

    output_file = DATA_DIR / "historical" / "rookie_wr_analysis.json"

    save_json(output_file, analysis)

    print("WR historical analysis created.")
    print(f"Output -> {output_file}")

    print()
    for round_key, data in analysis.items():
        print(f"{round_key}: sample size {data.get('sample_size', 0)}")


if __name__ == "__main__":
    main()