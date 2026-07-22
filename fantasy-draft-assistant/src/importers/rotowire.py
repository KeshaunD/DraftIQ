from __future__ import annotations

import argparse
import html
import json
import re
import sys
import unicodedata
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parents[2]

FEED_URL = "https://www.rotowire.com/rss/news.php?sport=NFL"
DEFAULT_MAX_NEWS = 3
USER_AGENT = "DraftIQ/1.0 (personal fantasy draft assistant)"

HTML_TAG_RE = re.compile(r"<[^>]+>")
WHITESPACE_RE = re.compile(r"\s+")
SUFFIX_RE = re.compile(
    r"\b(jr|sr|ii|iii|iv|v)\b",
    re.IGNORECASE,
)

TITLE_SEPARATORS = (
    ":",
    " — ",
    " – ",
    " - ",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Fetch RotoWire NFL RSS news and attach it "
            "to DraftIQ players."
        )
    )

    parser.add_argument(
        "season",
        nargs="?",
        default="2026",
    )

    parser.add_argument(
        "--input",
        dest="input_path",
        type=Path,
        help=(
            "DraftIQ JSON to enrich. Defaults to "
            "hosted/draftiq-data-SEASON.json."
        ),
    )

    parser.add_argument(
        "--output",
        dest="output_path",
        type=Path,
        help=(
            "Output JSON path. Defaults to overwriting "
            "the input file."
        ),
    )

    parser.add_argument(
        "--cache",
        dest="cache_path",
        type=Path,
        help=(
            "News cache path. Defaults to "
            "data/rotowire/rotowire_news_SEASON.json."
        ),
    )

    parser.add_argument(
        "--max-per-player",
        type=int,
        default=DEFAULT_MAX_NEWS,
        help="Maximum saved RotoWire updates per player.",
    )

    return parser.parse_args()


def normalize_name(value: Any) -> str:
    text = unicodedata.normalize(
        "NFKD",
        str(value or ""),
    )

    text = (
        text.encode("ascii", "ignore")
        .decode("ascii")
        .lower()
        .replace("’", "'")
    )

    text = SUFFIX_RE.sub(" ", text)
    text = re.sub(r"[^a-z0-9\s]", " ", text)

    return WHITESPACE_RE.sub(
        " ",
        text,
    ).strip()


def clean_text(
    value: Any,
    maximum_length: int | None = None,
) -> str:
    text = html.unescape(
        str(value or "")
    )

    text = HTML_TAG_RE.sub(
        " ",
        text,
    )

    text = WHITESPACE_RE.sub(
        " ",
        text,
    ).strip()

    if (
        maximum_length
        and len(text) > maximum_length
    ):
        text = (
            text[: maximum_length - 1]
            .rstrip()
            + "…"
        )

    return text


def local_tag(tag: str) -> str:
    return tag.rsplit(
        "}",
        1,
    )[-1].lower()


def element_text(
    element: ET.Element,
    *names: str,
) -> str:
    wanted = {
        name.lower()
        for name in names
    }

    for child in element.iter():
        if local_tag(child.tag) not in wanted:
            continue

        text = "".join(
            child.itertext()
        ).strip()

        if text:
            return text

        href = child.attrib.get("href")

        if href:
            return href.strip()

    return ""


def normalize_published_at(
    value: str,
) -> str | None:
    raw = str(
        value or ""
    ).strip()

    if not raw:
        return None

    parsed: datetime | None = None

    try:
        parsed = parsedate_to_datetime(
            raw
        )
    except (
        TypeError,
        ValueError,
        OverflowError,
    ):
        parsed = None

    if parsed is None:
        try:
            parsed = datetime.fromisoformat(
                raw.replace(
                    "Z",
                    "+00:00",
                )
            )
        except ValueError:
            return None

    if parsed.tzinfo is None:
        parsed = parsed.replace(
            tzinfo=timezone.utc
        )

    return (
        parsed.astimezone(timezone.utc)
        .isoformat()
        .replace(
            "+00:00",
            "Z",
        )
    )


