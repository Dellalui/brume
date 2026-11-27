# Brume v2026.11.27 — 27 novembre 2026

Base : `f94ca84e9bf660fb765790b5e7b13237fb41fbf1` du dépôt Dellalui/brume.

## Utilisation

- Construire → E → Projectiles : neuf effets, dont Déflagration toxique, Éclat sacré et Implosion du néant.
- Équiper un effet, reprendre la visée, clic droit pour lancer. R règle le rayon et l’amplitude visuelle. Désactiver « Affecter les blocs » produit un effet sans destruction. Les protections et Ctrl + Z sont conservés.
- Le néant contracte le noyau, l’onde et les fragments. Le sacré émet des éclats et des runes dorées ; le toxique forme un nuage vert et des projections. Tous utilisent la bibliothèque Quarks déjà embarquée, sans téléchargement supplémentaire.
- Trois projectiles maximum ; les nouveaux impacts adaptent leur budget aux effets simultanés. L’amplitude visuelle reste indépendante de la destruction.
- Les nouveaux trajets en pointillés arrondis et le repère de destination de la version GitHub sont conservés, avec séparation aux marches et aux zones invisibles.

## Optimisations et corrections

- Pathfinding : un déplacement transmet seulement les objets de collision modifiés. Il ne sérialise plus la liste complète des obstacles à chaque survol. Ajouts, retraits et annulations restent synchronisés par révision.
- Vision groupée : calcul réparti entre images, cible de 4 ms par passage, au moins un observateur. Un calcul individuel peut dépasser cette cible. Rotation équitable des observateurs lorsque la scène change fréquemment. Les anciennes zones visibles invalidées sont exclues immédiatement ; aucune révélation provisoire à travers un mur.
- Historique : instantanés immuables partageant les données inchangées. Le gain concerne surtout la mémoire ; le parcours de l’état existe toujours.
- Sauvegarde : IndexedDB par objet et colonne de blocs, transactions atomiques et écritures ordonnées. L’ancienne sauvegarde localStorage est conservée comme secours. L’import et l’export restent disponibles. La sélection du stockage précède le démarrage de l’éditeur.
- Lumières : première source d’ombre stable, autres sources choisies près de l’observateur avec une marge de rétention. Toutes les lumières actives gardent les limites d’ombres de la version GitHub.
- Profil Fluide : résolution plafonnée à un pixel physique par pixel CSS, en complément des budgets existants.
- Explosions : textures générées au premier usage, buffers réutilisés, aucune allocation d’impact hors champ, arrêt des calculs hors champ, destruction des émetteurs terminés avant la fin de la fumée. Une réapparition tardive ne relance pas l’explosion. Bruit du shader simplifié en qualité basse.
- CI sur les PR, dépendances verrouillées et script `npm run release` produisant un ZIP avec version, date, commit et sommes SHA-256.

## Mesures reproductibles

`node scripts/benchmark.mjs <chemin-du-dépôt>` ; Node 24, scène synthétique de 8 000 blocs, médianes locales. Comparaison contre le commit de base, pas contre une ancienne version Sites.

| Opération | Base GitHub | Cette version |
|---|---:|---:|
| Préparation du worker, scène immobile | 4,05 ms | 1,59 ms |
| Préparation du worker, un personnage bouge | 5,55 ms | 1,52 ms |
| Message de collision après déplacement | 1 211 065 octets | 200 octets |
| Premier passage de vision, dix personnages | 45,22 ms, dix observateurs | 4,90 ms, un observateur ; suite sur les images suivantes |
| Création d’un instantané d’historique | 8,14 ms | 9,58 ms |

Les instantanés sont légèrement plus coûteux en CPU dans ce test, mais ne conservent plus 35 copies sérialisées du monde (environ 148 Mio de caractères UTF-16 sur ce cas). Les objets inchangés sont partagés. L’estimation du script pour les objets partagés n’est pas une mesure de tas V8 et ne doit pas être comparée comme un comptage exact de mémoire.

29 programmes de tests passent : worker réel, collisions, liquides, cache de terrain, apparences, neuf explosions dans trois qualités, cycle de vie, hors-champ, historique et API IndexedDB via fake-indexeddb. Le moteur Three et Quarks est exécuté, mais le GPU est simulé dans ces tests.

Limite de validation : aucun relevé de FPS ni contrôle visuel WebGL réel. Le lanceur Chromium disponible ne possède pas son binaire et le téléchargement du navigateur est refusé par le réseau. Vérifier le rendu sur le poste de jeu avant fusion et déploiement. Les optimisations ne suppriment pas le coût d’un grand nombre de lumières, d’observateurs ou de blocs modifiés simultanément.

## Lancer le ZIP

Décompresser puis lancer `python3 -m http.server 8000` dans son dossier. Ouvrir `http://localhost:8000/`. Les modules, workers et IndexedDB demandent un serveur HTTP ; ne pas ouvrir directement le fichier HTML. Pour les tests : `npm ci`, puis `npm test`.
