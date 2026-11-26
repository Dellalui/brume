# Les Brumes

Editeur de cartes tactiques 3D pour jeu de role.

## Import de la version complete

Le depot contient pour le moment un import partiel. Ajouter `brume.zip` a la racine, sans le decompresser. L'archive complete du correctif ciel astral contient 224 fichiers, dont 164 dans `dist/` (jeu, textures, modules et modeles).

Archive de reference : 13 986 005 octets ; SHA-256 `d6238db2ad57619b2f26fcdbacdddd154b95d23e2f1065b1aa1e0f35a093c06b`.

## GitHub Pages

1. Dans Settings > Pages, selectionner GitHub Actions.
2. Importer `brume.zip` a la racine et valider le commit.
3. Suivre le workflow **Deploy Les Brumes to GitHub Pages** dans Actions. Si l'archive a ete importee avant l'activation de Pages, relancer le workflow manuellement.
4. Une fois le job deploy reussi, ouvrir https://dellalui.github.io/brume/.

Un workflow vert dont le job deploy est ignore ne correspond pas a une publication.

## Railway

Le Dockerfile accepte la meme archive `brume.zip` sans import supplementaire. Si le dossier `dist/` complet existe deja, il est prioritaire. Le serveur Caddy utilise le port `PORT` fourni par Railway (8080 par defaut).

Le depot est public. Ne jamais y importer de sauvegardes personnelles ou de secrets. Les sauvegardes du navigateur ne suivent pas automatiquement un changement de domaine.
