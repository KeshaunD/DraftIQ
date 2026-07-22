from base_importer import BASE_DIR, scrape_table_rankings

URL = "https://www.draftsharks.com/adp/ppr/sleeper/12"
OUTPUT_FILE = BASE_DIR / "data" / "rankings" / "sources" / "draftsharks.json"


def main():
    rankings = scrape_table_rankings(
        url=URL,
        output_file=OUTPUT_FILE,
        wait_ms=8000
    )

    print(f"Imported {len(rankings)} DraftSharks rankings.")
    print(f"Saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()