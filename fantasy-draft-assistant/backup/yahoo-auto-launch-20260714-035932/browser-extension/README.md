# DraftIQ — Fantasy Draft HUD

DraftIQ is a movable Chrome extension overlay for live fantasy-football draft rooms. It combines consensus rankings, projections, ADP, player profiles, live Yahoo/ESPN/Sleeper pick detection, roster-aware recommendations, and mock-draft history.

## Load it in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select the `browser-extension` folder.
5. Open a supported fantasy draft room.

After changing extension files, click **Reload** on DraftIQ and refresh the draft page.

## Current capabilities

- Searchable and filterable consensus player rankings.
- Combined projection and ADP data with remote refresh support.
- Player profiles, projections, schedule strength, and recent-game charts.
- Automatic Yahoo drafted-player and “Your Team” detection.
- Private, read-only Yahoo league import for league rules, every team, and current rosters through the local Yahoo sync helper.
- Automatic ESPN draft-board, pick-history, and roster detection.
- Automatic Sleeper pick and roster sync through Sleeper's read-only draft API, with page scanning as a fallback.
- Configurable league size, draft slot, scoring, starting lineup, flex, and bench.
- Snake-draft timing with next-pick availability awareness.
- Tier-drop warnings and roster-aware recommendations.
- Live sync diagnostics with scan, pick, roster, and data status.
- Post-draft roster report with construction score, strengths, and watch items.
- Mock-draft history collection and export helpers.

The extension loads on ESPN, Yahoo, Sleeper, and NFL.com draft pages. Yahoo, ESPN, and Sleeper have live sync adapters. NFL.com currently receives the overlay and rankings without automatic pick detection.

For Sleeper, set **Your draft slot** correctly in League settings. DraftIQ uses the official draft's slot-to-roster mapping so traded picks are assigned to the right roster.

## Connect a Yahoo league

Yahoo private-league data requires account authorization, so DraftIQ keeps the Yahoo Client Secret and OAuth token in the local `yahoo-sync-helper` instead of embedding them in Chrome.

1. Follow `../yahoo-sync-helper/README.md` for the one-time Yahoo Developer setup.
2. Double-click `../Start DraftIQ Yahoo Sync.cmd` and keep that window open while syncing.
3. Reload DraftIQ in Chrome.
4. Open **League settings**, click **Connect Yahoo**, and complete the read-only authorization.
5. Return to DraftIQ, click **Check connection**, choose your league, and click **Sync league**.

DraftIQ imports Yahoo settings and all current rosters. The existing Yahoo page adapter remains responsible for immediate live-pick updates during the draft.

## File map

- `manifest.json` — Manifest V3 configuration and content-script order.
- `data.js` — bundled player data used before remote data is available.
- `styles.js` — all Shadow DOM styling.
- `draftiq-core.js` — testable league, snake-draft, roster, tier, and availability calculations.
- `draft-sync-core.js` — testable platform detection, draft IDs, player-card parsing, and Sleeper pick mapping.
- `content.js` — interface, recommendations, league settings, diagnostics, profiles, and reports.
- `draft-sync.js` — Yahoo, ESPN, and Sleeper live-pick and roster adapters.
- `mock-history.js` — mock-draft history tracking.
- `background.js` — remote data refresh and Sleeper read-only API service worker.
- `../yahoo-sync-helper/` — local Yahoo authorization, league API client, normalization, and secure token storage.
- `popup.html` / `popup.js` — toolbar visibility control.

## Run extension tests

From the `browser-extension` folder:

```powershell
npm test
```

Or without npm:

```powershell
node --test tests/*.test.js
```
