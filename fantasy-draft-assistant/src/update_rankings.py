import subprocess
import sys
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SCRIPTS = [
    "src/importers/fantasypros.py",
    "src/importers/draftsharks.py",
    "src/importers/fantasydata.py",
    "src/importers/flock.py",
    "src/build_consensus_rankings.py",
    "src/build_rankings.py",
]


def run_script(script):
    print(f"\nRunning {script}...")
    result = subprocess.run(
        [sys.executable, script],
        cwd=BASE_DIR,
        text=True
    )

    if result.returncode != 0:
        raise RuntimeError(f"{script} failed.")


def main():
    start = time.time()

    for script in SCRIPTS:
        run_script(script)

    elapsed = round(time.time() - start, 2)

    print("\n==============================")
    print("DraftIQ Update Complete")
    print("==============================")
    print(f"Completed in {elapsed} seconds.")


if __name__ == "__main__":
    main()