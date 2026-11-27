# Construire et jouer dans Les Brumes

## Construction créative du MJ

Ouvrez **Construire**, puis **Entrer en construction** pour capturer la souris. **E** ouvre l’inventaire et libère la souris ; fermez-le pour reprendre. Le clic d’entrée ne casse rien. Les neuf créneaux restent au bas de l’écran ; chacun conserve ses propres dimensions et son angle.

| Commande | Action |
|---|---|
| E ou I | Ouvrir / fermer l’inventaire |
| 1 à 9, molette | Choisir le créneau tenu |
| Clic gauche | Casser l’élément visé ; maintenir pour continuer |
| Clic droit | Poser l’élément tenu ; maintenir pour continuer |
| R | Régler l’objet ou le pinceau tenu dans l’inventaire |
| T / Maj + T | Tourner la pose de 45° dans les deux sens |
| Souris capturée | Regarder et viser avec le réticule |
| Clic molette | Prélever le matériau ou le décor visé |
| Échap | Libérer la souris sans quitter la construction |
| Flèches, WASD / ZQSD | Voler ; Clavier auto utilise les positions physiques |
| Espace / Maj | Monter / descendre |
| Ctrl pendant la capture | Accélérer le vol |
| Ctrl + molette | Avancer / reculer la caméra sans changer de créneau |
| Ctrl + Z / Ctrl + Maj + Z | Annuler / rétablir |

L’item **Inspecteur** sélectionne l’élément visé, libère la souris et ouvre ses propriétés. **V** équipe cet inspecteur. Les commandes de casse et de pose s’appliquent aux créneaux de construction, pas aux menus ni aux champs de saisie.

### Blocs et murs

Les murs se construisent avec les mêmes matériaux que les blocs : longueur, épaisseur et hauteur se règlent de **0,1 à 32**, par pas de 0,1. Exemple : longueur 4, épaisseur 0,2, hauteur 2,7. L’angle accepte une valeur précise. Le pas de placement vaut 1 ou 0,1.

**Suivre la face** aligne la pièce sur le bloc visé pour joindre des murs orientés sans marches d’escalier. Décochez cette option pour imposer votre angle. **Angle en L** pose deux volumes raccordés, sans faces superposées. Un aperçu transparent montre la pose ; le rouge indique un emplacement interdit.

Les 48 matériaux comprennent gazon, terre, pierre, bois, verre et matériaux infernaux. Verre et glace laissent passer la vue mais bloquent le déplacement. Les images restent importables dans les propriétés d’un bloc pour texturer ses faces. L’eau et la lave restent décoratives, sans écoulement ni dégâts automatiques.

Les anciens murs restent lisibles dans les cartes existantes ; ils ne sont plus proposés dans le nouvel inventaire. Les modèles 3D de mobilier, végétation et autres décors restent disponibles.

### Portes

Quatre modèles : chêne, renforcée, vitrée et barreaux. Taille initiale **1 de large × 2 de haut**, dimensions et angle modifiables avant pose. En construction, le clic droit pose toujours. F actionne une porte proche du personnage contrôlé ; ses propriétés permettent aussi de l’ouvrir. En jeu, cliquez la porte. Une porte ne se ferme pas sur un personnage.

### Zones, groupes et schémas

Dans Inventaire → Zone, équipez la sélection : clic gauche pour le coin A, clic droit pour le coin B. Réglez la base et la hauteur sans fermer l’inventaire.

- **Enregistrer le schéma** conserve les blocs, matériaux, rotations, décors et images de la zone. Les personnages sont inclus uniquement si l’option est cochée.
- Le schéma apparaît dans l’inventaire, s’équipe dans un créneau et se pose par clic droit. Chaque pose crée de nouveaux identifiants et son propre groupe dans les calques.
- **Regrouper la zone** rassemble une construction existante. Les blocs posés seuls ne créent pas de lignes dans les calques.
- Seuls les éléments entièrement inclus dans la zone sont retenus. Un schéma contient au plus 4 096 éléments ; l’aperçu montre au plus 96 éléments. La pose conserve l’ensemble.

Les schémas et les créneaux sont enregistrés avec la campagne dans ce navigateur. Les outils d’édition sont dans **Inventaire → Outils**. Équipez un pinceau ou une baguette, puis **R** pour configurer :

- Pinceaux de blocs, remplacement et terrain ; largeur de 1 à 9 cases.
- Volume plein, sphère, coque creuse ou murs seuls.
- Filtre : tout, air, blocs existants ou un matériau précis.
- Motifs pondérés totalisant 100 %, avec graine reproductible. L’air retire les blocs : exemple 20 % terre, 10 % bois, 70 % air.
- Baguette : gauche définit A, droit définit B, coins inclus. L’onglet Zone permet de prévisualiser, appliquer ou vider, puis d’annuler en une fois.
- Brouillard manuel : gauche révèle, droit masque. Pipette et cadre à image sont aussi des items.

Les modifications de volume sont limitées à 32 768 cubes par opération. Les groupes verrouillés sont protégés et aucun remplissage solide n’emprisonne les personnages. Un bloc personnalisé qui traverse la limite du volume est conservé. La baguette et les pinceaux travaillent par cubes ; les blocs individuels conservent leurs dimensions au dixième.

Le clic gauche creuse aussi le sol naturel, jusqu’à −16. Creuser une paroi laisse la terre au-dessus en place pour faire des cavités. Le relief reste statique : pas d’effondrement ni de simulation de fluides.

## Personnages et caméra

Le MJ utilise une caméra libre en première personne. Sélectionnez un personnage puis **Contrôler** pour passer à la troisième personne et à sa vision. Le personnage se déplace au clic par recherche de chemin ; les touches déplacent la caméra, pas le pion.

La caméra peut regarder jusqu’à six cases autour du cadrage du personnage. Son déplacement la recentre. **Revenir au MJ** restaure le cadrage libre. Les personnages 2D restent verticaux, quelle que soit l’inclinaison de la caméra.

Noms et ressources se lisent à taille fixe à l’écran. Propriétés permet d’afficher les PV et d’ajouter des barres avec nom, couleur, maximum et visibilité indépendants. Les informations cachées ne sont pas affichées en vue personnage.

## Autres outils

Cartes indépendantes, extensions et retraits confirmés, passages, groupes, initiative et combat, effets temporaires et persistants, auras, lumière, brouillard, notes et dés restent disponibles dans leurs panneaux.

La vision respecte les hauteurs, obstacles, portes et réglages de regard. Le dégagement transparent de la caméra ne donne pas une vision à travers les murs. Le terrain reste borné entre −16 et +32. Les lumières et effets sont simplifiés ; il ne s’agit pas d’une illumination globale physique.

Les modifications sont enregistrées localement. Une sauvegarde illisible est copiée avant un chargement de secours ; si cette copie est impossible, l’écriture est suspendue. Il n’y a pas encore de synchronisation multijoueur ni d’export complet de campagne avec ses images.


## Presets et lancers composés

Construire → E → À lancer : 24 presets. R ouvre la portée (0 = sans limite), la vitesse et le compositeur. Ajouter, dupliquer ou désactiver des couches ; régler leurs délais et durées ; Tout ensemble ou Enchaîner. Les presets personnels sont enregistrés dans le monde. Prévisualiser au viseur ne détruit rien. Les formes visuelles sont indépendantes du rayon affectant les blocs. Les distorsions et trous noirs déforment le décor. Aucun plafond de lancers simultanés ; le rendu se simplifie sous forte charge.
