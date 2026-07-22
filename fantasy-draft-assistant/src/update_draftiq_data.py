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

        if ROTOWIRE_IMPORTER_PATH in missing_files:
            print()
            print("Create this file:")
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
            "src/build_consensus_rankings.py",
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
    print("Next steps:")
    print(
        "1. Run scripts\\refresh_draftiq.ps1"
    )
    print(
        "2. Wait for the GitHub push to finish"
    )
    print(
        "3. Click the refresh button inside DraftIQ"
    )
    print(
        "4. Open a player profile and check Latest Player News"
    )


if __name__ == "__main__":
    main()