"use strict";

const http = require("node:http");
const path = require("node:path");
const { YahooClient, loadEnvFile } = require("./yahoo-client.js");

const HOST = "127.0.0.1";
const DEFAULT_PORT = 3210;

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function page(title, content) {
  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(title)} · DraftIQ</title>
      <style>
        :root { color-scheme: dark; font-family: Inter, system-ui, sans-serif; }
        * { box-sizing: border-box; }
        body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 28px; background: #080d11; color: #f5f7fa; }
        main { width: min(560px, 100%); padding: 28px; border: 1px solid #293740; border-radius: 16px; background: #10181e; box-shadow: 0 24px 70px rgba(0,0,0,.36); }
        .brand { margin-bottom: 22px; font-size: 24px; font-weight: 900; } .brand span { color: #f3b83f; }
        h1 { margin: 0 0 10px; font-size: 22px; } p { color: #a7b0b6; line-height: 1.55; }
        .notice { margin: 16px 0; padding: 12px 14px; border: 1px solid #2a3841; border-radius: 10px; background: #0b1217; color: #c8d0d4; font-size: 13px; }
        .success { border-color: rgba(53,216,154,.42); color: #78e4bb; }
        .error { border-color: rgba(255,101,101,.4); color: #ff9b9b; }
        a.button, button { width: 100%; min-height: 42px; display: inline-flex; align-items: center; justify-content: center; margin-top: 10px; border: 1px solid #f3b83f; border-radius: 9px; background: linear-gradient(#f7c75b,#ebae31); color: #121619; font: inherit; font-weight: 800; text-decoration: none; cursor: pointer; }
        label { display: block; margin-top: 18px; color: #c8d0d4; font-size: 12px; font-weight: 800; }
        input { width: 100%; height: 42px; margin-top: 7px; padding: 0 11px; border: 1px solid #35454f; border-radius: 9px; background: #080d11; color: white; font: inherit; }
        a { color: #c6a9ff; } code { color: #f7ca62; } .small { font-size: 12px; }
      </style>
    </head>
    <body><main><div class="brand">Draft<span>IQ</span></div>${content}</main></body>
  </html>`;
}

function setCors(req, res) {
  const origin = req.headers.origin || "";

  if (origin.startsWith("chrome-extension://")) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function sendJson(req, res, status, payload) {
  setCors(req, res);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendHtml(res, status, html) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 100000) reject(new Error("Request body is too large."));
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function connectPage(client, message = "") {
  const status = client.status();

  if (!status.configured) {
    return page(
      "Set up Yahoo",
      `<h1>Set up Yahoo access</h1>
       <p>Create an Installed Application in the <a href="https://developer.yahoo.com/apps/create/" target="_blank" rel="noreferrer">Yahoo Developer Network</a> with Fantasy Sports <strong>Read</strong> permission, then enter its credentials here.</p>
       <div class="notice">Credentials and tokens remain on this computer and are never placed inside the Chrome extension.</div>
       ${message ? `<div class="notice error">${escapeHtml(message)}</div>` : ""}
       <form method="post" action="/setup">
         <label for="clientId">Yahoo Client ID</label>
         <input id="clientId" name="clientId" autocomplete="off" required />
         <label for="clientSecret">Yahoo Client Secret</label>
         <input id="clientSecret" name="clientSecret" type="password" autocomplete="off" required />
         <button type="submit">Save private Yahoo credentials</button>
       </form>`
    );
  }

  if (status.connected) {
    return page(
      "Yahoo connected",
      `<h1>Yahoo is connected</h1>
       <div class="notice success">DraftIQ can now use this read-only connection for private-league imports. Live draft-room pick tracking works independently.</div>
       <p class="small">This connection is read-only. DraftIQ cannot change lineups, waivers, trades, or league settings.</p>
       <form method="post" action="/disconnect"><button type="submit">Disconnect Yahoo</button></form>`
    );
  }

  return page(
    "Connect Yahoo",
    `<h1>Connect your Yahoo leagues</h1>
     <p>First authorize read-only access on Yahoo. Yahoo will display a short authorization code; copy it and paste it below.</p>
     ${message ? `<div class="notice error">${escapeHtml(message)}</div>` : ""}
     <a class="button" href="/auth/start" target="_blank" rel="noreferrer">1. Authorize with Yahoo</a>
     <form method="post" action="/oauth/complete">
       <label for="code">2. Yahoo authorization code</label>
       <input id="code" name="code" autocomplete="off" required />
       <button type="submit">Connect Yahoo to DraftIQ</button>
     </form>
     <p class="small">Your Yahoo password is never shared with DraftIQ.</p>`
  );
}

function createServer(options = {}) {
  const client = options.client || new YahooClient();

  return http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${HOST}`);

    if (req.method === "OPTIONS") {
      setCors(req, res);
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/connect")) {
        sendHtml(res, 200, connectPage(client));
        return;
      }

      if (req.method === "GET" && url.pathname === "/auth/start") {
        res.writeHead(302, { Location: client.getAuthUrl() });
        res.end();
        return;
      }

      if (req.method === "POST" && url.pathname === "/setup") {
        const form = new URLSearchParams(await readBody(req));

        try {
          client.configure(form.get("clientId"), form.get("clientSecret"));
          sendHtml(res, 200, connectPage(client));
        } catch (error) {
          sendHtml(
            res,
            400,
            connectPage(client, error instanceof Error ? error.message : String(error))
          );
        }
        return;
      }

      if (req.method === "POST" && url.pathname === "/oauth/complete") {
        const form = new URLSearchParams(await readBody(req));

        try {
          await client.exchangeCode(form.get("code"));
          sendHtml(res, 200, connectPage(client));
        } catch (error) {
          sendHtml(
            res,
            400,
            connectPage(client, error instanceof Error ? error.message : String(error))
          );
        }
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/status") {
        sendJson(req, res, 200, { ok: true, ...client.status() });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/leagues") {
        const leagues = await client.listLeagues();
        sendJson(req, res, 200, { ok: true, leagues });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/sync") {
        const snapshot = await client.syncLeague(url.searchParams.get("leagueKey"));
        sendJson(req, res, 200, { ok: true, snapshot });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/disconnect") {
        client.disconnect();
        sendJson(req, res, 200, { ok: true });
        return;
      }

      if (req.method === "POST" && url.pathname === "/disconnect") {
        client.disconnect();
        sendHtml(res, 200, connectPage(client));
        return;
      }

      sendJson(req, res, 404, { ok: false, error: "Not found." });
    } catch (error) {
      sendJson(req, res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

if (require.main === module) {
  loadEnvFile(path.join(__dirname, ".env"));
  const port = Number(process.env.DRAFTIQ_YAHOO_PORT || DEFAULT_PORT);
  const server = createServer();

  server.listen(port, HOST, () => {
    console.log(`DraftIQ Yahoo helper is running at http://${HOST}:${port}/connect`);
    console.log("Keep this window open while using Yahoo league sync.");
  });
}

module.exports = { createServer };
