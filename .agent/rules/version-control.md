# Contrôle de version - Règles pour les Agents

## ⛔ STRICTEMENT INTERDIT
- ❌ JAMAIS de `git add`
- ❌ JAMAIS de `git commit`
- ❌ JAMAIS de `git push`
- ❌ JAMAIS de `git checkout`, `git branch`, `git merge`, `git rebase`
- ❌ Aucune commande modifiant l'état du dépôt

## ✅ AUTORISÉ (Lecture seule)
- `git status`
- `git diff`
- `git log`

L'humain décide de ce qui est validé et commité. L'agent propose le code et exécute les tests.
