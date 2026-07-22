import requests


def get_json(url):
    response = requests.get(url)
    response.raise_for_status()
    return response.json()


def fetch_roster(team_id):
    roster_url = (
        f"https://site.api.espn.com/apis/site/v2/"
        f"sports/football/nfl/teams/{team_id}/roster"
    )

    return get_json(roster_url)

def fetch_game_logs(player_id, season=None):
    """
    Fetch a player's ESPN game logs.

    Parameters
    ----------
    player_id : str
        ESPN player ID.

    season : int | None
        Optional season. If omitted, ESPN returns the latest season.
    """

    url = (
        f"https://site.web.api.espn.com/apis/common/v3/"
        f"sports/football/nfl/athletes/{player_id}/gamelog"
    )

    if season is not None:
        url += f"?season={season}"

    return get_json(url)