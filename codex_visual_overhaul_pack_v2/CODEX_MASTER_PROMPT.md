# PROMPT MAÎTRE À DONNER À CODEX

Je veux que tu réalises **de bout en bout** la refonte visuelle complète de ce jeu, puis que tu l'intègres dans le jeu existant.

Tu dois utiliser les capacités de génération/modification d'images disponibles dans Codex, ainsi que les outils de navigateur/jeu web disponibles pour inspecter le jeu en localhost, prendre des captures, comparer le rendu et corriger les problèmes.

OpenAI documente que Codex peut générer et modifier des images et qu'il peut utiliser des skills de génération d'images pour créer des assets de jeu. Utilise donc le skill de génération d'images disponible dans ton environnement. Si plusieurs skills sont disponibles, utilise le skill officiel/courant de génération d'images. N'utilise pas un service externe payant sans instruction explicite.

IMPORTANT : ne t'arrête PAS après avoir écrit un plan, généré un seul biome ou produit quelques sprites. Le but de ce run est :
1. inspecter le dépôt ;
2. établir le pipeline ;
3. produire les assets ;
4. les intégrer ;
5. tester ;
6. corriger ;
7. livrer le jeu visuellement refondu.

Tu peux travailler par phases internes et checkpoints, mais continue automatiquement jusqu'à la fin si les outils sont disponibles.

---

## 0. Lis d'abord le pack

Lis intégralement :

- `README_FIRST.md`
- `visual_codex/docs/00_EXECUTION_GUIDE.md`
- `visual_codex/docs/01_ART_DIRECTION.md`
- `visual_codex/docs/02_CAMERA_AND_COMPOSITION.md`
- `visual_codex/docs/03_CHARACTERS_AND_ANIMATIONS.md`
- `visual_codex/docs/04_BUILDINGS_AND_SITES.md`
- `visual_codex/docs/05_BIOMES.md`
- `visual_codex/docs/06_BIOME_TRANSITIONS.md`
- `visual_codex/docs/07_SEASONS.md`
- `visual_codex/docs/08_UI_AND_EVENTS.md`
- `visual_codex/docs/09_FX_AND_COMBAT.md`
- `visual_codex/docs/10_ASSET_GENERATION_PIPELINE.md`
- `visual_codex/docs/11_RUNTIME_IMPLEMENTATION.md`
- `visual_codex/docs/12_QA_AND_ACCEPTANCE.md`
- `visual_codex/docs/13_PROMPT_TEMPLATES.md`
- `visual_codex/docs/14_BUILDING_BIOME_VARIANTS.md`

Puis charge :

- `visual_codex/config/visual_pipeline_config.json`
- `visual_codex/config/asset_manifest.json`
- `visual_codex/config/biome_transition_map.json`
- `visual_codex/config/character_animation_manifest.json`
- `visual_codex/config/building_visual_states.json`
- `visual_codex/config/ui_asset_manifest.json`
- `visual_codex/config/building_biome_matrix.json`

Référence artistique obligatoire :
- `visual_codex/references/STYLE_TARGET.png`

Références de caméra/gameplay :
- `visual_codex/references/GREYBOX_01.png`
- `visual_codex/references/GREYBOX_02.png`

---

## 1. Inspecte le jeu avant toute modification

- Détecte le framework/moteur, le renderer, le système d'assets, la résolution logique et le système de caméra.
- Identifie où sont rendus :
  - personnages ;
  - bâtiments/sites ;
  - arrière-plans ;
  - props ;
  - UI ;
  - événements ;
  - effets de combat.
- Identifie les données existantes de :
  - biome ;
  - sous-zone ;
  - saison/jour ;
  - propriétaire du site ;
  - niveau ;
  - état neutral/captured/closing/closed ;
  - faction ;
  - rôle PNJ ;
  - événements actifs.
- Lance le jeu actuel et prends des captures de référence.
- Vérifie `git status`. Ne détruis ni ne reset les modifications existantes de l'utilisateur.

Ne modifie pas le gameplay tant que tu n'as pas compris comment la présentation s'y branche.

---

## 2. Règle absolue : gameplay inchangé

La refonte est d'abord VISUELLE.

Ne change pas volontairement :
- vitesse de déplacement ;
- hitboxes ;
- spawn ;
- influence ;
- économie ;
- combat ;
- IA ;
- timing d'événements ;
- règles de capture ;
- règles de fermeture ;
- logique QG/Permanence ;
- calendrier ;
- logique de saison.

Si une modification technique est nécessaire pour brancher les visuels, préserve les valeurs et comportements autoritaires.

---

## 3. Direction artistique

La DA principale est `STYLE_TARGET.png`.

