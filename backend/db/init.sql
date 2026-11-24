-- ==============================================================================
-- CodeArena Database Initialization Script
-- ==============================================================================

-- 1. Table: USER
CREATE TABLE IF NOT EXISTS "user" (
    player_id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    elo_rank INT NOT NULL DEFAULT 1000,
    selected_class_id INT
);

-- 2. Table: CLASS (sans clé étrangère requise initialement pour éviter la dépendance circulaire)
CREATE TABLE IF NOT EXISTS class (
    class_id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    base_health INT NOT NULL,
    base_range INT NOT NULL,
    base_damage INT NOT NULL,
    base_action_points INT NOT NULL DEFAULT 3,
    available_functions JSONB NOT NULL DEFAULT '[]'::jsonb,
    required_mission_id INT,
    CONSTRAINT uq_class_name UNIQUE (name),
    CONSTRAINT chk_class_stats_positive CHECK (
        base_health > 0
        AND base_range > 0
        AND base_damage > 0
        AND base_action_points > 0
    )
);

-- 2b. Évolution idempotente de la table CLASS (Issue #27)
DO $$
BEGIN
    ALTER TABLE class ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
    ALTER TABLE class ADD COLUMN IF NOT EXISTS base_action_points INT NOT NULL DEFAULT 3;
    ALTER TABLE class ADD COLUMN IF NOT EXISTS available_functions JSONB NOT NULL DEFAULT '[]'::jsonb;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'class'::regclass AND contype = 'u'
    ) THEN
        ALTER TABLE class ADD CONSTRAINT uq_class_name UNIQUE (name);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_class_stats_positive'
    ) THEN
        ALTER TABLE class
        ADD CONSTRAINT chk_class_stats_positive
        CHECK (
            base_health > 0
            AND base_range > 0
            AND base_damage > 0
            AND base_action_points > 0
        );
    END IF;

    ALTER TABLE "user" ADD COLUMN IF NOT EXISTS selected_class_id INT;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_selected_class'
    ) THEN
        ALTER TABLE "user"
        ADD CONSTRAINT fk_user_selected_class
        FOREIGN KEY (selected_class_id) REFERENCES class(class_id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Table: MISSION_PROGRESSION
CREATE TABLE IF NOT EXISTS mission_progression (
    mission_id SERIAL PRIMARY KEY,
    description TEXT NOT NULL,
    required_wins INT NOT NULL,
    conditional_class_id INT REFERENCES class(class_id) ON DELETE SET NULL
);

-- 4. Contrainte clé étrangère vers MISSION_PROGRESSION
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_class_mission'
    ) THEN
        ALTER TABLE class
        ADD CONSTRAINT fk_class_mission
        FOREIGN KEY (required_mission_id) REFERENCES mission_progression(mission_id) ON DELETE SET NULL;
    END IF;
END $$;

-- 5. Table: PLAYER_UNLOCK (Association utilisateurs / classes débloquées)
CREATE TABLE IF NOT EXISTS player_unlock (
    player_id INT REFERENCES "user"(player_id) ON DELETE CASCADE,
    unlocked_class_id INT REFERENCES class(class_id) ON DELETE CASCADE,
    unlock_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (player_id, unlocked_class_id)
);

