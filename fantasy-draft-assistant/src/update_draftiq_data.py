import subprocess
import sys
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent

ESPN_ADP_PATH = (
    BASE_DIR
    / "data"
    / "espn"
    / "espn_adp_2026.json"
)

ESPN_PROJECTIONS_PATH = (
    BASE_DIR
    / "data"
    / "espn"
    / "espn_projections_2026.json"
)

RANKINGS_UPDATER_PATH = (
    BASE_DIR
    / "src"
    / "update_rankings.py"
)

ROTOWIRE_IMPORTER_PATH = (
    BASE_DIR
    / "src"
    / "importers"
    / "rotowire.py"
)


def run_command(command):
    print()
    print("=" * 70)
    print(f"Running: {' '.join(command)}")
    print("=" * 70)

    result = subprocess.run(
        command,
        cwd=BASE_DIR,
        text=True,
    )

    if result.returncode != 0:
        print()
        print(f"Command failed: {' '.join(command)}")
        sys.exit(result.returncode)


def check_required_files():
    print()
    print("=" * 70)
    print("Checking required files")
    print("=" * 70)

    missing_files = []

    if not ESPN_ADP_PATH.exists():
        missing_files.append(ESPN_ADP_PATH)

    if not ESPN_PROJECTIONS_PATH.exists():
        missing_files.append(ESPN_PROJECTIONS_PATH)

    if not RANKINGS_UPDATER_PATH.exists():
        missing_files.append(RANKINGS_UPDATER_PATH)

    if not ROTOWIRE_IMPORTER_PATH.exists():
        missing_files.append(ROTOWIRE_IMPORTER_PATH)

    if missing_files:
        print("Missing required files:")

        for file_path in missing_files:
            print(f"- {file_path}")

        if (
            ESPN_ADP_PATH in missing_files
            or ESPN_PROJECTIONS_PATH in missing_files
        ):
            print()
            print("Run this first:")
            print(
                "node scripts\\fetch_espn_playercard_data.js"
            )

        if RANKINGS_UPDATER_PATH in missing_files:
            print()
            print("Missing rankings updater:")
            print(
                "src\\update_rankings.py"
            )

        if ROTOWIRE_IMPORTER_PATH in missing_files:
            print()
            print("Missing RotoWire importer:")
            print(
                "src\\importers\\rotowire.py"
            )

        sys.exit(1)

    print(f"Found ESPN ADP: {ESPN_ADP_PATH}")
    print(
        f"Found ESPN projections: "
        f"{ESPN_PROJECTIONS_PATH}"
    )
    print(
        f"Found rankings updater: "
        f"{RANKINGS_UPDATER_PATH}"
    )
    print(
        f"Found RotoWire importer: "
        f"{ROTOWIRE_IMPORTER_PATH}"
    )


def main():
    league_name = (
        sys.argv[1]
        if len(sys.argv) > 1
        else "plantation"
    )

    season = (
        sys.argv[2]
        if len(sys.argv) > 2
        else "2026"
    )

    print()
    print("DraftIQ Data Update")
    print("-------------------")
    print(f"League: {league_name}")
    print(f"Season: {season}")

    python_cmd = sys.executable

    check_required_files()

    run_command(
        [
            python_cmd,
            "src/update_rankings.py",
        ]
    )

    run_command(
        [
            python_cmd,
            "src/export_extension_data.py",
            league_name,
            season,
        ]
    )

    run_command(
        [
            python_cmd,
            "src/importers/rotowire.py",
            season,
        ]
    )

    print()
    print("=" * 70)
    print("DraftIQ update complete.")
    print("=" * 70)

    print()
    print("Updated:")
    print("- FantasyPros rankings")
    print("- DraftSharks rankings")
    print("- FantasyData rankings")
    print("- Flock rankings")
    print("- Equal-weight consensus rankings")
    print("- League rankings")
    print("- Extension data")
    print("- RotoWire player news")

    print()
    print("Next steps:")
    print(
        "1. Wait for scripts\\refresh_draftiq.ps1 "
        "to finish"
    )
    print(
        "2. Confirm the GitHub push completed"
    )
    print(
        "3. Click the refresh button inside DraftIQ"
    )
    print(
        "4. Verify rankings and player news"
    )


if __name__ == "__main__":
    main()