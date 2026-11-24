import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { executeScript } from '../services/runnerService.js';

describe('Issue #24 - PoC Exécution Dynamique & Gestion Timeout', () => {
  describe('Exécution de scripts Python', () => {
    it('doit exécuter un script Python simple et capturer stdout', async () => {
      const code = 'print("Hello from Python")';
      const result = await executeScript({
        code,
        language: 'python',
        timeoutMs: 3000,
      });

      assert.equal(result.success, true);
      assert.equal(result.timedOut, false);
      assert.equal(result.exitCode, 0);
      assert.equal(result.stdout.trim(), 'Hello from Python');
      assert.equal(result.stderr, '');
    });

    it('doit exécuter des calculs en Python et renvoyer le résultat attendu', async () => {
      const code = `
def add(a, b):
    return a + b
print(add(20, 22))
`;
      const result = await executeScript({
        code,
        language: 'python',
        timeoutMs: 3000,
      });

      assert.equal(result.success, true);
      assert.equal(result.stdout.trim(), '42');
    });

    it('doit capturer les erreurs de syntaxe ou runtime en Python dans stderr', async () => {
      const code = 'raise ValueError("Erreur personnalisée Python")';
      const result = await executeScript({
        code,
        language: 'python',
        timeoutMs: 3000,
      });

      assert.equal(result.success, false);
      assert.notEqual(result.exitCode, 0);
      assert.ok(
        result.stderr.includes('ValueError: Erreur personnalisée Python')
      );
    });
  });

  describe('Exécution de scripts JavaScript (Node.js)', () => {
    it('doit exécuter un script JavaScript simple et capturer stdout', async () => {
      const code = 'console.log("Hello from JS");';
      const result = await executeScript({
        code,
        language: 'javascript',
        timeoutMs: 3000,
      });

      assert.equal(result.success, true);
      assert.equal(result.timedOut, false);
      assert.equal(result.exitCode, 0);
      assert.equal(result.stdout.trim(), 'Hello from JS');
      assert.equal(result.stderr, '');
    });

    it('doit capturer les erreurs d’exécution JavaScript dans stderr', async () => {
      const code = 'throw new Error("Erreur personnalisée JS");';
      const result = await executeScript({
        code,
        language: 'javascript',
        timeoutMs: 3000,
      });

      assert.equal(result.success, false);
      assert.notEqual(result.exitCode, 0);
      assert.ok(result.stderr.includes('Erreur personnalisée JS'));
    });
  });

  describe('Gestion du Timeout basique', () => {
    it('doit interrompre une boucle infinie Python lorsque le timeout est dépassé', async () => {
      const infiniteLoopPython = `
import time
while True:
    time.sleep(0.1)
`;
      const startTime = Date.now();
      const result = await executeScript({
        code: infiniteLoopPython,
        language: 'python',
        timeoutMs: 1000,
      });
      const duration = Date.now() - startTime;

      assert.equal(result.success, false);
      assert.equal(result.timedOut, true);
      assert.equal(result.error, 'TIMEOUT');
      // Le délai doit être proche de 1000ms (+ marge acceptable, < 2500ms)
      assert.ok(
        duration >= 900 && duration < 2500,
        `Durée inattendue : ${duration}ms`
      );
    });

    it('doit interrompre une boucle infinie JavaScript lorsque le timeout est dépassé', async () => {
      const infiniteLoopJS = `
while (true) {}
`;
      const startTime = Date.now();
      const result = await executeScript({
        code: infiniteLoopJS,
        language: 'javascript',
        timeoutMs: 1000,
      });
      const duration = Date.now() - startTime;

      assert.equal(result.success, false);
      assert.equal(result.timedOut, true);
      assert.equal(result.error, 'TIMEOUT');
      assert.ok(
        duration >= 900 && duration < 2500,
        `Durée inattendue : ${duration}ms`
      );
    });
  });

  describe('Validation des paramètres d’entrée', () => {
    it('doit rejeter un langage non supporté', async () => {
      await assert.rejects(
        async () => {
          await executeScript({
            code: 'print(1)',
            language: 'ruby',
            timeoutMs: 1000,
          });
        },
        {
          name: 'Error',
          message: 'Langage non supporté: ruby',
        }
      );
    });

    it('doit rejeter si le code est vide ou non fourni', async () => {
      await assert.rejects(
        async () => {
          await executeScript({
            code: '',
            language: 'python',
            timeoutMs: 1000,
          });
        },
        {
          name: 'Error',
          message: 'Le code à exécuter est requis',
        }
      );
    });
  });
});
