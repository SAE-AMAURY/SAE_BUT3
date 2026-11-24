import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticateToken } from '../middleware/auth.js';

const CLASS_COLUMNS =
  'class_id, name, description, base_health, base_range, base_damage, base_action_points, available_functions, required_mission_id';

const PREFIXED_CLASS_COLUMNS =
  'c.class_id, c.name, c.description, c.base_health, c.base_range, c.base_damage, c.base_action_points, c.available_functions, c.required_mission_id';

function parsePositiveInt(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0 || String(num) !== String(value)) {
    return null;
  }
  return num;
}

/**
 * Normalise le champ JSONB available_functions en tableau d'objets.
 */
function parseAvailableFunctions(raw) {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Formate une ligne SQL de la table `class` pour l'API REST.
 */
export function formatClassRow(row) {
  return {
    class_id: row.class_id,
    name: row.name,
    description: row.description ?? '',
    base_health: row.base_health,
    base_range: row.base_range,
    base_damage: row.base_damage,
    base_action_points: row.base_action_points,
    stats: {
      health: row.base_health,
      range: row.base_range,
      damage: row.base_damage,
      action_points: row.base_action_points,
    },
    available_functions: parseAvailableFunctions(row.available_functions),
    required_mission_id: row.required_mission_id ?? null,
  };
}

/**
 * Construit le handler Express pour lister toutes les classes de bots.
 */
export function createGetClassesHandler(db = pool) {
  return async (req, res) => {
    try {
      const result = await db.query(
        `SELECT ${CLASS_COLUMNS} FROM class ORDER BY class_id ASC`
      );
      return res.status(200).json({
        classes: result.rows.map(formatClassRow),
      });
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Erreur classes:', error);
      }
      return res
        .status(500)
        .json({ error: 'Erreur lors de la récupération des classes.' });
    }
  };
}

/**
 * Construit le handler Express pour récupérer le détail d'une classe par ID.
 */
export function createGetClassByIdHandler(db = pool) {
  return async (req, res) => {
    const classId = parsePositiveInt(req.params?.id);

    if (classId === null) {
      return res.status(400).json({ error: 'Identifiant de classe invalide.' });
    }

    try {
      const result = await db.query(
        `SELECT ${CLASS_COLUMNS} FROM class WHERE class_id = $1`,
        [classId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Classe introuvable.' });
      }

      return res.status(200).json({
        class: formatClassRow(result.rows[0]),
      });
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Erreur classe par id:', error);
      }
      return res
        .status(500)
        .json({ error: 'Erreur lors de la récupération de la classe.' });
    }
  };
}

/**
 * Construit le handler Express pour enregistrer la classe choisie par le joueur (Issue #33).
 */
export function createSelectClassHandler(db = pool) {
  return async (req, res) => {
    const classId = parsePositiveInt(req.body?.class_id);

    if (classId === null) {
      return res.status(400).json({ error: 'Identifiant de classe invalide.' });
    }

    const playerId = req.user.player_id;

    try {
      const classResult = await db.query(
        `SELECT ${CLASS_COLUMNS} FROM class WHERE class_id = $1`,
        [classId]
      );

      if (classResult.rows.length === 0) {
        return res.status(404).json({ error: 'Classe introuvable.' });
      }

      const selectedClass = classResult.rows[0];

      if (selectedClass.required_mission_id !== null) {
        const unlockResult = await db.query(
          'SELECT 1 FROM player_unlock WHERE player_id = $1 AND unlocked_class_id = $2',
          [playerId, classId]
        );
        if (unlockResult.rows.length === 0) {
          return res.status(403).json({
            error: 'Classe verrouillée : mission requise non complétée.',
          });
        }
      }

      const updateResult = await db.query(
        'UPDATE "user" SET selected_class_id = $1 WHERE player_id = $2 RETURNING player_id, selected_class_id',
        [classId, playerId]
      );

      if (updateResult.rows.length === 0) {
        return res.status(404).json({ error: 'Utilisateur introuvable.' });
      }

      return res.status(200).json({
        message: 'Classe sélectionnée pour le prochain match.',
        selected_class_id: updateResult.rows[0].selected_class_id,
        selected_class: formatClassRow(selectedClass),
      });
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Erreur sélection classe:', error);
      }
      return res
        .status(500)
        .json({ error: 'Erreur lors de la sélection de la classe.' });
    }
  };
}

/**
 * Construit le handler Express pour consulter la classe sélectionnée du joueur (Issue #33).
 */
export function createGetSelectedClassHandler(db = pool) {
  return async (req, res) => {
    try {
      const result = await db.query(
        `SELECT u.selected_class_id, ${PREFIXED_CLASS_COLUMNS}
         FROM "user" u
         LEFT JOIN class c ON u.selected_class_id = c.class_id
         WHERE u.player_id = $1`,
        [req.user.player_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Utilisateur introuvable.' });
      }

      const row = result.rows[0];
      return res.status(200).json({
        selected_class_id: row.selected_class_id ?? null,
        selected_class: row.class_id ? formatClassRow(row) : null,
      });
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Erreur récupération classe sélectionnée:', error);
      }
      return res.status(500).json({
        error: 'Erreur lors de la récupération de la classe sélectionnée.',
      });
    }
  };
}

const getClasses = createGetClassesHandler();
const getClassById = createGetClassByIdHandler();
const selectClass = createSelectClassHandler();
const getSelectedClass = createGetSelectedClassHandler();

export const classesRouter = Router();
classesRouter.get('/', getClasses);
classesRouter.get('/selected', authenticateToken, getSelectedClass);
classesRouter.post('/select', authenticateToken, selectClass);
classesRouter.put('/select', authenticateToken, selectClass);
classesRouter.get('/:id', getClassById);

const router = Router();

// GET /api/classes & sélection de classe
router.get('/classes', getClasses);
router.get('/classes/selected', authenticateToken, getSelectedClass);
router.post('/classes/select', authenticateToken, selectClass);
router.put('/classes/select', authenticateToken, selectClass);
router.get('/classes/:id', getClassById);

// GET /api/missions - List all missions
router.get('/missions', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM mission_progression ORDER BY mission_id ASC'
    );
    res.json({ missions: result.rows });
  } catch (error) {
    console.error('Erreur missions:', error);
    res
      .status(500)
      .json({ error: 'Erreur lors de la récupération des missions.' });
  }
});

export default router;