-- 6. Table: MATCH
CREATE TABLE IF NOT EXISTS match (
    match_id SERIAL PRIMARY KEY,
    player_1_id INT NOT NULL REFERENCES "user"(player_id) ON DELETE CASCADE,
    player_2_id INT NOT NULL REFERENCES "user"(player_id) ON DELETE CASCADE,
    score_p1 INT NOT NULL DEFAULT 0,
    score_p2 INT NOT NULL DEFAULT 0,
    match_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. Table: SCRIPT
CREATE TABLE IF NOT EXISTS script (
    script_id SERIAL PRIMARY KEY,
    match_id INT REFERENCES match(match_id) ON DELETE CASCADE,
    player_id INT NOT NULL REFERENCES "user"(player_id) ON DELETE CASCADE,
    class_id INT REFERENCES class(class_id) ON DELETE SET NULL,
    code_content TEXT NOT NULL,
    round_number INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_round CHECK (round_number > 0)
);

-- 7b. Évolution idempotente de la table SCRIPT (Issues #22 & #23)
DO $$
BEGIN
    ALTER TABLE script ALTER COLUMN match_id DROP NOT NULL;
    ALTER TABLE script ALTER COLUMN class_id DROP NOT NULL;
    ALTER TABLE script ALTER COLUMN round_number SET DEFAULT 1;
    ALTER TABLE script ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
END $$;

-- ==============================================================================
-- Seed Data (Jeu de données de test - Issue #8)
-- ==============================================================================

-- Classes initiales (Issue #27)
INSERT INTO class (
    name,
    description,
    base_health,
    base_range,
    base_damage,
    base_action_points,
    available_functions,
    required_mission_id
) VALUES
(
    'Guerrier',
    'Combattant polyvalent spécialisé dans le corps à corps et les assauts rapides.',
    100,
    1,
    25,
    3,
    '[{"name":"move","signature":"move(direction)","ap_cost":1,"description":"Déplace le bot sur une case adjacente."},{"name":"attack","signature":"attack(target)","ap_cost":2,"description":"Attaque une cible ennemie à portée."},{"name":"scan","signature":"scan()","ap_cost":0,"description":"Analyse la grille pour repérer ennemis et obstacles."},{"name":"wait","signature":"wait()","ap_cost":0,"description":"Passe le tour sans agir."},{"name":"charge","signature":"charge(direction)","ap_cost":3,"description":"Fonce vers un ennemi proche et inflige des dégâts renforcés."}]'::jsonb,
    NULL
),
(
    'Tank',
    'Unité lourdement blindée conçue pour encaisser les dégâts et contrôler la zone.',
    160,
    1,
    15,
    2,
    '[{"name":"move","signature":"move(direction)","ap_cost":1,"description":"Déplace le bot sur une case adjacente."},{"name":"attack","signature":"attack(target)","ap_cost":2,"description":"Attaque une cible ennemie à portée."},{"name":"scan","signature":"scan()","ap_cost":0,"description":"Analyse la grille pour repérer ennemis et obstacles."},{"name":"wait","signature":"wait()","ap_cost":0,"description":"Passe le tour sans agir."},{"name":"shield","signature":"shield()","ap_cost":2,"description":"Active un bouclier réduisant les dégâts reçus au tour suivant."}]'::jsonb,
    NULL
),
(
    'Sniper',
    'Tireur de précision à très longue portée doté de dégâts élevés mais fragile.',
    70,
    4,
    35,
    3,
    '[{"name":"move","signature":"move(direction)","ap_cost":1,"description":"Déplace le bot sur une case adjacente."},{"name":"attack","signature":"attack(target)","ap_cost":2,"description":"Attaque une cible ennemie à portée."},{"name":"scan","signature":"scan()","ap_cost":0,"description":"Analyse la grille pour repérer ennemis et obstacles."},{"name":"wait","signature":"wait()","ap_cost":0,"description":"Passe le tour sans agir."},{"name":"snipe","signature":"snipe(target)","ap_cost":3,"description":"Tir de précision à portée maximale infligeant de lourds dégâts."}]'::jsonb,
    NULL
)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    base_health = EXCLUDED.base_health,
    base_range = EXCLUDED.base_range,
    base_damage = EXCLUDED.base_damage,
    base_action_points = EXCLUDED.base_action_points,
    available_functions = EXCLUDED.available_functions;

-- Missions initiales
INSERT INTO mission_progression (description, required_wins, conditional_class_id) VALUES
('Remporter 3 victoires en duel', 3, NULL),
('Remporter 5 victoires avec la classe Guerrier', 5, 1)
ON CONFLICT DO NOTHING;

-- Utilisateur de test initial (Mot de passe: password123, hash bcrypt)
INSERT INTO "user" (username, email, password, elo_rank) VALUES
('testplayer', 'test@codearena.local', '$2b$10$PjB5K4g6v5g7k4.sZ3HbeevhKkJ8qI1l2bM3R9v4.K3HjOQ8bX7vL', 1000)
ON CONFLICT (username) DO NOTHING;

-- Déblocage de la classe Guerrier par défaut pour l'utilisateur test
INSERT INTO player_unlock (player_id, unlocked_class_id)
SELECT u.player_id, c.class_id
FROM "user" u, class c
WHERE u.username = 'testplayer' AND c.name = 'Guerrier'
ON CONFLICT DO NOTHING;
