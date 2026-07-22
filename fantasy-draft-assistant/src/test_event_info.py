import json
from pathlib import Path

DATA_DIR = Path("data")

with open(DATA_DIR / "player_game_logs.json", "r") as file:
    players = json.load(file)

amon = players["4374302"]

first_game = amon["games"][0]

print(json.dumps(first_game["event_info"], indent=2))