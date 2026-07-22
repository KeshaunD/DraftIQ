import json
import re
from pathlib import Path
from statistics import mean

BASE_DIR = Path(__file__).resolve().parent.parent

SOURCES_DIR = BASE_DIR / "data" / "rankings" / "sources"
OUTPUT_FILE = BASE_DIR / "data" / "rankings" / "consensus_rankings.json"

ENABLED_SOURCES = {
    "fantasypros",
    "draftsharks",
    "fantasydata",
    "flock",
}


def load_json(path):
    with open(path, "r", encoding="utf-8") as file:
        return json.load(file)


def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)

    with open(path, "w", encoding="utf-8") as file:
        json.dump(data, file, indent=4)


def clean_name(name):
    name = re.sub(r"\s+", " ", name).strip()

    # Remove trailing team + position, ex:
    # "Bijan Robinson ATL RB"
    # "Ashton Jeanty LVR RB"
    # "Brian Thomas Jr. JAC WR"
    name = re.sub(
        r"\s+[A-Z]{2,4}\s+(QB|RB|WR|TE|K|DST|DEF)$",
        "",
        name
    )

    return name.strip()


def normalize_name(name):
    name = clean_name(name).lower()
    name = name.replace(".", "")
    name = name.replace("'", "")
    name = name.replace("-", " ")
    name = re.sub(r"\b(jr|sr|ii|iii|iv)\b", "", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name


def main():
    players = {}

    for source_file in sorted(SOURCES_DIR.glob("*.json")):
        source = source_file.stem

        if source not in ENABLED_SOURCES:
            print(f"Skipping source: {source}")
            continue

        print(f"Using source: {source}")

        rankings = load_json(source_file)

        for player in rankings:
            raw_name = player.get("name")
            rank = player.get("rank")

            if not raw_name or not isinstance(rank, (int, float)):
                continue

            name = clean_name(raw_name)
            key = normalize_name(raw_name)

            if key not in players:
                players[key] = {
                    "name": name,
                    "normalized_name": key,
                    "source_ranks": {},
                }

            if len(name) < len(players[key]["name"]):
                players[key]["name"] = name

            players[key]["source_ranks"][source] = rank

    consensus = []

    for player in players.values():
        ranks = list(player["source_ranks"].values())

        consensus.append({
            "name": player["name"],
            "normalized_name": player["normalized_name"],
            "consensus_rank": round(mean(ranks), 2),
            "sources_used": len(ranks),
            "source_ranks": player["source_ranks"],
        })

    consensus.sort(key=lambda player: player["consensus_rank"])

    save_json(OUTPUT_FILE, consensus)

    print(f"\nCreated {len(consensus)} consensus rankings.")
    print(f"Saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()