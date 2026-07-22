import json
from pathlib import Path


DATA_DIR = Path("data")


def load_league_settings(league_name):
    path = DATA_DIR / "leagues" / league_name / "settings.json"

    with open(path, "r") as file:
        return json.load(file)


def get_scoring_rules(league_name):
    settings = load_league_settings(league_name)
    return settings["scoring"]