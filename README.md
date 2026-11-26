## Version 2026.11.27

Optimisations et neuf impacts : [notes de version](docs/release-2026.11.27.md). Tests : `npm ci && npm test`. ZIP daté : `npm run release`.

# Les Brumes

Editeur de cartes tactiques 3D pour jeu de role.

## Version astrale

Le fichier `brume.zip` conserve l'export verifie de la V3 avec le correctif astral. Le workflow importe les 164 fichiers statiques dans `dist/` apres verification SHA-256, puis les commit sur main. Les modifications suivantes se font directement dans les fichiers de `dist/`; le ZIP reste une archive de reference.

## Publication

- GitHub Pages : activer GitHub Actions dans Settings > Pages, puis relancer le workflow Deploy Les Brumes to GitHub Pages.
- Railway : le Dockerfile et Caddyfile servent le dossier dist complet, ou extraient l'archive si necessaire. Caddy utilise le port PORT (8080 par defaut).

Le depot est public. Ne pas y placer de secrets ni de sauvegardes personnelles. Les sauvegardes du navigateur ne suivent pas automatiquement un changement de domaine.
