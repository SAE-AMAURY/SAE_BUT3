import { Router } from 'express';
import { pool } from '../db/pool.js';

const CLASS_COLUMNS =
  'class_id, name, description, base_health, base_range, base_damage, base_action_points, available_functions, required_mission_id';

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
    const rawId = req.params?.id;
    const classId = Number(rawId);

    if (!Number.isInteger(classId) || classId <= 0 || String(classId) !== String(rawId)) {
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

const getClasses = createGetClassesHandler();
const getClassById = createGetClassByIdHandler();

export const classesRouter = Router();
classesRouter.get('/', getClasses);
classesRouter.get('/:id', getClassById);

const router = Router();

// GET /api/classes & GET /api/classes/:id
router.get('/classes', getClasses);
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
