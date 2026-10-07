# CodeArena

Plateforme d'affrontement tactique de bots en 2D au tour par tour (SAÉ BUT3 Informatique). Les joueurs rédigent leurs scripts dans un éditeur en ligne ; le serveur arbitre les matchs dans des bacs à sable Docker isolés et renvoie les replays pour un rendu Canvas.

---

## 1. Prérequis système

* **OS :** Linux ou Windows 10/11 avec **WSL 2** configuré.
* **Docker Desktop :** installé avec l'intégration WSL 2 activée (*Settings > Resources > WSL integration*).
* **Node.js :** version 20 LTS ou supérieure.
* **Task (`go-task`) :** orchestrateur de commandes officiel du dépôt.
```bash
sh -c "$(curl --location https://taskfile.dev/install.sh)" -- -d -b ~/.local/bin

```



---

## 2. Démarrage rapide (*Quickstart*)

### A. Cloner et configurer l'environnement

```bash
git clone <URL_DU_REPO>
cd SAE_BUT3

# Copier le gabarit d'environnement
cp .env.dist .env

```

Vérifier les variables locales dans `.env` (ports, identifiants PostgreSQL). **Ne jamais modifier ni commiter de secrets dans `.env.dist**`.

### B. Installer les dépendances

```bash
# Dépendances racine (Husky, commitlint, outils DevSecOps)
npm install

# Dépendances des sous-projets
npm --prefix backend install
npm --prefix frontend install

```

### C. Lancer l'application

Une seule commande démarre PostgreSQL, le backend Node.js et le frontend Vite en parallèle :

```bash
task dev

```

Points d'accès une fois le démarrage terminé :

* **Frontend :** `http://localhost:5173`
* **API Backend :** `http://localhost:3000`
* **Vérification API / BDD :** `http://localhost:3000/health`
* **Documentation OpenAPI :** `http://localhost:3000/api-docs`

---

## 3. Commandes usuelles (`Taskfile.yml`)

Ne pas lancer `npm run` ou `docker compose` manuellement dans les sous-dossiers : passer systématiquement par `task` à la racine.

| Commande | Action |
| --- | --- |
| `task dev` | Lance PostgreSQL, le backend et le frontend en continu. |
| `task db:up` | Démarre uniquement le conteneur PostgreSQL en arrière-plan. |
| `task db:down` | Stoppe PostgreSQL. |
| `task db:reset` | Supprime les volumes et recrée une base PostgreSQL vierge. |
| `task code` | Vérifie la syntaxe et le formattage des fichiers sources. |
| `task test` | Lance la suite complète (contrôle anti-triche, unitaires, E2E).

 |
| `task test:e2e` | Exécute les tests Playwright de bout en bout sur le client. |
| `task check:no-cheat` | Vérifie qu'aucun test n'a été neutralisé (`.skip`, `.only`).

 |
| `task sandbox:build` | Compile l'image Docker minimale d'exécution des scripts joueurs. |
| `task scan` | Lance l'audit Trivy sur l'image sandbox pour détecter les CVE critiques. |

---

## 4. Architecture du dépôt

```text
.
├── .agent/                  # Garde-fous et règles pour les assistants IA
│   └── rules/               # Interdictions Git, commandes imposées, cycle TDD
├── .github/                 # Workflows CI/CD GitHub Actions
│   └── workflows/ci.yml     # Pipeline d'audit (Trivy, anti-triche, tests)
├── backend/                 # Serveur Node.js / Express (API, WebSocket, Juge)
│   ├── db/init.sql          # Schéma SQL exécuté à l'initialisation de PostgreSQL
│   ├── index.js             # Point d'entrée de l'API
│   └── swagger.json         # Déclaration OpenAPI
├── frontend/                # Application SPA Vue 3 / Vite / TailwindCSS
│   ├── e2e/                 # Tests End-to-End (Playwright)
│   └── src/                 # Composants UI, Monaco Editor, Canvas arène
├── sandbox/                 # Environnement conteneurisé d'arbitrage
│   └── Dockerfile           # Image d'exécution isolée (--network none)
├── scripts/                 # Scripts d'automatisation DevSecOps (anti-triche diff)
├── .env.dist                # Gabarit des variables d'environnement (versionné)
├── AGENTS.md / CLAUDE.md    # Instructions système pour IA de développement
└── Taskfile.yml             # Point d'entrée unique de toutes les commandes

```

---

## 5. Règles de contribution et Git

### A. Format des commits (Conventional Commits)

Les commits sont contrôlés localement par **Husky** et **Commitlint**. Tout commit ne respectant pas la nomenclature standard sera refusé :

* `feat(scope): ajout de la ligne de vue pour le sniper`
* `fix(auth): correction du token expiré`
* `docs(readme): mise à jour du guide de démarrage`
* `test(engine): ajout des cas de bord sur les déplacements`
* `refactor(db): nettoyage des requêtes de matchmaking`

### B. Flux de branches

1. Ne jamais pousser directement sur `main`.
2. Créer une branche descriptive : `git checkout -b feat/nom-de-la-feature`.
3. Valider la qualité localement avant d'ouvrir une PR :
```bash
task code
task test

```


4. Ouvrir une *Pull Request* vers `main` (ou `develop`). Le merge exige que le pipeline GitHub Actions soit intégralement vert.

---

## 6. DevSecOps et intégrité du code

* **Isolation des combats :** L'exécution du code soumis par les utilisateurs passe obligatoirement par un conteneur éphémère sans accès réseau (`--network none`) avec des plafonds stricts de mémoire (128 Mo) et de temps (5 secondes). Ne jamais utiliser `eval()` ou `child_process.exec()` directement sur le serveur hôte.
* **Garde-fou anti-triche (`check-no-cheat`) :** La CI vérifie les diffs de chaque PR. Toute tentative de faire passer une branche en ajoutant un `test.skip()`, `.only()`, ou en désactivant une règle de linter (`eslint-disable`, `# noqa`) bloque automatiquement le pipeline.


* **Contrat IA :** Si un membre utilise un assistant (Claude, Copilot, Cursor), l'outil doit respecter les directives définies dans `AGENTS.md` et `.agent/rules/`. L'IA n'est pas autorisée à manipuler l'état de Git.
