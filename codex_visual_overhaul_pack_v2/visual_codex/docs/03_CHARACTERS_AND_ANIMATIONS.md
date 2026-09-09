# 03 — Personnages et animations

## Candidats

Trois masters principaux :
- Mélenchon ;
- Le Pen ;
- Philippe.

Chaque candidat doit être reconnaissable, caricatural et cohérent d'une animation à l'autre.

### Pipeline candidat

1. Générer un master propre, pose neutre, fond transparent.
2. Valider proportion/visage/vêtement.
3. Utiliser ce master comme référence pour toutes les animations.
4. Générer principalement face droite.
5. Miroir runtime pour face gauche si possible.
6. Ne pas faire apparaître de texte/logo asymétrique indispensable sur le corps.

### Animations minimales

- idle ;
- walk ;
- run si le jeu différencie ;
- persuade ;
- interact_hold ;
- attack_light_1 ;
- attack_light_2 ;
- attack_heavy ;
- charged_attack si présent ;
- hurt ;
- knockback ;
- ko ;
- meeting ;
- special_start ;
- special_recovery.

Le `special_ready` peut être un overlay d'étoiles dans les yeux plutôt qu'une animation complète.

## PNJ neutres

Créer 3 archétypes visuels par biome, soit 18 masters minimum.

Important :
- varier âge apparent, morphologie, vêtements, accessoires ;
- distribuer la diversité de carnations dans TOUS les biomes ;
- ne jamais coder "biome = ethnie" ;
- l'identité d'un biome vient surtout de tenue/accessoires/posture.

### Animations PNJ

- idle ;
- walk ;
- persuade/listen ;
- convert ;
- hurt ;
- knockback ;
- demobilised_return.

## Sympathisants / Militants

Éviter de régénérer un personnage complet pour chaque faction.

Préférer :
- base PNJ ;
- overlay de faction : veste, brassard, écharpe, badge ;
- symbole de rôle discret.

Sympathisant :
- marquage faction léger.

Militant :
- marquage faction plus visible ;
- accessoire tract/mégaphone ;
- attaque verbale.

## Services d'ordre

Créer une base dédiée :
- silhouette plus robuste ;
- équipement non létal stylisé ;
- faction via brassard/veston ;
- lisible sans barre de vie.

Animations :
- idle_guard ;
- patrol ;
- run_to_threat ;
- attack ;
- guard/front_block si utilisé ;
- raid_run ;
- hurt ;
- knockback ;
- demobilised_return.

## CRS temporaires Philippe

Asset distinct :
- 1 ou 2 variantes ;
- bouclier/tenue stylisée ;
- clairement temporaire ;
- pas de détail réaliste inutile.

## Journalistes

3 variantes minimum :
- journaliste TV ;
- éditorialiste/intervieweur ;
- reporter caméra/micro.

Animations :
- idle ;
- attack_question ;
- hurt ;
- defeated.

## Hologrammes Mélenchon

Ne pas générer des clones totalement nouveaux.
Réutiliser le sprite du candidat :
- teinte/transparence ;
- scanlines/halo ;
- petites variations d'offset.

## Références techniques

Voir `character_animation_manifest.json`.
