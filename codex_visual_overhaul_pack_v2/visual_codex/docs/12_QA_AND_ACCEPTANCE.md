# 12 — QA et critères d'acceptation

## A. Style

- [ ] Le jeu ressemble visuellement à `STYLE_TARGET.png`.
- [ ] Le rendu reste cartoon/BD, pas photoréaliste.
- [ ] Les personnages sont cohérents d'une animation à l'autre.
- [ ] Les textes essentiels ne sont pas baked dans les images.

## B. Caméra

- [ ] La quantité de terrain visible reste proche du greybox.
- [ ] Ground line proche du bas.
- [ ] Personnages pas trop grands.
- [ ] Bâtiments pas trop hauts.

## C. Sites

- [ ] Tous les sites sont visibles neutres avant capture.
- [ ] Aucun site ne spawn visuellement au paiement.
- [ ] Capture = transformation du même site.
- [ ] Owner colors correctes.
- [ ] N1/N2/N3 distinguables.
- [ ] Fermeture = retour progressif au neutre.
- [ ] QG visuellement distinct.
- [ ] Changement de QG met à jour l'overlay sans déplacer le site.

## D. Biomes

- [ ] 18 sous-zones habillées.
- [ ] Chaque biome identifiable.
- [ ] Aucune caricature ethnique.
- [ ] Sites gameplay bien lisibles.

## E. Transitions

Pour chaque frontière :
- [ ] Bobo → Banlieue.
- [ ] Banlieue → Périurbain.
- [ ] Périurbain → Campagne.
- [ ] Campagne → Retraités.
- [ ] Retraités → Riches.
- [ ] Riches → Bobo.

Vérifier :
- [ ] pas de hard cut ;
- [ ] skyline continu ;
- [ ] ground continu ;
- [ ] palette graduelle ;
- [ ] props de transition ;
- [ ] pas de texture pop ;
- [ ] boucle complète sans couture flagrante.

## F. Saisons

- [ ] été ;
- [ ] automne ;
- [ ] hiver ;
- [ ] printemps ;
- [ ] retour été.

- [ ] arbres changent ;
- [ ] ciel change ;
- [ ] gameplay reste lisible ;
- [ ] transition temporelle non brutale.

## G. Personnages

- [ ] 3 candidats.
- [ ] animations principales.
- [ ] neutrals.
- [ ] sympathisants/militants visuellement distincts.
- [ ] SO.
- [ ] CRS.
- [ ] journalistes.

## H. UI

- [ ] argent lisible.
- [ ] J-XXX lisible.
- [ ] event cards.
- [ ] stack haut-droite.
- [ ] billets.
- [ ] sondage.
- [ ] vignette dégâts.

## I. FX

- [ ] impacts.
- [ ] KO.
- [ ] slogans.
- [ ] hologrammes.
- [ ] vague.
- [ ] CRS.
- [ ] meeting.
- [ ] fermeture bâtiment.

## J. Performance

- [ ] pas de gros freeze au changement de sous-zone.
- [ ] next biome preload.
- [ ] mémoire raisonnable.
- [ ] pas de fuite d'assets.
- [ ] input toujours réactif.

## Captures QA minimales

Prendre au moins :
- 18 screenshots de sous-zones ;
- 6 screenshots exactement sur les frontières ;
- 4 screenshots saisons ;
- 3 candidats en combat ;
- 4 états de bâtiments ;
- 1 écran avec plusieurs events empilés.

Créer `QA_SCREENSHOT_INDEX.md`.
