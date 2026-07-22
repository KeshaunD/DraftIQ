import json
import sys
import urllib.request
from pathlib import Path


DATA_DIR = Path("data")

ALL_NFL_TEAMS = {
    "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE",
    "DAL", "DEN", "DET", "GB", "HOU", "IND", "JAX", "KC",
    "LAC", "LAR", "LV", "MIA", "MIN", "NE", "NO", "NYG",
    "NYJ", "PHI", "PIT", "SEA", "SF", "TB", "TEN", "WSH",
}

TEAM_ALIASES = {
    "ARZ": "ARI",
    "JAC": "JAX",
    "LA": "LAR",
    "WSH": "WSH",
    "WAS": "WSH",
    "WSN": "WSH",
    "SF": "SF",
    "SFO": "SF",
    "GB": "GB",
    "GNB": "GB",
    "KC": "KC",
    "KAN": "KC",
    "NE": "NE",
    "NWE": "NE",
    "NO": "NO",
    "NOR": "NO",
    "TB": "TB",
    "TAM": "TB",
    "LV": "LV",
    "LVR": "LV",
}


def normalize_team(abbreviation):
    if not abbreviation:
        return None

    abbreviation = abbreviation.upper().strip()
    return TEAM_ALIASES.get(abbreviation, abbreviation)


def fetch_week_schedule(season, week):
    url = (
        "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
        f"?limit=1000&dates={season}&seasontype=2&week={week}"
    )

    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "DraftIQ/1.0",
            "Accept": "application/json",
        },
    )

    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def get_teams_playing_that_week(schedule_data):
    teams = set()

    for event in schedule_data.get("events", []):
        for competition in event.get("competitions", []):
            for competitor in competition.get("competitors", []):
                team = competitor.get("team", {})
                abbreviation = normalize_team(team.get("abbreviation"))

                if abbreviation:
                    teams.add(abbreviation)

    return teams


def build_bye_weeks(season):
    bye_weeks = {}

    for week in range(1, 19):
        print(f"Checking Week {week}...")

        try:
            schedule_data = fetch_week_schedule(season, week)
        except Exception as error:
            print(f"  Could not fetch Week {week}: {error}")
            continue

        teams_playing = get_teams_playing_that_week(schedule_data)

        if not teams_playing:
            print(f"  No teams found for Week {week}. Skipping.")
            continue

        teams_on_bye = sorted(ALL_NFL_TEAMS - teams_playing)

        if len(teams_on_bye) > 8:
            print(
                f"  Week {week} looked incomplete. "
                f"Found {len(teams_on_bye)} missing teams. Skipping."
            )
            continue

        if not teams_on_bye:
            print("  No byes this week.")
            continue

        print(f"  Bye teams: {', '.join(teams_on_bye)}")

        for team in teams_on_bye:
            if team in bye_weeks:
                print(
                    f"  Warning: {team} already had bye Week {bye_weeks[team]}. "
                    f"Skipping duplicate Week {week}."
                )
                continue

            bye_weeks[team] = week

    return dict(sorted(bye_weeks.items()))


def main():
    season = int(sys.argv[1]) if len(sys.argv) > 1 else 2026
    output_path = DATA_DIR / f"bye_weeks_{season}.json"

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    bye_weeks = build_bye_weeks(season)

    with open(output_path, "w") as file:
        json.dump(bye_weeks, file, indent=2)

    print()
    print(f"Saved {len(bye_weeks)} bye weeks.")
    print(f"Output -> {output_path}")

    missing_teams = sorted(ALL_NFL_TEAMS - set(bye_weeks.keys()))

    if missing_teams:
        print()
        print("Teams without detected bye weeks:")
        print(", ".join(missing_teams))


if __name__ == "__main__":
    main()