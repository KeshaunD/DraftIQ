# Draft Copilot — Fantasy Draft HUD

A right-docked HUD that overlays fantasy draft rooms (ESPN, Yahoo, Sleeper, NFL.com)
with tiered rankings, search/position filters, and a vertical "value rail" showing
where every ranked player sits at a glance.

## Load it in Chrome

1. Go to `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this folder
5. Open a draft room page (e.g. `espn.com`, `sleeper.com`) — the HUD docks to the
   right edge automatically. Click the tab or the toolbar icon to show/hide it.

## What's real vs. placeholder right now

- **Real:** the shadow-DOM injection, layout, search, position filters, click-to-mark-drafted,
  collapse/expand (synced with the popup toggle), and the tier rail.
- **Placeholder:** `data.js` has 20 sample players. Swap `DRAFT_COPILOT_PLAYERS` for
  a live fetch from your rankings source (e.g. your master sheet exported as JSON,
  or a small backend) when you're ready to wire up real data.
- **Not built yet:** reading the actual draft board (who's already been picked,
  whose turn it is) from each site's DOM — that needs a per-site scraper since
  ESPN/Yahoo/Sleeper each render their draft room differently. Marking a player
  "drafted" is currently manual (click their card).

## File map

- `manifest.json` — Manifest V3 config, content script matches
- `data.js` — sample player rankings + position color tokens
- `styles.js` — HUD CSS (injected into the shadow root)
- `content.js` — builds and mounts the HUD on matching pages
- `popup.html` / `popup.js` — toolbar popup, toggles HUD visibility
- `background.js` — sets default storage values on install
