# IMPLEMENTATION_TASKS — V0.3

## Phase 0 — Lire les specs
Lire gameplay + visual composition + multiplayer readiness avant de coder.

## Phase 1 — Architecture multiplayer-ready
- GameSimulation indépendante du rendu ;
- fixed timestep ;
- GameCommand/GameEvent ;
- Controller commun HumanLocal / AI ;
- IDs uniques ;
- snapshot sérialisable ;
- RNG seedée.

Ne pas implémenter le réseau.

## Phase 2 — Monde / caméra / composition
- 18 sous-zones bouclées ;
- caméra centrée ;
- sol très bas et fin ;
- silhouettes humaines primitives ;
- argent seul top-left en k € ;
- aucun HUD supérieur.

## Phase 3 — Neutres / persuasion
- spawn variable ;
- origine persistante ;
- proximité automatique ;
- bonus Mélenchon ;
- retour origine après démobilisation.

## Phase 4 — Sympathisants / implantation
- influence locale ;
- seuils de construction ;
- slots de bâtiments.

## Phase 5 — Interaction billet + hold
- zones d'interaction ;
- billet/prix ;
- progression automatique ;
- transaction simulée/atomique ;
- aucun clic ;
- aucun coin UI.

## Phase 6 — Imprimerie service neutre
- préexistante ;
- non possédable ;
- paiement par tract ;
- Sympathisant → vient chercher → Militant.

## Phase 7 — Combat
- combo ;
- durabilité cachée ;
- knockback ;
- démobilisation ;
- electoral_damage candidat.

## Phase 8 — Bâtiment factionnel
M/LP : Local SO, défense biome, raid.
EP : Cabinet administratif, fermeture bâtiment possédé adverse.

## Phase 9 — Autres bâtiments
- Permanence ;
- Financement ;
- Tour communication ;
- Institut sondage ;
- Meeting.

## Phase 10 — Influence / information
- électorat abstrait ;
- contrôle ;
- bonus LP ;
- Institut verrouillant cercle/scores.

## Phase 11 — Ultis
- charge cachée ;
- étoile yeux ;
- déclenchement attaque suivante ;
- hologrammes / vague marine / CRS.

## Phase 12 — IA
L'IA doit utiliser les mêmes GameCommands qu'un joueur humain.

## Phase 13 — J0 / arène
- scores → jauges ;
- premier éliminé ;
- retour monde.

## Phase 14 — Sprint final
- démobilisation troisième ;
- 60 s ;
- influence ×10 ;
- résultat.

## Phase 15 — Debug et validation
- overlay ;
- tests snapshot ;
- tests commands ;
- acceptance checklist.