Je veux :
- illustration 2D française caricaturale ;
- rendu BD/cartoon dessiné à la main ;
- contours sombres propres ;
- aplats et textures légères ;
- architecture française identifiable ;
- lumière agréable et colorée ;
- satire visuelle légère ;
- détails suffisants pour donner de la vie ;
- excellente lisibilité sur téléphone ;
- PAS de photoréalisme ;
- PAS de pixel art ;
- PAS de 3D réaliste ;
- PAS de style générique corporate.

Les personnages réels doivent être caricaturaux et reconnaissables, sans chercher le portrait photoréaliste.

Réutilise la palette de faction existante du jeu si elle est déjà définie :
- Mélenchon = rouge ;
- Le Pen = bleu marine ;
- Philippe = blanc/gris/anthracite.

---

## 4. La composition du greybox reste la référence de gameplay

La DA cible ne doit PAS changer la quantité de terrain visible.

Respecte notamment :
- vue latérale ;
- caméra centrée sur le joueur ;
- sol très bas dans l'écran ;
- très peu d'espace sous la ligne de sol ;
- personnages relativement petits ;
- assez d'espace latéral pour voir PNJ, bâtiments et front ;
- pas de bâtiment géant qui bouche tout ;
- pas de zoom cinématique permanent.

La référence artistique donne le STYLE.
Le greybox donne la COMPOSITION.

---

## 5. Produis les assets par lots cohérents

Ordre obligatoire :

### Phase A — fondations
- système de chemins/assets ;
- registry/manifest runtime ;
- loaders ;
- fallback greybox si asset manquant ;
- utilitaires de préchargement ;
- instrumentation debug.

### Phase B — "golden sample" interne
Produis et intègre :
- 1 candidat ;
- 1 PNJ ;
- 1 bâtiment neutre + capturé ;
- 1 sous-zone complète ;
- 1 transition vers la sous-zone suivante.

Fais toi-même le QA visuel.
Si les proportions/style ne respectent pas les specs, corrige.
NE demande pas l'approbation utilisateur : une fois conforme aux critères du pack, continue.

### Phase C — personnages
Génère/intègre tous les personnages listés dans les manifests.

### Phase D — bâtiments et services
Génère/intègre tous les sites, leurs états et niveaux.

**EXIGENCE ABSOLUE : chaque type de bâtiment/site doit avoir une base architecturale différente dans chacun des 6 biomes.** Lis `14_BUILDING_BIOME_VARIANTS.md` et `building_biome_matrix.json`. Ne réutilise jamais le même sprite de façade dans les 6 biomes avec une simple recoloration. Conserve en revanche le même gabarit de gameplay, la même ancre au sol, la même zone d'interaction et une silhouette de famille reconnaissable.

Produis/registre au minimum les 42 bases architecturales correspondant à 7 types de sites × 6 biomes, même si la carte finale n'utilise pas toutes les combinaisons. Les overlays de propriétaire/niveau/état peuvent être mutualisés lorsque le moteur le permet.

### Phase E — 18 sous-zones + transitions
Génère/intègre l'ensemble des biomes en respectant les contrats de transition.

### Phase F — saisons
Ajoute ciel, arbres et overlays saisonniers.

### Phase G — UI / événements / FX
Finalise l'interface illustrée, les icônes, le combat et les événements.

### Phase H — optimisation / QA
Teste toutes les sous-zones, les saisons, les transitions et les états.

---

## 6. TRANSITIONS ENTRE BIOMES — EXIGENCE MAJEURE

Il ne doit y avoir AUCUN cut brutal du type :
"quartier riche" → une frame plus tard → "quartier bobo complètement différent".

Le monde est une boucle continue.

Lis `visual_codex/docs/06_BIOME_TRANSITIONS.md` et `visual_codex/config/biome_transition_map.json`.

Pour chaque frontière :
- Bobo → Banlieue
- Banlieue → Périurbain
- Périurbain → Campagne
- Campagne → Retraités
- Retraités → Quartiers riches
- Quartiers riches → Bobo

gère une continuité de :
- horizon ;
- trottoir/route ;
- échelle des immeubles ;
- densité urbaine ;
- végétation ;
- mobilier ;
- palette ;
- éléments architecturaux.

Les derniers 15–25 % visuels de la sous-zone sortante doivent annoncer le biome suivant.
Les premiers 15–25 % de la sous-zone entrante doivent encore contenir des éléments du biome précédent.

La boucle Riches → Bobo doit être aussi propre que les autres.

Précharge le biome voisin suffisamment tôt pour qu'aucun asset ne "pop" au passage de frontière.

---

## 7. Bâtiments : aucun spawn visuel lors d'une capture

Point critique :

LES SITES EXISTENT DÉJÀ VISUELLEMENT AU DÉBUT.

Un achat/capture ne doit jamais faire apparaître magiquement un nouveau bâtiment.

Le bâtiment neutre est déjà présent.

La capture ne fait que changer :
- owner ;
- état visuel ;
- enseigne/overlay ;
- couleurs ;
- drapeaux/affiches ;
- éventuellement lumières ;
- niveau.

