# 10 — Pipeline de génération d'assets

## Principe

Codex doit gérer un pipeline reproductible et vérifiable.

## Dossiers suggérés

Adapter au framework existant, mais conserver une organisation équivalente :

```
assets/generated/
  characters/
  npc/
  buildings/
  biomes/
  transitions/
  vegetation/
  props/
  ui/
  fx/
  masters/
```

## Masters

Conserver les masters de génération non compressés.
Les assets runtime peuvent être :
- PNG transparent ;
- WebP/AVIF pour gros backgrounds si support fiable ;
- atlas si utile.

## Registry

Créer `visual_codex/generated_asset_registry.json`.

Pour chaque asset :
- asset_id ;
- fichier ;
- source_reference ;
- prompt/template ;
- date/run ;
- dimensions ;
- transparent ;
- status ;
- qa_notes.

## Génération par lots

Ne pas demander "tous les assets du jeu" dans une seule image.

Lots recommandés :
1. candidate master ;
2. candidate animation group ;
3. NPC biome archetypes ;
4. building base ;
5. building overlays ;
6. biome far/mid layers ;
7. transition pair ;
8. vegetation ;
9. UI icons ;
10. FX.

## Consistance

Pour chaque appel image :
- fournir `STYLE_TARGET.png` ;
- fournir, si disponible, le master de l'objet/personnage ;
- rappeler side-view, échelle, transparence ;
- rappeler "no text baked in".

## Spritesheets

Si le générateur produit une planche :
- fond transparent ;
- grille explicitement demandée ;
- marge uniforme ;
- même anchor/pied ;
- découper automatiquement ;
- valider que les frames ne se chevauchent pas.

Si la grille est incohérente :
- ne pas forcer le découpage ;
- régénérer ou créer frames séparées.

## Anchor

Personnages :
- définir un point de pied cohérent ;
- stocker metadata si nécessaire.

Bâtiments :
- base alignée au ground line ;
- footprint cohérent avec le site logique.

## Backgrounds

Ne jamais inclure :
- personnage de gameplay ;
- texte UI ;
- site interactif si le moteur les rend séparément.

Le background peut contenir des façades non interactives.

## Transitions

Produire les paires adjacentes en regardant les deux références.
Voir `06_BIOME_TRANSITIONS.md`.

## Checkpoint

Après chaque lot :
- inspecter visuellement ;
- intégrer ;
- screenshot ;
- corriger ;
- registry.

## Pas de placeholders silencieux

Si une génération échoue :
- 2–3 retries avec prompt simplifié ;
- si toujours impossible, marquer `blocked` ;
- conserver le greybox seulement pour cet asset ;
- rapporter précisément.
