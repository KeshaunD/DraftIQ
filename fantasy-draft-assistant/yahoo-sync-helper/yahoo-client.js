"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  normalizeLeagueList,
  normalizeLeagueSettings,
  normalizeRosterResponse,
  normalizeTeams,
} = require("./yahoo-normalize.js");

const YAHOO_AUTH_URL = "https://api.login.yahoo.com/oauth2/request_auth";
const YAHOO_TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token";
const YAHOO_FANTASY_API = "https://fantasysports.yahooapis.com/fantasy/v2";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;

      const separator = trimmed.indexOf("=");
      if (separator < 1) return;

      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!process.env[key]) process.env[key] = value;
    });
}

function errorFromResponse(status, body, fallback) {
  let detail = "";

  try {
    const parsed = JSON.parse(body);
    detail = parsed.error_description || parsed.error?.description || parsed.error;
  } catch (_error) {
    detail = body.slice(0, 300);
  }

  return new Error(`${fallback} (${status})${detail ? `: ${detail}` : ""}`);
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return results;
}

class YahooClient {
  constructor(options = {}) {
    const rootDir = options.rootDir || __dirname;
    this.envFile = options.envFile || path.join(rootDir, ".env");
    loadEnvFile(this.envFile);

    this.fetch = options.fetchImpl || globalThis.fetch;
    this.clientId = options.clientId || process.env.YAHOO_CLIENT_ID || "";
    this.clientSecret =
      options.clientSecret || process.env.YAHOO_CLIENT_SECRET || "";
    this.redirectUri = options.redirectUri || process.env.YAHOO_REDIRECT_URI || "oob";
    this.tokenFile =
      options.tokenFile || path.join(rootDir, ".yahoo-tokens.json");
  }

  isConfigured() {
    return Boolean(this.clientId && this.clientSecret);
  }

  configure(clientId, clientSecret) {
    const normalizedClientId = String(clientId || "").trim();
    const normalizedClientSecret = String(clientSecret || "").trim();

    if (!normalizedClientId || !normalizedClientSecret) {
      throw new Error("Both Yahoo Client ID and Client Secret are required.");
    }

    if (
      /[\r\n]/.test(normalizedClientId) ||
      /[\r\n]/.test(normalizedClientSecret)
    ) {
      throw new Error("Yahoo credentials contain invalid characters.");
    }

    this.clientId = normalizedClientId;
    this.clientSecret = normalizedClientSecret;
    fs.writeFileSync(
      this.envFile,
      [
        `YAHOO_CLIENT_ID=${normalizedClientId}`,
        `YAHOO_CLIENT_SECRET=${normalizedClientSecret}`,
        `YAHOO_REDIRECT_URI=${this.redirectUri}`,
        "DRAFTIQ_YAHOO_PORT=3210",
        "",
      ].join("\n"),
      "utf8"
    );
  }

  loadTokens() {
    if (!fs.existsSync(this.tokenFile)) return null;

    try {
      return JSON.parse(fs.readFileSync(this.tokenFile, "utf8"));
    } catch (_error) {
      return null;
    }
  }

  saveTokens(tokens) {
    fs.writeFileSync(this.tokenFile, JSON.stringify(tokens, null, 2), "utf8");
  }

  disconnect() {
    if (fs.existsSync(this.tokenFile)) fs.unlinkSync(this.tokenFile);
  }

