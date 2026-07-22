from base_importer import BASE_DIR, scrape_table_rankings

URL = "https://football.fantasysports.yahoo.com/f1/draftanalysis"
OUTPUT_FILE = BASE_DIR / "data" / "rankings" / "sources" / "yahoo.json"


def main():
    rankings = scrape_table_rankings(
        url=URL,
        output_file=OUTPUT_FILE,
        wait_ms=8000
    )

    print(f"Imported {len(rankings)} Yahoo rankings.")
    print(f"Saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()