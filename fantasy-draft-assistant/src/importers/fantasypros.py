from base_importer import BASE_DIR, scrape_table_rankings

URL = "https://www.fantasypros.com/nfl/rankings/ppr-cheatsheets.php"
OUTPUT_FILE = BASE_DIR / "data" / "rankings" / "sources" / "fantasypros.json"


def main():
    rankings = scrape_table_rankings(URL, OUTPUT_FILE)

    print(f"Imported {len(rankings)} FantasyPros rankings.")
    print(f"Saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()