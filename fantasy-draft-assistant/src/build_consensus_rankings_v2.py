import json
import re
from pathlib import Path
from statistics import mean


BASE_DIR = Path(__file__).resolve().parent.parent

SOURCES_DIR = BASE_DIR / "data" / "rankings" / "sources"
OUTPUT_FILE = BASE_DIR / "data" / "rankings" / "consensus_rankings.json"


SOURCE_WEIGHTS = {
    "rotowire": 0.50,
    "draftsharks": 0.20,
    "fantasypros": 0.20,
    "flock": 0.10,
}


ENABLED_SOURCES = set(SOURCE_WEIGHTS.keys())


RANK_KEYS = [
    "rank",
    "adp",
    "overall_rank",
    "overallRank",
    "consensus_rank",
    "consensusRank",
    "ecr",
    "ECR",
]


POSITION_KEYS = [
    "position",
    "pos",
]


TEAM_KEYS = [
    "team",
    "tm",
]


def load_json(path):
    with open(path, "r", encoding="utf-8") as file:
        return json.load(file)


def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)

    with open(path, "w", encoding="utf-8") as file:
        json.dump(data, file, indent=4)


def clean_name(name):
    name = str(name)
    name = re.sub(r"\s+", " ", name).strip()

    name = re.sub(
        r"\s+(ARI|ATL|BAL|BUF|CAR|CHI|CIN|CLE|DAL|DEN|DET|GB|GNB|HOU|IND|JAX|JAC|KC|KAN|LV|LVR|LAC|LAR|LA|MIA|MIN|NE|NWE|NO|NOR|NYG|NYJ|PHI|PIT|SEA|SF|SFO|TB|TAM|TEN|WAS|WSH)\s+(QB|RB|WR|TE|K|DST|DEF)$",
        "",
        name,
    )

    name = re.sub(r"\s+\((QB|RB|WR|TE|K|DST|DEF)\)$", "", name)

    return name.strip()


def normalize_name(name):
    name = clean_name(name).lower()
    name = name.replace(".", "")
    name = name.replace("'", "")
    name = name.replace("’", "")
    name = name.replace("-", " ")
    name = re.sub(r"\b(jr|sr|ii|iii|iv|v)\b", "", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name


def safe_number(value):
    if value is None:
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def get_first_value(player, keys):
    for key in keys:
        value = player.get(key)
        if value not in [None, ""]:
            return value

    return None


def get_rank(player):
    value = get_first_value(player, RANK_KEYS)
    return safe_number(value)


def get_position(player):
    return get_first_value(player, POSITION_KEYS)


def get_team(player):
    return get_first_value(player, TEAM_KEYS)


def calculate_weighted_score(source_ranks):
    weighted_total = 0
    weight_total = 0

    for source, rank in source_ranks.items():
        weight = SOURCE_WEIGHTS.get(source, 0)

        if weight <= 0:
            continue

        weighted_total += rank * weight
        weight_total += weight

    if weight_total == 0:
        return None

    return round(weighted_total / weight_total, 2)


def calculate_supporting_average(source_ranks):
    supporting_ranks = [
        rank
        for source, rank in source_ranks.items()
        if source != "rotowire"
    ]

    if not supporting_ranks:
        return None

    return round(mean(supporting_ranks), 2)


def calculate_disagreement(source_ranks):
    if len(source_ranks) < 2:
        return {
            "source_disagreement": False,
            "rank_spread": 0,
        }

    ranks = list(source_ranks.values())
    spread = round(max(ranks) - min(ranks), 2)

    return {
        "source_disagreement": spread >= 15,
        "rank_spread": spread,
    }


def main():
    players = {}

    for source_file in sorted(SOURCES_DIR.glob("*.json")):
        source = source_file.stem.lower()

        if source not in ENABLED_SOURCES:
            print(f"Skipping source: {source}")
            continue

        print(f"Using source: {source}")

        rankings = load_json(source_file)

        if not isinstance(rankings, list):
            print(f"  Skipping {source}: expected a list of players.")
            continue

        for player in rankings:
            raw_name = player.get("name") or player.get("player") or player.get("player_name")

            if not raw_name:
                continue

            rank = get_rank(player)

            if rank is None:
                continue

            name = clean_name(raw_name)
            key = normalize_name(raw_name)

            if not key:
                continue

            if key not in players:
                players[key] = {
                    "name": name,
                    "normalized_name": key,
                    "position": get_position(player),
                    "team": get_team(player),
                    "source_ranks": {},
                }

            if len(name) < len(players[key]["name"]):
                players[key]["name"] = name

            if not players[key].get("position"):
                players[key]["position"] = get_position(player)

            if not players[key].get("team"):
                players[key]["team"] = get_team(player)

            players[key]["source_ranks"][source] = rank

    consensus = []

    for player in players.values():
        source_ranks = player["source_ranks"]

        weighted_score = calculate_weighted_score(source_ranks)

        if weighted_score is None:
            continue

        rotowire_rank = source_ranks.get("rotowire")
        supporting_average = calculate_supporting_average(source_ranks)
        disagreement = calculate_disagreement(source_ranks)

        consensus.append({
            "name": player["name"],
            "normalized_name": player["normalized_name"],
            "position": player.get("position"),
            "team": player.get("team"),

            "rank": None,
            "consensus_rank": weighted_score,
            "draftiq_score": weighted_score,

            "primary_source": "rotowire",
            "primary_rank": rotowire_rank,
            "has_primary_source": rotowire_rank is not None,

            "supporting_average": supporting_average,
            "sources_used": len(source_ranks),
            "source_ranks": source_ranks,

            "source_disagreement": disagreement["source_disagreement"],
            "rank_spread": disagreement["rank_spread"],
        })

    consensus.sort(
        key=lambda player: (
            not player["has_primary_source"],
            player["draftiq_score"],
            player["name"],
        )
    )

    for index, player in enumerate(consensus, start=1):
        player["rank"] = index

    save_json(OUTPUT_FILE, consensus)

    print(f"\nCreated {len(consensus)} consensus rankings.")
    print(f"RotoWire primary players: {sum(1 for p in consensus if p['has_primary_source'])}")
    print(f"Supporting-only players: {sum(1 for p in consensus if not p['has_primary_source'])}")
    print(f"Saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()