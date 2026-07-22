import json
import re
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE_DIR = Path(__file__).resolve().parent.parent.parent


def save_json(file_path, data):
    with open(file_path, "w", encoding="utf-8") as file:
        json.dump(data, file, indent=4)


def clean_player_name(name):
    name = re.sub(r"\s+", " ", name).strip()
    name = re.sub(r"\s*\([A-Z]{2,3}\)$", "", name)
    return name.strip()


def looks_like_player_name(value):
    if not value:
        return False

    if value.isdigit():
        return False

    bad_values = {
        "rank",
        "player",
        "team",
        "pos",
        "position",
        "adp",
        "avg",
        "min",
        "max",
        "bye"
    }

    if value.lower() in bad_values:
        return False

    if re.match(r"^(QB|RB|WR|TE|K|DEF|DST)-\d+$", value):
        return False

    return True


def get_player_name_from_link(row, player_link_selector):
    if not player_link_selector:
        return None

    player_link = row.locator(player_link_selector).first

    if player_link.count() == 0:
        return None

    return clean_player_name(player_link.inner_text().strip())


def scrape_table_rankings(
    url,
    output_file,
    wait_ms=5000,
    player_link_selector=None
):
    rankings = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page()

        page.goto(url, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(wait_ms)

        rows = page.locator("table tbody tr").all()

        for row in rows:
            cells = row.locator("td").all()

            if len(cells) < 2:
                continue

            rank = None
            player_name = get_player_name_from_link(row, player_link_selector)

            for cell in cells:
                text = cell.inner_text().strip()

                if text.isdigit() and rank is None:
                    rank = int(text)
                    continue

                if player_name:
                    continue

                cleaned = clean_player_name(text)

                if looks_like_player_name(cleaned):
                    player_name = cleaned

            if rank and player_name:
                rankings.append({
                    "name": player_name,
                    "rank": rank
                })

        browser.close()

    save_json(output_file, rankings)

    return rankings