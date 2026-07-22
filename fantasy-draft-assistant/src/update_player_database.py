import json
from pathlib import Path

DATA_DIR = Path("data")

PLAYERS_FILE = DATA_DIR / "players.json"
WR_FOLDER = DATA_DIR / "historical" / "wr"


def load_json(path):
    with open(path, "r") as f:
        return json.load(f)


def save_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def normalize(name):
    return (
        name.lower()
        .replace(".", "")
        .replace("'", "")
        .replace("-", " ")
        .replace(" jr", "")
        .replace(" sr", "")
        .replace(" ii", "")
        .replace(" iii", "")
        .replace(" iv", "")
        .strip()
    )


def main():

    players = load_json(PLAYERS_FILE)

    lookup = {
        normalize(player["name"]): player
        for player in players
    }

    added = 0
    existing = 0

    for round_number in range(1, 8):

        round_file = WR_FOLDER / f"round_{round_number}.json"

        if not round_file.exists():
            continue

        wr_players = load_json(round_file)

        for wr in wr_players:

            key = normalize(wr["name"])

            if key in lookup:

                existing += 1

                player = lookup[key]

                player.setdefault("draft_year", wr["draft_year"])
                player.setdefault("draft_round", round_number)
                player.setdefault("college", wr["college"])

            else:

                players.append({
                    "espn_id": wr.get("espn_id"),
                    "name": wr["name"],
                    "team": wr["team"],
                    "team_name": "",
                    "position": "WR",
                    "jersey": None,
                    "draft_year": wr["draft_year"],
                    "draft_round": round_number,
                    "college": wr["college"],
                    "active": True
                })

                added += 1

    players.sort(key=lambda p: p["name"])

    save_json(PLAYERS_FILE, players)

    print()
    print("Player database updated.")
    print(f"Existing players updated : {existing}")
    print(f"New players added        : {added}")
    print(f"Total players            : {len(players)}")


if __name__ == "__main__":
    main()