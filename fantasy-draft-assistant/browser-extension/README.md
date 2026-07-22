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
- Automatic league-size, draft-slot, scoring, lineup, flex, and bench detection when the draft room exposes those values.
- Snake-draft timing with next-pick availability awareness.
- Tier-drop warnings and roster-aware recommendations.
- Live sync diagnostics with scan, pick, roster, and data status.
- Post-draft roster report with construction score, strengths, and watch items.
- Mock-draft history collection and export helpers.
- Live personal ADP trends that blend matching mock-draft outcomes into player availability odds after every recorded pick.

The extension loads on ESPN, Yahoo, Sleeper, and NFL.com draft pages. Yahoo, ESPN, and Sleeper have live sync adapters. NFL.com currently receives the overlay and rankings without automatic pick detection.

For Sleeper, DraftIQ uses the official draft's slot-to-roster mapping so traded picks are assigned to the correct roster.

## Yahoo draft sync

Live Yahoo draft-room sync is automatic and does not require the private league helper. DraftIQ reads the open draft room to track picks, your roster, league size, and draft position.

The optional `../yahoo-sync-helper/` supports read-only private-league imports without placing Yahoo credentials inside Chrome. See its README if you use that separate connector. `../Start DraftIQ Yahoo Sync.cmd` starts it manually.

## File map

- `manifest.json` — Manifest V3 configuration and content-script order.
- `data.js` — bundled player data used before remote data is available.
- `styles.js` — all Shadow DOM styling.
- `draftiq-core.js` — testable league, snake-draft, roster, tier, and availability calculations.
- `draft-sync-core.js` — testable platform detection, draft IDs, player-card parsing, and Sleeper pick mapping.
- `content.js` — interface, recommendations, diagnostics, profiles, and reports.
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
