from base_importer import BASE_DIR, scrape_table_rankings

URL = URL = URL = "https://www.4for4.com/adp"
OUTPUT_FILE = BASE_DIR / "data" / "rankings" / "sources" / "fourforfour.json"


def main():
    rankings = scrape_table_rankings(
        url=URL,
        output_file=OUTPUT_FILE,
        wait_ms=8000,
        player_link_selector="a[href*='/player/']"
    )

    print(f"Imported {len(rankings)} 4for4 rankings.")
    print(f"Saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()