Même footprint.
Même façade de base.
Même position.

Neutral → faction doit être une TRANSFORMATION VISUELLE du même site.

Si le jeu actuel instancie encore le bâtiment au moment de l'achat, corrige la couche de rendu pour pré-instancier/afficher tous les sites du layout dès le chargement du monde, sans changer la logique autoritaire des sites.

---

## 8. Génération : cohérence avant quantité

À chaque génération :
- utilise `STYLE_TARGET.png` comme référence visuelle ;
- garde le même langage de traits, proportions et textures ;
- ne bake pas de texte indispensable dans l'image ;
- réserve les panneaux/enseignes mais rends le texte avec HTML/canvas/code ;
- privilégie PNG transparent pour personnages/props/overlays ;
- utilise un format optimisé pour les gros backgrounds si le framework le permet ;
- conserve les masters haute qualité avant optimisation.

Pour les candidats :
1. crée d'abord un master cohérent ;
2. dérive les animations à partir de ce master ;
3. ne génère pas chaque animation comme un nouveau personnage indépendant.

Pour les PNJ :
- diversité de silhouettes, vêtements et accessoires ;
- ne lie jamais une ethnie/couleur de peau à un biome ;
- varie les apparences dans tous les biomes ;
- les différences de biome passent surtout par vêtements, accessoires et décor.

---

## 9. Animations

Implémente les animations requises par le manifest :
- idle ;
- walk/run ;
- persuasion ;
- interact/hold ;
- attaques ;
- hurt ;
- knockback ;
- KO ;
- meeting ;
- spécial.

Tu peux utiliser :
- spritesheets ;
- frames séparées ;
- petites déformations/transformations runtime ;
selon ce qui s'intègre le mieux au moteur existant.

Ne change pas les timings de gameplay pour s'adapter aux images.
Adapte l'animation aux timings existants.

---

## 10. Performances mobile

Objectif :
- 60 FPS sur appareil correct ;
- dégradation acceptable à 30 FPS ;
- pas de chargement massif des 18 sous-zones en textures pleine résolution si inutile.

Charge/précharge :
- sous-zone actuelle ;
- sous-zone précédente/suivante ;
- assets globaux partagés.

Décharge ou garde en cache raisonnable le reste selon le framework.

Utilise atlas/compression/lazy loading si pertinent.

Les transitions ne doivent jamais révéler une texture absente.

---

## 11. QA visuel obligatoire

À la fin de chaque grande phase :
- lance le jeu ;
- navigue réellement ;
- prends des captures ;
- vérifie contre `STYLE_TARGET.png` et les greybox ;
- corrige les problèmes.

Teste au minimum :
- 16:9 desktop ;
- paysage téléphone large ;
- une résolution plus basse.

Vérifie :
- taille des personnages ;
- ground line ;
- clipping ;
- z-index ;
- bâtiments capturés ;
- fermeture/re-neutralisation ;
- changement de QG ;
- saisons ;
- transitions ;
- event cards ;
- damage vignette ;
- special FX.

---

## 12. Critères de fin

Ne considère pas la tâche terminée tant que :

- les 18 sous-zones ont un habillage final ;
- les 6 transitions de biome sont continues ;
- la boucle complète n'a pas de couture visuelle flagrante ;
- les 3 candidats ont leurs animations principales ;
- les PNJ ont suffisamment de variété ;
- les bâtiments n'apparaissent plus au moment d'une capture ;
- les sites neutres/capturés/niveaux/fermetures sont visuellement distincts ;
- les saisons fonctionnent ;
- les UI/événements ont un habillage cohérent ;
- les FX de combat/spéciaux sont intégrés ;
- le jeu reste jouable et performant ;
- aucune régression majeure n'a été introduite.

---

## 13. Livrables à créer dans le dépôt

Crée/maintiens :
- dossier final d'assets selon le framework détecté ;
- registry/manifest runtime si nécessaire ;
- `visual_codex/GENERATED_ASSET_REPORT.md` ;
- `visual_codex/VISUAL_IMPLEMENTATION_REPORT.md` ;
- `visual_codex/QA_SCREENSHOT_INDEX.md` ;
- `visual_codex/generated_asset_registry.json` ;
- captures QA dans `visual_codex/qa_screenshots/`.

Dans le rapport final, indique :
1. assets générés ;
2. assets régénérés après QA ;
3. architecture du renderer ;
4. fonctionnement des transitions ;
5. fonctionnement des variantes saisonnières ;
6. fonctionnement des bâtiments neutres/capturés ;
7. optimisation mise en place ;
8. tests effectués ;
9. éventuels points restant à polir.

Si un asset échoue à être généré, ne remplace pas silencieusement toute la DA par du greybox. Réessaie avec une variante de prompt. Si le skill de génération d'images est réellement indisponible, arrête la génération d'assets et écris clairement le blocage dans le rapport au lieu de prétendre avoir terminé.
