import json
from pathlib import Path

import requests

from config import FANTASY_POSITIONS, TEAMS_URL
from espn_api import fetch_roster, get_json


DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)


def main():
    teams_data = get_json(TEAMS_URL)

    teams = []
    players = []
    team_contexts = []

    # Build teams list.
    for item in teams_data["items"]:
        team_ref = item["$ref"]
        team_data = get_json(team_ref)

        team = {
            "id": team_data["id"],
            "abbreviation": team_data["abbreviation"],
            "display_name": team_data["displayName"],
            "name": team_data["name"],
            "location": team_data["location"],
        }

        teams.append(team)

    with open(DATA_DIR / "teams.json", "w") as file:
        json.dump(teams, file, indent=2)

    print(f"Saved {len(teams)} teams to data/teams.json")

    # Loop through every NFL team.
    for team in teams:
        print(f"Fetching roster for {team['display_name']}")

        try:
            roster = fetch_roster(team["id"])
        except requests.exceptions.HTTPError as error:
            print(f"Skipping {team['display_name']} because ESPN returned an error: {error}")
            continue

        # Save coach/team context.
        coach_data = roster.get("coach", [])
        coach = None

        if coach_data:
            first_coach = coach_data[0]

            coach = {
                "id": first_coach.get("id"),
                "name": f"{first_coach.get('firstName')} {first_coach.get('lastName')}",
                "experience": first_coach.get("experience"),
            }

        team_context = {
            "team": team["abbreviation"],
            "team_name": team["display_name"],
            "espn_team_id": team["id"],
            "coach": coach,
        }

        team_contexts.append(team_context)

        # Save fantasy-relevant players.
        seen_players = set()

        for group in roster["athletes"]:
            for player in group.get("items", []):
                player_id = player.get("id")
                name = player.get("displayName")
                jersey = player.get("jersey")
                position = player.get("position", {}).get("abbreviation")

                if player_id in seen_players:
                    continue

                seen_players.add(player_id)

                if position not in FANTASY_POSITIONS:
                    continue

                player_record = {
                    "espn_id": player_id,
                    "name": name,
                    "team": team["abbreviation"],
                    "team_name": team["display_name"],
                    "position": position,
                    "jersey": jersey,
                }

                players.append(player_record)

    with open(DATA_DIR / "players.json", "w") as file:
        json.dump(players, file, indent=2)

    print(f"Saved {len(players)} fantasy players to data/players.json")

    with open(DATA_DIR / "team_context.json", "w") as file:
        json.dump(team_contexts, file, indent=2)

    print(f"Saved {len(team_contexts)} team contexts to data/team_context.json")


if __name__ == "__main__":
    main()