# 00 — Guide d'exécution dans Codex

Ce pack est conçu pour être **copié à la racine du dépôt du jeu**. Codex doit ensuite lire le pack, inspecter le projet existant, générer les visuels, les intégrer et les tester.

## Ce que le pack fait

Il donne à Codex :
- une référence graphique finale ;
- les captures du greybox pour conserver caméra et proportions ;
- la liste des personnages, bâtiments, biomes, transitions, saisons, UI et FX à produire ;
- des règles strictes d'intégration ;
- des manifests JSON permettant de vérifier qu'aucun groupe d'assets n'est oublié ;
- un prompt maître qui lui demande de poursuivre jusqu'à l'intégration complète et au QA.

## Installation

1. Dézipper le pack.
2. Copier **tout son contenu** à la racine du dépôt du jeu, au même niveau que les fichiers principaux du projet.
3. Ne pas supprimer ni écraser un `AGENTS.md` déjà existant.
4. Si le dépôt possède déjà `AGENTS.md`, copier dedans uniquement le contenu de `visual_codex/AGENTS_VISUAL_SNIPPET.md` si utile.
5. Ouvrir le dépôt complet dans Codex.
6. Vérifier que Codex voit :
   - `CODEX_MASTER_PROMPT.md`
   - `visual_codex/`
   - `.agents/skills/election-game-art/SKILL.md`
7. Dans le chat Codex, envoyer :
   **« Exécute intégralement CODEX_MASTER_PROMPT.md. Utilise le skill election-game-art et ne t'arrête pas après le golden sample. »**
8. Laisser Codex inspecter le projet et travailler par lots.

## Avant le run complet

Si tu veux réduire le risque, fais une copie/git commit du projet avant le run. Le prompt demande à Codex de préserver le gameplay, mais une refonte visuelle complète touche forcément beaucoup de fichiers de rendu et d'assets.

## Ce que Codex doit faire automatiquement

- détecter le moteur/framework ;
- trouver les systèmes de rendu existants ;
- installer/brancher un pipeline d'assets compatible avec le projet ;
- créer un golden sample ;
- générer les personnages et animations ;
- générer les bâtiments dans **6 variantes architecturales par biome** ;
- générer les 18 sous-zones ;
- réaliser les 6 raccords entre biomes ;
- produire les variantes saisonnières ;
- créer UI, cartes d'événements et FX ;
- remplacer les rendus greybox par les assets finaux sans modifier les règles ;
- lancer le jeu ;
- prendre des captures ;
- corriger les incohérences ;
- conserver un fallback greybox si un asset manque ;
- produire un rapport final.

## Point de contrôle critique : bâtiments

Le jeu ne doit jamais faire :

`vide -> paiement -> apparition du bâtiment`

Il doit faire :

`bâtiment neutre déjà visible -> paiement/capture -> même bâtiment prend les couleurs du candidat`

En plus, un même type de bâtiment ne doit pas être copié à l'identique dans les 6 biomes. Il possède :

- un **gabarit fonctionnel commun** ;
- un **skin architectural propre au biome** ;
- un **habillage propriétaire** dynamique ;
- des **états/niveaux** superposés sans modifier la hitbox.

Exemple : une Permanence doit être reconnaissable comme Permanence partout, mais peut être un local de pied d'immeuble en Banlieue, une ancienne boutique de bourg en Campagne et une façade en pierre plus chic dans les Quartiers riches.

## Point de contrôle critique : transitions

Le monde est une boucle. Les frontières suivantes doivent être fondues et non coupées :

Bobo -> Banlieue -> Périurbain -> Campagne -> Retraités -> Quartiers riches -> Bobo.

Codex doit vérifier chacune des 6 frontières dans le jeu en mouvement et pas seulement dans les fichiers image.

## Si Codex s'arrête trop tôt

Relancer avec :

« Continue le run de CODEX_MASTER_PROMPT.md à partir du dernier checkpoint. Ne fais pas un rapport final tant que les phases restantes ne sont pas produites, intégrées et testées. »

## Si les bâtiments apparaissent encore au moment de l'achat

Relancer avec :

« La règle fondamentale des sites n'est pas respectée. Tous les sites stratégiques doivent être instanciés visuellement au chargement dans leur état neutre. La capture doit seulement changer owner/state/level et les layers visuels. Aucun bâtiment ne doit être instancié au moment de l'achat. Corrige le runtime, puis vérifie ce comportement dans chaque biome avant de poursuivre. »
