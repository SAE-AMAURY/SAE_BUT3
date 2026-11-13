import { useAuth } from './useAuth.js';

export function useScripts() {
  const { token } = useAuth();

  async function saveScript(codeContent) {
    if (typeof codeContent !== 'string' || !codeContent.trim()) {
      throw new Error('Le code du bot ne peut pas être vide.');
    }

    const response = await fetch('/api/scripts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token.value}`,
      },
      body: JSON.stringify({ code_content: codeContent }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Erreur lors de l'enregistrement du code.");
    }

    return data;
  }

  return { saveScript };
}

/**
 * Appel prévu :
 * POST /api/scripts
 * Authorization: Bearer <token>
 * Content-Type: application/json
 * 
 * Payload :
 * {
  "code_content": "..."
  }
 */