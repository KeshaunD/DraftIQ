# DraftIQ — Fantasy Draft HUD

DraftIQ is a movable Chrome extension overlay for live fantasy-football draft rooms. It combines consensus rankings, projections, ADP, player profiles, live Yahoo pick detection, roster-aware recommendations, and mock-draft history.

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
- Configurable league size, draft slot, scoring, starting lineup, flex, and bench.
- Snake-draft timing with next-pick availability awareness.
- Tier-drop warnings and roster-aware recommendations.
- Live sync diagnostics with scan, pick, roster, and data status.
- Post-draft roster report with construction score, strengths, and watch items.
- Mock-draft history collection and export helpers.

The extension loads on ESPN, Yahoo, Sleeper, and NFL.com draft pages. Automatic draft-board parsing is currently optimized for Yahoo; the diagnostics drawer makes that limitation visible on other platforms.

## File map

- `manifest.json` — Manifest V3 configuration and content-script order.
- `data.js` — bundled player data used before remote data is available.
- `styles.js` — all Shadow DOM styling.
- `draftiq-core.js` — testable league, snake-draft, roster, tier, and availability calculations.
- `content.js` — interface, recommendations, league settings, diagnostics, profiles, and reports.
- `draft-sync.js` — live Yahoo draft-board and roster detection.
- `mock-history.js` — mock-draft history tracking.
- `background.js` — remote data refresh service worker.
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
