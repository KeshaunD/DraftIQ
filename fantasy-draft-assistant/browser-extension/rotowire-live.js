(() => {
  const RSS_URL =
    "https://www.rotowire.com/rss/news.php?sport=NFL";

  const STORAGE_REMOTE_DATA =
    "draftCopilotRemoteData";

  const STORAGE_LAST_CHECK =
    "draftCopilotRotoWireLastCheck";

  function decode(value) {
    return String(value || "")
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
      .replace(/<[^>]+>/g, " ")
      .replace(/&#x([0-9a-f]+);/gi, (_match, value) =>
        String.fromCodePoint(
          Number.parseInt(value, 16)
        )
      )
      .replace(/&#(\d+);/g, (_match, value) =>
        String.fromCodePoint(
          Number.parseInt(value, 10)
        )
      )
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&apos;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/\s+/g, " ")
      .trim();
  }

  function readTag(xml, tagName) {
    const escaped = tagName.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    const paired = String(xml || "").match(
      new RegExp(
        `<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`,
        "i"
      )
    );

    if (paired) {
      return decode(paired[1]);
    }

    const linked = String(xml || "").match(
      new RegExp(
        `<${escaped}\\b[^>]*\\bhref=["']([^"']+)["'][^>]*\\/?>`,
        "i"
      )
    );

    return linked
      ? decode(linked[1])
      : "";
  }

  function normalizeName(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\./g, "")
      .replace(/['’]/g, "")
      .replace(/-/g, " ")
      .replace(
        /\b(jr|sr|ii|iii|iv|v)\b/g,
        " "
      )
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function safeUrl(value) {
    try {
      const parsed = new URL(
        String(value || "")
      );

      const allowedProtocol =
        parsed.protocol === "https:" ||
        parsed.protocol === "http:";

      const allowedHost =
        parsed.hostname === "rotowire.com" ||
        parsed.hostname.endsWith(
          ".rotowire.com"
        );

      return allowedProtocol && allowedHost
        ? parsed.href
        : null;
    } catch (_error) {
      return null;
    }
  }

  function timestamp(item) {
    const value = new Date(
      item?.publishedAt || 0
    ).getTime();

    return Number.isFinite(value)
      ? value
      : 0;
  }

  function parseFeed(xmlText) {
    const items =
      String(xmlText || "").match(
        /<item\b[\s\S]*?<\/item>/gi
      ) || [];

    return items
      .map((xml) => {
        const published =
          readTag(xml, "pubDate") ||
          readTag(xml, "published") ||
          readTag(xml, "updated");

        const date = new Date(published);

        return {
          headline:
            readTag(xml, "title"),

          summary:
            readTag(
              xml,
              "description"
            ),

          publishedAt:
            Number.isNaN(
              date.getTime()
            )
              ? null
              : date.toISOString(),

          url:
            safeUrl(
              readTag(xml, "link") ||
              readTag(xml, "guid")
            ),
        };
      })
      .filter(
        (item) => item.headline
      );
  }

  function buildPlayerLookup(players) {
    const lookup = new Map();

    players.forEach((player) => {
      const key =
        normalizeName(
          player?.name
        );

      if (
        key &&
        !lookup.has(key)
      ) {
        lookup.set(
          key,
          player
        );
      }
    });

    return lookup;
  }

  function matchPlayer(
    item,
    playerLookup,
    sortedNames
  ) {
    const separators = [
      ":",
      " — ",
      " – ",
      " - ",
    ];

    for (
      const separator of separators
    ) {
      if (
        !item.headline.includes(
          separator
        )
      ) {
        continue;
      }

      const prefix =
        normalizeName(
          item.headline.split(
            separator,
            1
          )[0]
        ).replace(
          /\s+(news|update|updates)$/,
          ""
        );

      if (
        playerLookup.has(prefix)
      ) {
        return playerLookup.get(
          prefix
        );
      }
    }

    const searchable =
      ` ${normalizeName(
        `${item.headline} ${item.summary}`
      )} `;

    for (
      const name of sortedNames
    ) {
      if (
        searchable.includes(
          ` ${name} `
        )
      ) {
        return playerLookup.get(
          name
        );
      }
    }

    return null;
  }

  function latestSavedNews(player) {
    const news =
      player?.news?.rotowire;

    if (!Array.isArray(news)) {
      return null;
    }

    return (
      news
        .filter(
          (item) =>
            item?.headline
        )
        .sort(
          (a, b) =>
            timestamp(b) -
            timestamp(a)
        )[0] ||
      null
    );
  }

  async function refresh() {
    const stored =
      await chrome.storage.local.get([
        STORAGE_REMOTE_DATA,
      ]);

    const remoteData =
      stored[
        STORAGE_REMOTE_DATA
      ];

    if (
      !Array.isArray(
        remoteData?.players
      )
    ) {
      throw new Error(
        "DraftIQ player data is not loaded yet."
      );
    }

    const response = await fetch(
      `${RSS_URL}&t=${Date.now()}`,
      {
        cache: "no-store",
        headers: {
          Accept:
            "application/rss+xml, application/xml, text/xml",
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `RotoWire NFL RSS returned ${response.status}.`
      );
    }

    const items = parseFeed(
      await response.text()
    );

    if (!items.length) {
      throw new Error(
        "RotoWire NFL RSS returned no readable items."
      );
    }

    const playerLookup =
      buildPlayerLookup(
        remoteData.players
      );

    const sortedNames =
      Array.from(
        playerLookup.keys()
      ).sort(
        (a, b) =>
          b.length - a.length
      );

    const newestByPlayer =
      new Map();

    items.forEach((item) => {
      const player =
        matchPlayer(
          item,
          playerLookup,
          sortedNames
        );

      if (!player) return;

      const key =
        normalizeName(
          player.name
        );

      const previous =
        newestByPlayer.get(key);

      if (
        !previous ||
        timestamp(item) >
          timestamp(previous)
      ) {
        newestByPlayer.set(
          key,
          item
        );
      }
    });

    let updatedPlayers = 0;

    const players =
      remoteData.players.map(
        (player) => {
          const saved =
            latestSavedNews(
              player
            );

          const fresh =
            newestByPlayer.get(
              normalizeName(
                player?.name
              )
            );

          const latest =
            fresh &&
            (
              !saved ||
              timestamp(fresh) >=
                timestamp(saved)
            )
              ? fresh
              : saved;

          if (!latest) {
            return player;
          }

          const oldIdentity =
            saved
              ? `${saved.headline}|${saved.url || ""}|${saved.publishedAt || ""}`
              : "";

          const newIdentity =
            `${latest.headline}|${latest.url || ""}|${latest.publishedAt || ""}`;

          if (
            oldIdentity !==
              newIdentity ||
            player?.news?.rotowire
              ?.length !== 1
          ) {
            updatedPlayers += 1;
          }

          return {
            ...player,

            news: {
              ...(
                player.news &&
                typeof player.news ===
                  "object"
                  ? player.news
                  : {}
              ),

              rotowire: [
                latest,
              ],
            },
          };
        }
      );

    const checkedAt =
      new Date().toISOString();

    await chrome.storage.local.set({
      [STORAGE_REMOTE_DATA]: {
        ...remoteData,
        players,
        rotowireCheckedAt:
          checkedAt,
      },

      [STORAGE_LAST_CHECK]:
        checkedAt,
    });

    return {
      checkedAt,
      feedItems:
        items.length,
      matchedPlayers:
        newestByPlayer.size,
      updatedPlayers,
    };
  }

  globalThis.DraftIQRotoWire = {
    refresh,
  };
})();