# Cycle TDD obligatoire

Pour tout ajout de fonctionnalité (moteur de jeu, calcul de dégâts, ligne de vue, routes API) :

1. RED : Écrire d'abord le test unitaire ou d'intégration.
2. Vérifier que le test ÉCHOUE sur sa propre assertion (pas sur une erreur de syntaxe).
3. GREEN : Produire le code minimal nécessaire pour faire passer le test.
4. REFACTOR : Nettoyer le code sans toucher au test.
5. VÉRIFICATION : Lancer `task test` et `task code`.
