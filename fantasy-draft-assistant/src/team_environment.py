def calculate_team_modifiers(team_stats):
    """
    Converts team offense stats into simple projection modifiers.

    1.00 = neutral
    >1.00 = boost
    <1.00 = penalty
    """

    modifiers = {}

    for team, stats in team_stats.items():
        passing_yards = stats.get("passing_yards", 0)
        rushing_yards = stats.get("rushing_yards", 0)

        passing_modifier = 1.0
        rushing_modifier = 1.0

        if passing_yards >= 4500:
            passing_modifier = 1.08
        elif passing_yards >= 4000:
            passing_modifier = 1.04
        elif passing_yards < 3200:
            passing_modifier = 0.94

        if rushing_yards >= 2200:
            rushing_modifier = 1.08
        elif rushing_yards >= 1900:
            rushing_modifier = 1.04
        elif rushing_yards < 1500:
            rushing_modifier = 0.94

        modifiers[team] = {
            "passing_modifier": passing_modifier,
            "receiving_modifier": passing_modifier,
            "rushing_modifier": rushing_modifier
        }

    return modifiers