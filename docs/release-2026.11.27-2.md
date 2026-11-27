# Brume v2026.11.27-2 — 27 novembre 2026

## Atelier d’effets composés

Construire → E → À lancer : 24 presets. Équiper un preset puis ouvrir Réglages (R). La prévisualisation au viseur utilise le décor actuel et ne détruit aucun bloc.

Chaque couche dispose d’un effet, d’une forme, d’une couleur, d’une intensité, d’une taille, d’un délai et d’une durée. Les délais partent de l’impact du projectile. Plusieurs couches ayant le même délai sont simultanées. « Tout ensemble » place les délais à zéro ; « Enchaîner » les calcule à partir des durées. Les couches peuvent être désactivées, dupliquées ou retirées. La chronologie affiche leur intervalle d’activité.

Enregistrer conserve le preset dans le monde, avec sa portée, sa vitesse, son rayon et ses réglages visuels. Enregistrer une copie crée un nouveau preset. Les presets personnels réapparaissent dans À lancer et restent présents après rechargement, import/export ou annulation. Un créneau équipé garde sa propre copie si le preset est supprimé.

### Catalogue

24 presets : explosion classique, feu, givre, foudre, arcane, poussière, toxique, sacré, implosion du néant, trou noir, mirage thermique, onde de pression, supernova, éruption volcanique, onde glaciaire, tempête électrique, plasma, météore, nuage alchimique, jugement céleste, singularité instable, triple choc sonique, rupture cubique et souffle des sables.

12 effets élémentaires combinables et 7 formes : sphère, dôme, anneau, colonne, cône, cube et disque. Distorsion et trou noir conservent leur lentille circulaire. Les corps d’explosion utilisent des géométries distinctes ; les émissions de particules suivent les formes adaptées.

### Portée et lancers

- Portée indépendante de celle de la construction ; valeur initiale 48 cases. `0` signifie sans limite de distance sur la carte active. La destination reste une surface visée de la carte, pas un point arbitraire dans le ciel.
- Vitesse réglable de 0,1 à 300 cases/s. Le temps de vol dépend de la distance.
- Aucun plafond de projectiles simultanés. La file accepte notamment 100 lancers dans les tests.
- Toutes les couches d’un lancer partagent un seul impact physique : elles ne multiplient pas les destructions. Les formes sont visuelles. Le rayon destructeur de 1 à 6 cases, la protection des calques et la limite de 512 blocs par impact restent en place. Décocher « Affecter les blocs » conserve uniquement les effets.

## Distorsion et trou noir

Les shaders échantillonnent l’image réellement rendue. La distorsion déplace le décor en vagues ; le trou noir ajoute une déviation radiale, une rotation, un horizon sombre et un disque lumineux animé. Il s’agit d’effets visuels, sans gravité physique sur les personnages.

Le moteur dessine la scène une fois, copie sa couleur dans une texture commune, puis dessine les lentilles en conservant le tampon de profondeur. Il ne redessine pas le monde pour chaque trou noir. Le tampon couleur est libéré lorsqu’il n’y a plus de lentille.

## Charge et validation

Les lancers ne sont pas refusés en fonction de leur nombre. Les effets proches disposent de 16, 24 ou 32 places de rendu détaillé selon la qualité ; les suivants restent visibles sous une forme simplifiée et instanciée. Les animations hors champ n’allouent pas de rendu. La file logique, les délais et les impacts restent actifs. Aucun réglage ne garantit une fluidité illimitée avec un nombre arbitraire de lancers.

32 programmes de tests : recettes, portée, vitesse, couches simultanées/différées, absence de plafond de lancers, absence de destruction répétée, pauses entre couches, sauvegarde, interface, budgets visuels, profondeur et libération des ressources, en plus des régressions de la version précédente.

Le test `npm run test:browser` couvre le démarrage réel, les 24 presets, l’édition, la sauvegarde IndexedDB après rechargement et 84 combinaisons d’effets/formes en WebGL. Exécution locale avec Chromium et SwiftShader : il s’agit d’un rendu WebGL logiciel, pas d’un relevé de FPS sur une carte graphique de joueur.

Pour relancer : `npm ci`, `npm test`. Pour le navigateur, installer Chromium avec `npx playwright-core install chromium`, puis `npm run test:browser`, ou définir `BRUME_CHROMIUM` avec son exécutable. Le script peut produire des captures locales via `BRUME_SCREENSHOTS`.

ZIP : `npm run release`. Décompresser puis lancer `python3 -m http.server 8000` et ouvrir `http://localhost:8000/`. Le manifeste RELEASE.json contient la version, le commit et les SHA-256.