def validate_rotowire_url(
    value: str,
) -> str | None:
    url = str(
        value or ""
    ).strip()

    if not url:
        return None

    is_rotowire_url = re.match(
        (
            r"^https?://"
            r"(?:www\.)?"
            r"rotowire\.com"
            r"(?:/|$)"
        ),
        url,
        re.IGNORECASE,
    )

    if not is_rotowire_url:
        return None

    return url


def fetch_feed(
    url: str = FEED_URL,
) -> bytes:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": (
                "application/rss+xml, "
                "application/xml, "
                "text/xml;q=0.9, "
                "*/*;q=0.5"
            ),
        },
    )

    with urllib.request.urlopen(
        request,
        timeout=30,
    ) as response:
        return response.read()


def parse_feed(
    xml_bytes: bytes,
) -> list[dict[str, Any]]:
    root = ET.fromstring(
        xml_bytes
    )

    entries = [
        element
        for element in root.iter()
        if local_tag(element.tag)
        in {
            "item",
            "entry",
        }
    ]

    parsed_items: list[
        dict[str, Any]
    ] = []

    for entry in entries:
        title = clean_text(
            element_text(
                entry,
                "title",
            )
        )

        summary = clean_text(
            element_text(
                entry,
                "description",
                "summary",
                "content",
                "encoded",
            ),
            maximum_length=600,
        )

        url = validate_rotowire_url(
            element_text(
                entry,
                "link",
                "guid",
            )
        )

        published_at = (
            normalize_published_at(
                element_text(
                    entry,
                    "pubdate",
                    "published",
                    "updated",
                    "date",
                )
            )
        )

        if not title:
            continue

        parsed_items.append(
            {
                "title": title,
                "summary": summary,
                "url": url,
                "publishedAt": published_at,
            }
        )

    return parsed_items


def load_json(
    path: Path,
) -> Any:
    with path.open(
        "r",
        encoding="utf-8",
    ) as file:
        return json.load(file)


def save_json(
    path: Path,
    payload: Any,
) -> None:
    path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with path.open(
        "w",
        encoding="utf-8",
        newline="\n",
    ) as file:
        json.dump(
            payload,
            file,
            indent=2,
            ensure_ascii=False,
        )

        file.write("\n")


def get_players(
    payload: Any,
) -> list[dict[str, Any]]:
    if (
        isinstance(payload, dict)
        and isinstance(
            payload.get("players"),
            list,
        )
    ):
        return payload["players"]

    if isinstance(payload, list):
        return payload

    raise ValueError(
        (
            "DraftIQ JSON must be a player list "
            "or contain a 'players' list."
        )
    )


def split_player_prefix(
    title: str,
) -> tuple[str, str]:
    for separator in TITLE_SEPARATORS:
        if separator not in title:
            continue

        prefix, headline = title.split(
            separator,
            1,
        )

        if (
            prefix.strip()
            and headline.strip()
        ):
            return (
                prefix.strip(),
                headline.strip(),
            )

    return (
        "",
        title.strip(),
    )


def match_feed_item(
    item: dict[str, Any],
    player_lookup: dict[
        str,
        list[dict[str, Any]],
    ],
    sorted_names: list[str],
) -> tuple[
    str,
    dict[str, Any],
] | None:
    title = item["title"]

    prefix, headline = (
        split_player_prefix(
            title
        )
    )

    normalized_prefix = (
        normalize_name(
            prefix
        )
    )

    matched_name: str | None = None

    prefix_candidates = {
        normalized_prefix,
        re.sub(
            (
                r"\s+"
                r"(?:news|update|updates)"
                r"$"
            ),
            "",
            normalized_prefix,
        ).strip(),
    }

    for candidate in prefix_candidates:
        if candidate in player_lookup:
            matched_name = candidate
            break
    else:
        searchable = (
            " "
            + normalize_name(
                title
                + " "
                + item.get(
                    "summary",
                    "",
                )
            )
            + " "
        )

        for normalized_name in sorted_names:
            if (
                f" {normalized_name} "
                in searchable
            ):
                matched_name = (
                    normalized_name
                )
                break

    if not matched_name:
        return None

    cleaned_prefix = re.sub(
        (
            r"\s+"
            r"(?:news|update|updates)"
            r"$"
        ),
        "",
        normalize_name(prefix),
    ).strip()

    if cleaned_prefix != matched_name:
        headline = title

    news_item = {
        "headline": clean_text(
            headline,
            maximum_length=180,
        ),
        "summary": clean_text(
            item.get("summary"),
            maximum_length=500,
        ),
        "publishedAt": item.get(
            "publishedAt"
        ),
        "url": item.get("url"),
    }

    return (
        matched_name,
        news_item,
    )


