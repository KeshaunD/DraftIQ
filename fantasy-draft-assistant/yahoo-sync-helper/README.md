# DraftIQ Yahoo League Sync Helper

This local, read-only helper keeps Yahoo credentials and OAuth tokens out of the Chrome extension. It uses only Node.js built-ins and listens on `127.0.0.1:3210`.

## One-time setup

1. Create an **Installed Application** at [Yahoo Developer Network](https://developer.yahoo.com/apps/create/).
2. Enable **Fantasy Sports: Read** permission. Do not select Read/Write.
3. Run `native-host/install.ps1` once if you want Chrome to launch the helper for an already linked league.
4. For first-time setup, run `../Start DraftIQ Yahoo Sync.cmd`.
5. Open `http://127.0.0.1:3210/connect`.
6. Enter the Yahoo Client ID and Client Secret on the private local setup page, then authorize Yahoo.

The helper stores the credentials in `.env` and the OAuth token in `.yahoo-tokens.json` on this computer. Both files are excluded from Git.

Live Yahoo draft-room pick tracking does not require this helper.

## Tests

```powershell
npm test
```
