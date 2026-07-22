def apply_projection_adjustments(player):
    projection = player["projection"]

    # Starter version: no real adjustments yet
    sos_multiplier = 1.00
    age_multiplier = 1.00
    injury_multiplier = 1.00
    offense_multiplier = 1.00

    adjusted_projection = (
        projection
        * sos_multiplier
        * age_multiplier
        * injury_multiplier
        * offense_multiplier
    )

    player["adjusted_projection"] = round(adjusted_projection, 2)

    return player