def news_identity(
    item: dict[str, Any],
) -> str:
    url = str(
        item.get("url") or ""
    ).strip().lower()

    if url:
        return url

    return "|".join(
        [
            normalize_name(
                item.get(
                    "headline"
                )
            ),
            str(
                item.get(
                    "publishedAt"
                )
                or ""
            ),
        ]
    )


def news_timestamp(
    item: dict[str, Any],
) -> float:
    value = item.get(
        "publishedAt"
    )

    if not value:
        return 0.0

    try:
        return datetime.fromisoformat(
            str(value).replace(
                "Z",
                "+00:00",
            )
        ).timestamp()
    except ValueError:
        return 0.0


def merge_news(
    *collections: Any,
    maximum: int,
) -> list[dict[str, Any]]:
    merged: list[
        dict[str, Any]
    ] = []

    seen: set[str] = set()

    for collection in collections:
        if not isinstance(
            collection,
            list,
        ):
            continue

        for item in collection:
            if not isinstance(
                item,
                dict,
            ):
                continue

            headline = clean_text(
                (
                    item.get(
                        "headline"
                    )
                    or item.get(
                        "title"
                    )
                ),
                maximum_length=180,
            )

            if not headline:
                continue

            normalized_item = {
                "headline": headline,

                "summary": clean_text(
                    (
                        item.get(
                            "summary"
                        )
                        or item.get(
                            "description"
                        )
                        or item.get(
                            "excerpt"
                        )
                    ),
                    maximum_length=500,
                ),

                "publishedAt": (
                    normalize_published_at(
                        str(
                            item.get(
                                "publishedAt"
                            )
                            or item.get(
                                "pubDate"
                            )
                            or item.get(
                                "date"
                            )
                            or ""
                        )
                    )
                ),

                "url": (
                    validate_rotowire_url(
                        str(
                            item.get(
                                "url"
                            )
                            or item.get(
                                "link"
                            )
                            or ""
                        )
                    )
                ),
            }

            identity = news_identity(
                normalized_item
            )

            if (
                not identity
                or identity in seen
            ):
                continue

            seen.add(identity)
            merged.append(
                normalized_item
            )

    merged.sort(
        key=news_timestamp,
        reverse=True,
    )

    return merged[:maximum]


def load_cache(
    path: Path,
) -> dict[
    str,
    list[dict[str, Any]],
]:
    if not path.exists():
        return {}

    try:
        payload = load_json(
            path
        )
    except (
        OSError,
        json.JSONDecodeError,
    ):
        return {}

    if not isinstance(
        payload,
        dict,
    ):
        return {}

    players = payload.get(
        "players",
        payload,
    )

    return (
        players
        if isinstance(
            players,
            dict,
        )
        else {}
    )


def build_player_lookup(
    players: list[
        dict[str, Any]
    ],
) -> dict[
    str,
    list[dict[str, Any]],
]:
    lookup: dict[
        str,
        list[dict[str, Any]],
    ] = {}

    for player in players:
        normalized = normalize_name(
            player.get("name")
        )

        if normalized:
            lookup.setdefault(
                normalized,
                [],
            ).append(player)

    return lookup


