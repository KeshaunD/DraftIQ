import json
import re

from base_importer import BASE_DIR
from playwright.sync_api import sync_playwright

URL = "https://flockfantasy.com/rankings?format=BEST_BALL"
OUTPUT_FILE = BASE_DIR / "data" / "rankings" / "sources" / "flock.json"


def save_json(file_path, data):
    with open(file_path, "w", encoding="utf-8") as file:
        json.dump(data, file, indent=4)


def is_abbreviation(name):
    return bool(re.match(r"^[A-Z]\.\s+.+", name))


def main():
    rankings_by_rank = {}

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page()

        page.goto(URL, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(8000)

        spans = page.locator("span").all()

        for span in spans:
            text = span.inner_text().strip()
            match = re.match(r"^(\d+)\.\s+(.+)$", text)

            if not match:
                continue

            rank = int(match.group(1))
            name = match.group(2).strip()

            if rank not in rankings_by_rank:
                rankings_by_rank[rank] = name
                continue

            current_name = rankings_by_rank[rank]

            if is_abbreviation(current_name) and not is_abbreviation(name):
                rankings_by_rank[rank] = name

            elif len(name) > len(current_name):
                rankings_by_rank[rank] = name

        browser.close()

    rankings = [
        {
            "name": name,
            "rank": rank
        }
        for rank, name in rankings_by_rank.items()
    ]

    rankings.sort(key=lambda player: player["rank"])

    save_json(OUTPUT_FILE, rankings)

    print(f"Imported {len(rankings)} Flock rankings.")
    print(f"Saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()