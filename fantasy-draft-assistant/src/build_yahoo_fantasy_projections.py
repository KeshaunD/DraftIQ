import json
import re
import sys
from pathlib import Path


DATA_DIR = Path("data")

TEAM_ALIASES = {
    "ARZ": "ARI",
    "ARI": "ARI",
    "ATL": "ATL",
    "BAL": "BAL",
    "BUF": "BUF",
    "CAR": "CAR",
    "CHI": "CHI",
    "CIN": "CIN",
    "CLE": "CLE",
    "DAL": "DAL",
    "DEN": "DEN",
    "DET": "DET",
    "GB": "GB",
    "GNB": "GB",
    "HOU": "HOU",
    "IND": "IND",
    "JAC": "JAX",
    "JAX": "JAX",
    "KC": "KC",
    "KAN": "KC",
    "LAC": "LAC",
    "LAR": "LAR",
    "LA": "LAR",
    "LV": "LV",
    "LVR": "LV",
    "MIA": "MIA",
    "MIN": "MIN",
    "NE": "NE",
    "NWE": "NE",
    "NO": "NO",
    "NOR": "NO",
    "NYG": "NYG",
    "NYJ": "NYJ",
    "PHI": "PHI",
    "PIT": "PIT",
    "SEA": "SEA",
    "SF": "SF",
    "SFO": "SF",
    "TB": "TB",
    "TAM": "TB",
    "TEN": "TEN",
    "WAS": "WSH",
    "WSH": "WSH",
}

TEAM_PATTERN = "|".join(sorted(TEAM_ALIASES.keys(), key=len, reverse=True))
POSITION_PATTERN = "QB|RB|WR|TE|K|DEF|DST"


def load_json(path):
    with open(path, "r", encoding="utf-8") as file:
        return json.load(file)


def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)

    with open(path, "w", encoding="utf-8") as file:
        json.dump(data, file, indent=2)


def clean_text(value):
    return (
        str(value or "")
        .replace("\uE001", "")
        .replace("\uE075", "")
        .replace("\uE171", "")
        .strip()
    )


def safe_number(value, default=None):
    if value in [None, "", "-"]:
        return default

    value = str(value).replace(",", "").replace("%", "").strip()

    try:
        return float(value)
    except ValueError:
        return default


def normalize_team(team):
    team = str(team or "").upper().strip()
    return TEAM_ALIASES.get(team, team)


def clean_name(name):
    name = clean_text(name)

    name = name.replace("Video Forecast", "")
    name = name.replace("No new player Notes", "")
    name = name.replace("New player Notes", "")
    name = name.replace("Player Note", "")
    name = name.replace("Forecast", "")

    # Yahoo sometimes attaches status tags directly to the name:
    # Cooper KuppNew, Fernando MendozaNA, Zach CharbonnetQ, etc.
    name = re.sub(
        r"(New|NA|IR|PUP|SUSP|Q)$",
        "",
        name,
        flags=re.IGNORECASE,
    )

    name = re.sub(r"\s+", " ", name).strip()
    return name


def parse_player_info(row):
    cells = row.get("_cells", [])

    if len(cells) < 7:
        return None

    player_text = clean_text(cells[2])

    match = re.search(
        rf"\b({TEAM_PATTERN})\s*-\s*({POSITION_PATTERN})\b",
        player_text,
        flags=re.IGNORECASE,
    )

    if not match:
        return None

    raw_name = player_text[:match.start()]
    team = normalize_team(match.group(1))
    position = match.group(2).upper()

    if position == "DST":
        position = "DEF"

    name = clean_name(raw_name)

    if not name:
        return None

    return {
        "name": name,
        "team": team,
        "position": position,
    }


def name_aliases(name):
    aliases = {name}

    stripped_suffix = re.sub(
        r"\s+(Jr\.?|Sr\.?|II|III|IV|V)$",
        "",
        name,
        flags=re.IGNORECASE,
    ).strip()

    if stripped_suffix and stripped_suffix != name:
        aliases.add(stripped_suffix)

    no_periods = name.replace(".", "").strip()

    if no_periods and no_periods != name:
        aliases.add(no_periods)

    return aliases


def main():
    season = int(sys.argv[1]) if len(sys.argv) > 1 else 2026

    input_path = DATA_DIR / "projections" / "yahoo_players_projection_export.json"
    output_path = DATA_DIR / "projections" / f"fantasy_projections_{season}.json"

    yahoo_rows = load_json(input_path)

    projections = {}
    parsed_count = 0
    skipped_count = 0

    for row in yahoo_rows:
        info = parse_player_info(row)
        cells = row.get("_cells", [])

        if not info:
            skipped_count += 1
            continue

        projection = safe_number(cells[6] if len(cells) > 6 else None)

        if projection is None:
            skipped_count += 1
            continue

        projected_games = 17
        projected_ppg = round(projection / projected_games, 2)

        yahoo_rank = safe_number(cells[7] if len(cells) > 7 else None)
        yahoo_position_rank = safe_number(cells[8] if len(cells) > 8 else None)
        yahoo_rostered = safe_number(cells[9] if len(cells) > 9 else None)

        base_record = {
            "name": info["name"],
            "team": info["team"],
            "position": info["position"],
            "projection": round(projection, 2),
            "projectedPpg": projected_ppg,
            "projectedGames": projected_games,
            "projectionSource": "yahoo_season_projection_2026",
            "source": "yahoo_season_projection_2026",
            "yahooRank": int(yahoo_rank) if yahoo_rank is not None else None,
            "yahooPositionRank": int(yahoo_position_rank) if yahoo_position_rank is not None else None,
            "yahooRosteredPercent": yahoo_rostered,

            "projected_fantasy_points": round(projection, 2),
            "projected_ppg": projected_ppg,
        }

        for alias in name_aliases(info["name"]):
            record = dict(base_record)
            record["name"] = alias
            record["displayName"] = info["name"]
            projections[alias] = record

        parsed_count += 1

    save_json(output_path, projections)

    print(f"Loaded {len(yahoo_rows)} Yahoo projection rows.")
    print(f"Parsed {parsed_count} Yahoo projections.")
    print(f"Skipped {skipped_count} rows.")
    print(f"Saved {len(projections)} projection lookup records.")
    print(f"Output -> {output_path}")


if __name__ == "__main__":
    main()