def main() -> int:
    args = parse_args()

    maximum = max(
        1,
        min(
            args.max_per_player,
            10,
        ),
    )

    input_path = (
        args.input_path
        or BASE_DIR
        / "hosted"
        / (
            f"draftiq-data-"
            f"{args.season}.json"
        )
    )

    output_path = (
        args.output_path
        or input_path
    )

    cache_path = (
        args.cache_path
        or BASE_DIR
        / "data"
        / "rotowire"
        / (
            f"rotowire_news_"
            f"{args.season}.json"
        )
    )

    if not input_path.exists():
        print(
            (
                "RotoWire importer could not "
                "find DraftIQ JSON: "
                f"{input_path}"
            )
        )

        return 1

    payload = load_json(
        input_path
    )

    players = get_players(
        payload
    )

    player_lookup = (
        build_player_lookup(
            players
        )
    )

    sorted_names = sorted(
        player_lookup,
        key=len,
        reverse=True,
    )

    cached_news = load_cache(
        cache_path
    )

    fresh_news: dict[
        str,
        list[dict[str, Any]],
    ] = {}

    feed_status = "live"

    try:
        feed_items = parse_feed(
            fetch_feed()
        )

        if not feed_items:
            raise ValueError(
                (
                    "RotoWire RSS returned "
                    "no readable items."
                )
            )

        for item in feed_items:
            match = match_feed_item(
                item,
                player_lookup,
                sorted_names,
            )

            if not match:
                continue

            normalized_name, news_item = (
                match
            )

            fresh_news.setdefault(
                normalized_name,
                [],
            ).append(
                news_item
            )

        if (
            not fresh_news
            and not cached_news
        ):
            raise ValueError(
                (
                    "No RotoWire RSS items "
                    "matched DraftIQ players."
                )
            )

        print(
            (
                f"Fetched {len(feed_items)} "
                "RotoWire NFL RSS items."
            )
        )

    except (
        urllib.error.URLError,
        TimeoutError,
        ET.ParseError,
        OSError,
        ValueError,
    ) as error:
        if not cached_news:
            print(
                (
                    "RotoWire RSS fetch failed "
                    "and no cache is available: "
                    f"{error}"
                )
            )

            return 1

        feed_status = "cache"

        print(
            (
                "RotoWire RSS fetch failed; "
                "using cached news instead: "
                f"{error}"
            )
        )

    merged_cache: dict[
        str,
        list[dict[str, Any]],
    ] = {}

    for normalized_name in player_lookup:
        existing_cache = (
            cached_news.get(
                normalized_name,
                [],
            )
        )

        merged = merge_news(
            fresh_news.get(
                normalized_name,
                [],
            ),
            existing_cache,
            maximum=maximum,
        )

        if merged:
            merged_cache[
                normalized_name
            ] = merged

    attached_players = 0
    attached_items = 0

    for player in players:
        normalized_name = (
            normalize_name(
                player.get("name")
            )
        )

        existing_news = (
            player.get("news")
            if isinstance(
                player.get("news"),
                dict,
            )
            else {}
        )

        existing_rotowire = (
            existing_news.get(
                "rotowire",
                [],
            )
        )

        combined = merge_news(
            merged_cache.get(
                normalized_name,
                [],
            ),
            existing_rotowire,
            maximum=maximum,
        )

        if combined:
            player["news"] = {
                **existing_news,
                "rotowire": combined,
            }

            merged_cache[
                normalized_name
            ] = combined

            attached_players += 1
            attached_items += len(
                combined
            )

        elif "rotowire" in existing_news:
            next_news = dict(
                existing_news
            )

            next_news.pop(
                "rotowire",
                None,
            )

            if next_news:
                player["news"] = (
                    next_news
                )
            else:
                player.pop(
                    "news",
                    None,
                )

    save_json(
        cache_path,
        {
            "source": (
                "RotoWire NFL RSS"
            ),
            "feedUrl": FEED_URL,
            "updatedAt": (
                datetime.now(
                    timezone.utc
                )
                .isoformat()
                .replace(
                    "+00:00",
                    "Z",
                )
            ),
            "status": feed_status,
            "players": merged_cache,
        },
    )

    save_json(
        output_path,
        payload,
    )

    print(
        (
            f"Attached {attached_items} "
            "RotoWire updates to "
            f"{attached_players} "
            "DraftIQ players."
        )
    )

    print(
        (
            "Updated DraftIQ JSON: "
            f"{output_path}"
        )
    )

    print(
        (
            "Saved RotoWire cache: "
            f"{cache_path}"
        )
    )

    return 0


if __name__ == "__main__":
    sys.exit(
        main()
    )