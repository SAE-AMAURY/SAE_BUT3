import { spawn } from 'node:child_process';

const SUPPORTED_LANGUAGES = {
  python: { command: 'python3', args: ['-u', '-'] },
  py: { command: 'python3', args: ['-u', '-'] },
  javascript: { command: 'node', args: ['-'] },
  js: { command: 'node', args: ['-'] },
};

/**
 * Exécute un script dynamique (Python ou JavaScript) avec gestion de timeout basique.
 * PoC pour l'Issue #24.
 *
 * @param {Object} params
 * @param {string} params.code - Code source à exécuter
 * @param {string} params.language - 'python' ou 'javascript'
 * @param {number} [params.timeoutMs=5000] - Durée maximale autorisée en millisecondes
 * @returns {Promise<{
 *   success: boolean,
 *   timedOut: boolean,
 *   exitCode: number|null,
 *   signal: string|null,
 *   stdout: string,
 *   stderr: string,
 *   error?: string
 * }>}
 */
export async function executeScript({ code, language, timeoutMs = 5000 }) {
  if (typeof code !== 'string' || code.trim() === '') {
    throw new Error('Le code à exécuter est requis');
  }

  const langKey =
    typeof language === 'string' ? language.toLowerCase().trim() : '';
  const langConfig = SUPPORTED_LANGUAGES[langKey];

  if (!langConfig) {
    throw new Error(`Langage non supporté: ${language}`);
  }

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let timer = null;

    const child = spawn(langConfig.command, langConfig.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, timeoutMs);
    }

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.stdin.on('error', () => {
      // Ignorer les erreurs EPIPE lorsque le process est interrompu ou quitte
    });

    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      resolve({
        success: false,
        timedOut: false,
        error: err.message,
        exitCode: 1,
        signal: null,
        stdout,
        stderr: stderr || err.message,
      });
    });

    child.on('close', (exitCode, signal) => {
      if (timer) clearTimeout(timer);

      if (timedOut) {
        resolve({
          success: false,
          timedOut: true,
          error: 'TIMEOUT',
          exitCode,
          signal,
          stdout,
          stderr,
        });
      } else {
        resolve({
          success: exitCode === 0,
          timedOut: false,
          exitCode,
          signal,
          stdout,
          stderr,
        });
      }
    });

    try {
      child.stdin.write(code);
      child.stdin.end();
    } catch {
      // Évite une exception non interceptée si stdin est déjà fermé
    }
  });
}
