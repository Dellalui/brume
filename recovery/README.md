# Recuperation de Les Brumes

L'exporteur autonome `export-brume.js` doit etre execute dans la console du navigateur sur la V2 existante, apres connexion. Lire le code avant execution. Il lit uniquement les 164 chemins statiques du manifeste depuis la meme origine, verifie SHA-256, applique le correctif des trois modules, verifie de nouveau, puis affiche un lien de telechargement local de brume.zip. Aucun identifiant, cookie, sauvegarde ni autre donnee personnelle n'est exporte. En cas de difference de version, aucun ZIP n'est genere.

Importer le ZIP produit a la racine du depot. Activer GitHub Actions dans Settings > Pages. Le workflow publiera dist/.
