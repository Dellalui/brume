# Textures de matériaux — Les Brumes

Ces 16 fichiers JPEG de 1024 × 1024 pixels sont les cartes couleur/diffuse originales
de Poly Haven et ambientCG, téléchargées le 26 novembre 2026. Leurs octets n’ont pas
été retouchés, redimensionnés ou recompressés. Les fichiers portent uniquement un
nom local stable. Aucun CDN n’est requis lors de l’utilisation du site.

Les fichiers couleur ont été extraits seuls des archives 1K d’ambientCG ; les autres
cartes PBR, modèles et archives de téléchargement ne sont pas embarqués.

## Origines et licences

Tous les matériaux sont publiés sous **CC0 1.0 Universal** par leurs fournisseurs.
Les conditions officielles autorisent notamment l’intégration et la redistribution
des fichiers sources. L’attribution n’est pas exigée ; les origines sont conservées
ici pour la traçabilité.

- Poly Haven : https://polyhaven.com/license
- ambientCG : https://docs.ambientcg.com/license/
- Texte CC0 : https://creativecommons.org/publicdomain/zero/1.0/legalcode

`sources.json` conserve les clés, noms locaux, identifiants d’assets, pages sources,
URLs exactes de téléchargement, dimensions, tailles et empreintes SHA-256.

| Clé / fichier | Matière | Asset original | Fournisseur |
| --- | --- | --- | --- |
| `grass` / `grass.jpg` | Herbe dense | [Grass004](https://ambientcg.com/view?id=Grass004) | ambientCG |
| `dirt` / `dirt.jpg` | Terre et petits cailloux | [brown_mud_rocks_01](https://polyhaven.com/a/brown_mud_rocks_01) | Poly Haven |
| `sand` / `sand.jpg` | Sable | [sand_01](https://polyhaven.com/a/sand_01) | Poly Haven |
| `gravel` / `gravel.jpg` | Gravier | [gravel_floor_02](https://polyhaven.com/a/gravel_floor_02) | Poly Haven |
| `stone` / `stone.jpg` | Roche | [rock_face](https://polyhaven.com/a/rock_face) | Poly Haven |
| `cobble` / `cobble.jpg` | Pavés | [cobblestone_floor_02](https://polyhaven.com/a/cobblestone_floor_02) | Poly Haven |
| `brick` / `brick.jpg` | Briques | [red_brick](https://polyhaven.com/a/red_brick) | Poly Haven |
| `sandstone` / `sandstone.jpg` | Blocs de grès | [sandstone_blocks_04](https://polyhaven.com/a/sandstone_blocks_04) | Poly Haven |
| `wood` / `wood.jpg` | Planches de bois | [wooden_planks](https://polyhaven.com/a/wooden_planks) | Poly Haven |
| `bark` / `bark.jpg` | Écorce | [bark_brown_02](https://polyhaven.com/a/bark_brown_02) | Poly Haven |
| `leaves` / `leaves.jpg` | Végétation de sol et feuilles | [leafy_grass](https://polyhaven.com/a/leafy_grass) | Poly Haven |
| `snow` / `snow.jpg` | Neige | [snow_02](https://polyhaven.com/a/snow_02) | Poly Haven |
| `marble` / `marble.jpg` | Marbre | [marble_01](https://polyhaven.com/a/marble_01) | Poly Haven |
| `metal` / `metal.jpg` | Plaque métallique | [metal_plate](https://polyhaven.com/a/metal_plate) | Poly Haven |
| `ice` / `ice.jpg` | Glace | [Ice004](https://ambientcg.com/view?id=Ice004) | ambientCG |
| `lava` / `lava.jpg` | Lave | [Lava001](https://ambientcg.com/view?id=Lava001) | ambientCG |

## Références de rendu

- [Three.js — Texture](https://threejs.org/docs/pages/Texture.html) : UV, répétition, rotation, filtres, anisotropie et espace couleur.
- [Three.js — Textures](https://threejs.org/manual/pages/textures.html) : répétition et filtrage des textures.
- [Unity Labs — Procedural Stochastic Texturing](https://unity.com/blog/engine-platform/procedural-stochastic-texturing-in-unity) : mélange continu pour limiter la répétition des textures naturelles.
- [Deliot / Heitz — Procedural Stochastic Textures by Tiling and Blending](https://eheitzresearch.wordpress.com/738-2/) : publication et démonstration des auteurs.

Le mélange stochastique convient surtout aux matières irrégulières (herbe, terre,
sable, roche). Les planches, briques et joints de pavés demandent une orientation
cohérente. Tourner indépendamment des carrés d’image sans mélange peut produire
des coutures ; une image répétable seule ne garantit pas des bords compatibles
après rotation. Une adaptation sans prétraitement d’histogramme ni LUT ne constitue
pas l’implémentation complète de la technique publiée.

L’herbe retenue est Grass004 : une herbe dense et verte, choisie après inspection
visuelle. Sparse Grass, trop clairsemée et brune pour la plaine, a été écartée.
Foliage001, qui est un atlas de brins à détourer et non une surface répétable,
a également été écartée. Le matériau `leaves` correspond à une végétation de sol,
pas à une feuille isolée avec transparence.
