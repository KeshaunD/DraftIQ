from pathlib import Path

from base_importer import BASE_DIR, scrape_table_rankings

URL = "https://fantasydata.com/nfl/adp"
OUTPUT_FILE = BASE_DIR / "data" / "rankings" / "sources" / "fantasydata.json"


def main():
    rankings = scrape_table_rankings(URL, OUTPUT_FILE)

    print(f"Imported {len(rankings)} FantasyData rankings.")
    print(f"Saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()