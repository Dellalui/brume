# Les Brumes

Éditeur de cartes tactiques 3D pour jeu de rôle.

## État de l'import

Import partiel uniquement : package.json, worker de navigation, documentation des dépendances et test de rendu. Les modules principaux, textures et modèles 3D restent dans l'archive complète. Ce dépôt n'est pas encore exécutable seul.

## GitHub Pages

1. Ajouter l'archive complète `brume.zip` à la racine du dépôt (ne pas la renommer). Elle doit contenir directement `dist/index.html`, `dist/editor.mjs` et toutes les dépendances.
2. Dans Settings > Pages, sélectionner GitHub Actions comme source.
3. Le workflow Deploy Les Brumes to GitHub Pages publie le dossier dist de l'archive. Si un dossier dist complet existe à la racine, il est prioritaire.

## Railway

Le Dockerfile et Caddyfile sont prévus pour un dossier dist complet à la racine. Extraire l'archive avant un déploiement Railway.

Les sauvegardes dans le navigateur ne se transfèrent pas automatiquement entre domaines.
