# PROTOTYPE_ACCEPTANCE_TESTS — V0.3

## A. Composition / caméra
- [ ] 16:9 de référence, ratios responsive.
- [ ] Caméra latérale centrée sur le joueur.
- [ ] Sol à ~91–94 % de la hauteur, très peu visible dessous.
- [ ] Personnage ~13–17 % de la hauteur écran.
- [ ] Aucun bandeau HUD supérieur.
- [ ] Aucun lac / grande route / bande décorative sous le sol.
- [ ] Référence `GREYBOX_COMPOSITION_V0.3.png` respectée.

## B. HUD
- [ ] Argent seul affiché en permanence en haut à gauche.
- [ ] Argent affiché au format `k €`.
- [ ] Pas de portraits, barres de vie, compteurs d'unités ou gros boutons.
- [ ] Jours non affichés en permanence avant Institut ; feedback transitoire au changement de jour.
- [ ] Après Institut, le cercle peut intégrer le jour.

## C. Neutres / persuasion
- [ ] 0 Sympathisant au départ pour tous.
- [ ] Spawn variable par sous-zone.
- [ ] Origine PNJ persistante.
- [ ] Aucun argent pour convaincre.
- [ ] Aucun bouton pour convaincre.
- [ ] Candidat/Militant convainc par proximité.
- [ ] Mélenchon personnellement plus rapide.
- [ ] Démobilisé retourne à son origine puis redevient Neutre.

## D. Construction par implantation
- [ ] Seuil local de Sympathisants requis pour les bâtiments possédables.
- [ ] Seuil non consommé.
- [ ] Si seuil insuffisant, bâtiment non achetable.

## E. Interaction économique billet + présence
- [ ] Aucune pièce contextuelle.
- [ ] Aucun clic/bouton d'achat.
- [ ] Entrer dans zone → billet avec prix visible.
- [ ] Fonds suffisants + présence continue → progression discrète.
- [ ] Fin du timer → débit et action automatique.
- [ ] Sortie anticipée → annulation/décroissance.
- [ ] Fonds insuffisants → billet grisé, aucune transaction.
- [ ] L'UI ne modifie jamais directement l'argent : transaction validée par simulation.

## F. Imprimerie neutre
- [ ] Préexistante dans le monde.
- [ ] Aucun propriétaire.
- [ ] Pas de coût d'achat du bâtiment.
- [ ] Tous les camps peuvent l'utiliser.
- [ ] Chaque tract est payé séparément.
- [ ] Sympathisant allié le plus proche vient récupérer le tract.
- [ ] Il devient Militant.
- [ ] Imprimerie non ciblable par Cabinet administratif.

## G. SO / Philippe
- [ ] Local SO possédable uniquement Mélenchon/Le Pen.
- [ ] Militant → SO via équipement payé au bâtiment.
- [ ] SO reste dans biome et intercepte intrus.
- [ ] Raid gauche/droite possible.
- [ ] Philippe n'a aucun SO permanent.
- [ ] Cabinet administratif ferme un bâtiment adverse possédé.
- [ ] Service neutre exclu des cibles.

## H. Autres bâtiments
- [ ] Permanence.
- [ ] Financement.
- [ ] Tour communication.
- [ ] Institut sondage.
- [ ] Meeting.
- [ ] Interaction hold-to-pay cohérente pour les dépenses applicables.

## I. Combat
- [ ] Combo léger/léger/fort.
- [ ] Durabilité invisible en UI normale.
- [ ] Sympathisant démobilisable par combo complet.
- [ ] Militant démobilisable ou quasi démobilisé selon réglage initial.
- [ ] SO ~3× plus robuste.
- [ ] 1v2 SO serré ; 1v3 très dangereux.
- [ ] Aucun décès.

## J. Dégâts candidats / ultis
- [ ] Aucun PV visible en exploration.
- [ ] Coups/insultes → electoral_damage → voix vers Neutres.
- [ ] Charge spéciale invisible.
- [ ] Étoile yeux quand prête.
- [ ] Coup suivant déclenche ulti.
- [ ] Hologrammes M.
- [ ] Vague marine LP.
- [ ] CRS temporaires EP.

## K. Influence / Institut
- [ ] M/LP/EP/Neutres = 100 % par sous-zone.
- [ ] PNJ physiques et électorat abstrait indépendants.
- [ ] Cercle/score national invisibles avant Institut.
- [ ] Après Institut, cercle et scores visibles/consultables.

## L. J0 / second tour
- [ ] Arène média à trois à J0.
- [ ] Score national = jauge visible.
- [ ] Premier à 0 éliminé puis combat stoppé.
- [ ] Ses unités démobilisées, bâtiments possédés neutralisés.
- [ ] Services neutres inchangés.
- [ ] Retour monde, 60 s, influence ×10, puis résultat final.

## M. Greybox
- [ ] Silhouettes humaines pixelisées, pas formes géométriques seules.
- [ ] Tête/torse/bras/jambes.
- [ ] Symboles de rôle lisibles.
- [ ] Idle/marche/coup/knockback/persuasion/démobilisation.

## N. Multiplayer readiness — sans réseau réel
- [ ] GameSimulation séparée du rendu.
- [ ] Controller interface commune : humain local / IA / futur réseau.
- [ ] Input produit des GameCommands, pas des mutations directes.
- [ ] Fixed timestep indépendant du FPS.
- [ ] IDs uniques pour entités persistantes.
- [ ] État du monde sérialisable en snapshot.
- [ ] Snapshot save/load conserve un état fonctionnel équivalent.
- [ ] RNG gameplay seedée/contrôlable.
- [ ] Simulation continue hors caméra.
- [ ] Achats/transactions atomiques dans la simulation.
- [ ] Aucune socket/networking nécessaire dans cette V0.

## O. Debug
- [ ] Support/influence/durabilité/charge/origine/IA visibles en debug.
- [ ] Progression hold-to-pay visible en debug.
- [ ] Fixed tick visible en debug.
- [ ] Changement candidat et IA on/off possibles.
