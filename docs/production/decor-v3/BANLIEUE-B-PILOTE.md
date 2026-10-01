# Banlieue B — première correction peinte

Ce pilote remplace la composition rejetée de Banlieue B dans le décor « Panoramas world-v2 ». Les autres sous-zones conservent leur rendu actuel ; elles ne sont pas validées par cette correction.

## Résultat

Le marché populaire est visible : étals, fruits, caisses et auvents restent dégagés autour de la place. La rue retrouve les maisons anciennes et la perspective du panorama d’origine. Les barres d’habitation répétées et le grillage fleuri de Banlieue B ont été retirés. La permanence utilise la porte et le panneau peints dans la nouvelle rue, à la position du jeu : 22 % de la sous-zone.

Le décor utilise une rue peinte continue, à vitesse normale, et un fond de ville avec la basilique, à 35 % de cette vitesse. Le ciel est celui du moteur. Cette projection est linéaire : le fond n’accélère plus près des bords de la caméra. Il reste limité au territoire de Banlieue B. Les façades de la rue suivent leurs contours transparents et se prolongent légèrement sur les voisines ; elles ne sont plus coupées au bord d’un rectangle.

Les positions de gameplay, la carte, le zoom et le cadrage du jeu n’ont pas été modifiés. L’aperçu respecte maintenant le cadre 16:9 utilisé par le jeu, aussi sur téléphone en portrait ; l’ancien aperçu remplissait toute la hauteur et faussait les proportions dans ce format.

## Images et production

- Référence conservée : `assets/generated/world-v2/panorama-banlieue.png`.
- Rue corrigée : `assets/generated/world-v2/banlieue-b-rue-v3.png` — 2 172 × 724 px, transparence conservée.
- Ville et basilique : `assets/generated/world-v2/banlieue-b-fond-v3.png` — 2 170 × 725 px, transparence conservée.
- Outil utilisé : `image_gen` intégré, conformément à la compétence imagegen.
- Prompts complets, dont la correction de la rue : `docs/production/decor-v3/banlieue-b-pilot-prompts.json`.
- Repères mesurés et rendu : `src/presentation/world-v2-market.js`. L’échelle est uniforme sur les deux axes et la porte sert de référence ; aucune image n’est étirée pour remplir une largeur.

Les nouveaux fichiers sont exportés pour le web. Ils restent exclus du paquet Android, qui n’embarque que le décor par défaut, comme les autres images world-v2 de betatest.

## Vérifications

- 39 tests ciblés réussis : carte/bâtiments, assets, export et rendu world-v2. Un contrôle WebP a été ignoré car ffmpeg avec libwebp n’est pas disponible dans ce terminal ; aucun export WebP final n’est revendiqué ici.
- Contrôles dans le navigateur : 357 assets chargés, aucune erreur ni image manquante, 21 enseignes conservées, position de la permanence à 22 %, porte nominale à 1,15 personnage, vitesses mesurées du fond à 0,35 au centre et aux deux extrémités.
- Inspection des vues centre, gauche, droite, entrée, sortie et sous-zones voisines ; captures d’hiver, de téléphone en paysage et de téléphone en portrait.
- Comparaison avec la composition rejetée au même cadrage, produite en réactivant uniquement dans le navigateur de validation les anciens remplissages et sprites de Banlieue B.

Les captures se trouvent dans `artifacts/world-v2-pilot/`, notamment `avant-apres.png`, `centre.png`, `entree.png`, `sortie.png` et `rapport.json`. La validation peut être rejouée avec `scripts/validate-world-v2-market.mjs`, en fournissant le chemin des dépendances Playwright dans `CAMPAIGN_TEST_NODE_MODULES`.

## Ce qu’il reste à corriger

Cette rue est une première correction locale, pas la livraison des 18 sous-zones. Les plans des autres quartiers utilisent encore l’ancienne projection bornée et les anciens assemblages. Banlieue A et C doivent notamment retrouver leurs implantations propres ; les raccords complets du biome nécessitent leur reprise, ainsi que les transitions vers Paris et le Périurbain.

Le marché laisse le meeting fonctionner et ses stands restent visibles, mais la composition de toutes les marges de la place reste à apprécier avec une foule complète. Ce pilote n’est pas présenté comme la validation de l’ensemble des cinq plans, des détails du CDC et des 18 sous-zones.