  getAuthUrl() {
    if (!this.isConfigured()) {
      throw new Error("Yahoo client ID and secret are not configured.");
    }

    const url = new URL(YAHOO_AUTH_URL);
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set("redirect_uri", this.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("language", "en-us");
    return url.toString();
  }

  async requestTokens(parameters) {
    if (!this.isConfigured()) {
      throw new Error("Yahoo client ID and secret are not configured.");
    }

    const response = await this.fetch(YAHOO_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${this.clientId}:${this.clientSecret}`
        ).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(parameters).toString(),
    });
    const body = await response.text();

    if (!response.ok) {
      throw errorFromResponse(response.status, body, "Yahoo authorization failed");
    }

    const tokenResponse = JSON.parse(body);
    const existing = this.loadTokens() || {};
    const tokens = {
      ...existing,
      ...tokenResponse,
      refresh_token: tokenResponse.refresh_token || existing.refresh_token,
      expiresAt:
        Date.now() + Math.max(60, Number(tokenResponse.expires_in || 3600)) * 1000,
      updatedAt: new Date().toISOString(),
    };

    this.saveTokens(tokens);
    return tokens;
  }

  exchangeCode(code) {
    const normalizedCode = String(code || "").trim();
    if (!normalizedCode) throw new Error("Enter the authorization code from Yahoo.");

    return this.requestTokens({
      redirect_uri: this.redirectUri,
      code: normalizedCode,
      grant_type: "authorization_code",
    });
  }

  refreshTokens(refreshToken) {
    return this.requestTokens({
      redirect_uri: this.redirectUri,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
  }

  async getAccessToken() {
    const tokens = this.loadTokens();

    if (!tokens?.access_token) {
      throw new Error("Yahoo is not connected yet.");
    }

    if (Number(tokens.expiresAt || 0) > Date.now() + 60000) {
      return tokens.access_token;
    }

    if (!tokens.refresh_token) {
      throw new Error("Yahoo authorization expired. Connect Yahoo again.");
    }

    const refreshed = await this.refreshTokens(tokens.refresh_token);
    return refreshed.access_token;
  }

  status() {
    const tokens = this.loadTokens();
    return {
      configured: this.isConfigured(),
      connected: Boolean(tokens?.access_token || tokens?.refresh_token),
      expiresAt: tokens?.expiresAt || null,
      updatedAt: tokens?.updatedAt || null,
    };
  }

  async apiGet(apiPath) {
    const accessToken = await this.getAccessToken();
    const separator = apiPath.includes("?") ? "&" : "?";
    const response = await this.fetch(
      `${YAHOO_FANTASY_API}${apiPath}${separator}format=json`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      }
    );
    const body = await response.text();

    if (response.status === 401 && this.loadTokens()?.refresh_token) {
      const refreshed = await this.refreshTokens(this.loadTokens().refresh_token);
      const retry = await this.fetch(
        `${YAHOO_FANTASY_API}${apiPath}${separator}format=json`,
        {
          headers: { Authorization: `Bearer ${refreshed.access_token}` },
          cache: "no-store",
        }
      );
      const retryBody = await retry.text();

      if (!retry.ok) {
        throw errorFromResponse(retry.status, retryBody, "Yahoo Fantasy API failed");
      }

      return JSON.parse(retryBody);
    }

    if (!response.ok) {
      throw errorFromResponse(response.status, body, "Yahoo Fantasy API failed");
    }

    return JSON.parse(body);
  }

  async listLeagues() {
    const data = await this.apiGet(
      "/users;use_login=1/games;game_codes=nfl/leagues"
    );
    return normalizeLeagueList(data);
  }

  async syncLeague(leagueKey) {
    const normalizedKey = String(leagueKey || "").trim();

    if (!/^[A-Za-z0-9]+\.l\.\d+$/.test(normalizedKey)) {
      throw new Error("Yahoo league key is invalid.");
    }

    const encodedKey = encodeURIComponent(normalizedKey);
    const [metadataData, settingsData, teamsData, standingsResult] =
      await Promise.all([
        this.apiGet(`/league/${encodedKey}`),
        this.apiGet(`/league/${encodedKey}/settings`),
        this.apiGet(`/league/${encodedKey}/teams`),
        this.apiGet(`/league/${encodedKey}/standings`).catch(() => null),
      ]);
    const league = normalizeLeagueList(metadataData)[0] || {
      key: normalizedKey,
      name: "Yahoo League",
    };
    const teamList = normalizeTeams(teamsData);
    const standings = standingsResult ? normalizeTeams(standingsResult) : [];
    const standingByTeam = new Map(standings.map((team) => [team.key, team]));
    const rosterResults = await mapWithConcurrency(
      teamList,
      4,
      async (team) => {
        const standing = standingByTeam.get(team.key) || {};
        const teamWithStanding = { ...team, ...standing, key: team.key };

        try {
          const rosterData = await this.apiGet(
            `/team/${encodeURIComponent(team.key)}/roster/players`
          );
          return normalizeRosterResponse(rosterData, teamWithStanding);
        } catch (error) {
          return {
            ...teamWithStanding,
            players: [],
            syncError: error instanceof Error ? error.message : String(error),
          };
        }
      }
    );
    const currentTeam = rosterResults.find((team) => team.isCurrentUser) || null;
    const normalizedSettings = normalizeLeagueSettings({
      metadataData,
      settingsData,
    });

    if (currentTeam?.draftPosition) {
      normalizedSettings.settings.draftSlot = currentTeam.draftPosition;
    }

    return {
      version: 1,
      source: "yahoo-api",
      syncedAt: new Date().toISOString(),
      league,
      settings: normalizedSettings.settings,
      yahooRosterPositions: normalizedSettings.rosterPositions,
      receptionModifier: normalizedSettings.receptionModifier,
      currentTeamKey: currentTeam?.key || null,
      teams: rosterResults,
      rosterErrors: rosterResults
        .filter((team) => team.syncError)
        .map((team) => ({ key: team.key, name: team.name, error: team.syncError })),
    };
  }
}

module.exports = {
  YahooClient,
  loadEnvFile,
};
