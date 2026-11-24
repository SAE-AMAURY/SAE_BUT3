import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticateToken } from '../middleware/auth.js';

const MAX_SCRIPT_LENGTH = 50000;
const SCRIPT_COLUMNS =
  'script_id, match_id, player_id, class_id, code_content, round_number, updated_at';

/**
 * Valide un identifiant entier strictement positif (ou null/undefined).
 */
function parseOptionalPositiveInt(value) {
  if (value === undefined || value === null) {
    return { valid: true, value: null };
  }
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0 || String(num) !== String(value)) {
    return { valid: false, value: null };
  }
  return { valid: true, value: num };
}

/**
 * Formate une ligne SQL de la table `script` pour l'API REST.
 */
export function formatScriptRow(row) {
  return {
    script_id: row.script_id,
    player_id: row.player_id,
    match_id: row.match_id ?? null,
    class_id: row.class_id ?? null,
    code_content: row.code_content,
    round_number: row.round_number ?? 1,
    updated_at: row.updated_at ?? null,
  };
}

async function fetchLatestScriptForPlayer(db, playerId) {
  const result = await db.query(
    `SELECT ${SCRIPT_COLUMNS}
     FROM script
     WHERE player_id = $1
     ORDER BY updated_at DESC, script_id DESC
     LIMIT 1`,
    [playerId]
  );
  return result.rows[0] ?? null;
}

/**
 * Construit le handler Express pour sauvegarder ou mettre à jour un script (Issue #22).
 */
export function createSaveScriptHandler(db = pool) {
  return async (req, res) => {
    const { code_content, class_id, script_id, match_id, round_number } =
      req.body ?? {};

    if (typeof code_content !== 'string' || !code_content.trim()) {
      return res
        .status(400)
        .json({ error: 'Le contenu du script est obligatoire.' });
    }

    if (code_content.length > MAX_SCRIPT_LENGTH) {
      return res.status(400).json({
        error: `Le script dépasse la taille maximale autorisée (${MAX_SCRIPT_LENGTH} caractères).`,
      });
    }

    const parsedScriptId = parseOptionalPositiveInt(script_id);
    const parsedClassId = parseOptionalPositiveInt(class_id);
    const parsedMatchId = parseOptionalPositiveInt(match_id);
    const parsedRound =
      round_number === undefined
        ? { valid: true, value: 1 }
        : parseOptionalPositiveInt(round_number);

    if (
      !parsedScriptId.valid ||
      !parsedClassId.valid ||
      !parsedMatchId.valid ||
      !parsedRound.valid
    ) {
      return res
        .status(400)
        .json({ error: 'Paramètres de script invalides.' });
    }

    const playerId = req.user.player_id;

    try {
      if (parsedScriptId.value !== null) {
        const updated = await db.query(
          `UPDATE script
           SET code_content = $1,
               class_id = COALESCE($2, class_id),
               updated_at = CURRENT_TIMESTAMP
           WHERE script_id = $3 AND player_id = $4
           RETURNING ${SCRIPT_COLUMNS}`,
          [code_content, parsedClassId.value, parsedScriptId.value, playerId]
        );

        if (updated.rows.length === 0) {
          return res.status(404).json({ error: 'Script introuvable.' });
        }

        return res.status(200).json({
          message: 'Script mis à jour avec succès.',
          script: formatScriptRow(updated.rows[0]),
        });
      }

      if (parsedMatchId.value === null) {
        const existingDraft = await db.query(
          `SELECT script_id
           FROM script
           WHERE player_id = $1 AND match_id IS NULL
           ORDER BY updated_at DESC, script_id DESC
           LIMIT 1`,
          [playerId]
        );

        if (existingDraft.rows.length > 0) {
          const updatedDraft = await db.query(
            `UPDATE script
             SET code_content = $1,
                 class_id = COALESCE($2, class_id),
                 updated_at = CURRENT_TIMESTAMP
             WHERE script_id = $3 AND player_id = $4
             RETURNING ${SCRIPT_COLUMNS}`,
            [
              code_content,
              parsedClassId.value,
              existingDraft.rows[0].script_id,
              playerId,
            ]
          );

          return res.status(200).json({
            message: 'Script mis à jour avec succès.',
            script: formatScriptRow(updatedDraft.rows[0]),
          });
        }
      }

      const inserted = await db.query(
        `INSERT INTO script (match_id, player_id, class_id, code_content, round_number, updated_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         RETURNING ${SCRIPT_COLUMNS}`,
        [
          parsedMatchId.value,
          playerId,
          parsedClassId.value,
          code_content,
          parsedRound.value,
        ]
      );

      return res.status(201).json({
        message: 'Script sauvegardé avec succès.',
        script: formatScriptRow(inserted.rows[0]),
      });
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Erreur sauvegarde script:', error);
      }
      return res
        .status(500)
        .json({ error: 'Erreur interne lors de la sauvegarde du script.' });
    }
  };
}

/**
 * Construit le handler Express pour récupérer le dernier script du joueur connecté (Issue #23).
 */
export function createGetLatestScriptHandler(db = pool) {
  return async (req, res) => {
    try {
      const latest = await fetchLatestScriptForPlayer(db, req.user.player_id);
      if (!latest) {
        return res.status(404).json({ error: 'Aucun script sauvegardé.' });
      }
      return res.status(200).json({ script: formatScriptRow(latest) });
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Erreur récupération dernier script:', error);
      }
      return res
        .status(500)
        .json({ error: 'Erreur lors de la récupération du script.' });
    }
  };
}

/**
 * Construit le handler Express pour récupérer un script par ID ou alias latest/me (Issue #23).
 */
export function createGetScriptByIdHandler(db = pool) {
  return async (req, res) => {
    const rawId = req.params?.id;
    const playerId = req.user.player_id;

    try {
      if (rawId === 'latest' || rawId === 'me') {
        const latest = await fetchLatestScriptForPlayer(db, playerId);
        if (!latest) {
          return res.status(404).json({ error: 'Aucun script sauvegardé.' });
        }
        return res.status(200).json({ script: formatScriptRow(latest) });
      }

      const parsedId = parseOptionalPositiveInt(rawId);
      if (!parsedId.valid || parsedId.value === null) {
        return res
          .status(400)
          .json({ error: 'Identifiant de script invalide.' });
      }

      const byScriptId = await db.query(
        `SELECT ${SCRIPT_COLUMNS}
         FROM script
         WHERE script_id = $1 AND player_id = $2`,
        [parsedId.value, playerId]
      );

      if (byScriptId.rows.length > 0) {
        return res
          .status(200)
          .json({ script: formatScriptRow(byScriptId.rows[0]) });
      }

      if (parsedId.value === playerId) {
        const latest = await fetchLatestScriptForPlayer(db, playerId);
        if (latest) {
          return res.status(200).json({ script: formatScriptRow(latest) });
        }
      }

      return res.status(404).json({ error: 'Script introuvable.' });
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Erreur récupération script:', error);
      }
      return res
        .status(500)
        .json({ error: 'Erreur lors de la récupération du script.' });
    }
  };
}

const router = Router();
router.use(authenticateToken);

router.post('/', createSaveScriptHandler());
router.get('/', createGetLatestScriptHandler());
router.get('/:id', createGetScriptByIdHandler());

export default router;
