def project_rookie_stats(player):
    college = player["college_stats_per_game"]

    translation_factor = player.get("translation_factor", 0.65)
    role_factor = player.get("role_factor", 0.75)
    projected_games = player.get("projected_games", 17)

    multiplier = translation_factor * role_factor * projected_games

    projected_stats = {
        "passing_yards": round(college.get("passing_yards", 0) * multiplier, 2),
        "passing_touchdowns": round(college.get("passing_touchdowns", 0) * multiplier, 2),
        "interceptions": round(college.get("interceptions", 0) * multiplier, 2),

        "rushing_yards": round(college.get("rushing_yards", 0) * multiplier, 2),
        "rushing_touchdowns": round(college.get("rushing_touchdowns", 0) * multiplier, 2),

        "receptions": round(college.get("receptions", 0) * multiplier, 2),
        "receiving_yards": round(college.get("receiving_yards", 0) * multiplier, 2),
        "receiving_touchdowns": round(college.get("receiving_touchdowns", 0) * multiplier, 2),

        "fumbles_lost": 0
    }

    return projected_stats