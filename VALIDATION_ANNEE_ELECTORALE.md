# Validation — année électorale

31 tests réussis avec npm test ; npm run build réussit. Vérification réelle dans le navigateur : démarrage, F3, annonce centrale puis carte compacte à droite, plusieurs cartes, studio séparé et décor hivernal après saut à J-165. Une erreur existante de formatage du rapport électoral a été corrigée.

Trois seeds (17, 42, 109), trois candidats contrôlés par IA, campagnes simulées jusqu’à J0 à 30 ticks/seconde et **1 seconde par jour**. Trois témoins sans événements utilisent les mêmes seeds. Le réglage normal reste 20 secondes par jour ; ces chiffres ne prouvent pas l’équilibrage d’une partie de deux heures.

| Seed | Événements | Intervalle moyen (jours) | Changements de leader | Rencontres | Candidats auparavant troisièmes revenus en tête | Sous-zones ayant changé de contrôle | Meetings remportés |
|---|---:|---:|---:|---:|---:|---:|---:|
| 17 | 27 | 13,27 | 1 | 8 | 1 | 2 | 3 |
| 42 | 24 | 14,96 | 5 | 4 | 1 | 2 | 5 |
| 109 | 26 | 13,76 | 6 | 6 | 2 | 1 | 5 |

Moyennes : **25,67 événements/an**, **14 jours** entre apparitions, **16,64 secondes** d’absence médiatique observée (IA et combat du candidat suivi, interruptions à J0 comprises). Distribution : MINOR : 48/77 (62,34 %) ; MAJOR : 22/77 (28,57 %) ; CRISIS : 7/77 (9,09 %). Chaque séquence utilise des variantes distinctes et les trois séquences diffèrent.

Témoins : seed 17, 1 changement de leader et 0 rencontre ; seed 42, 1 changement de leader et 0 rencontre ; seed 109, 1 changement de leader et 0 rencontre. Une rencontre désigne le début d’une période où deux candidats se trouvent à moins de 5 unités, mesuré une fois par seconde ; ce n’est pas un compteur de coups. Les retours depuis la troisième place comptent les candidats distincts ayant déjà occupé cette place, puis pris la tête, pas uniquement des bonds directs troisième → premier.

Le système augmente les confrontations dans cet échantillon et permet des retours. Les changements de contrôle territorial restent limités. Deux fermetures se sont déclenchées naturellement sur la seed 42 ; leur neutralisation, protection du QG et recapture sont aussi vérifiées par tests ciblés. Les orientations IA ne sont pas toutes consommées faute de QG ou de retour sur place. L’absence de répétitions est vérifiée ; la sensation de variété et l’équilibre du rattrapage restent à tester humainement.

Mécaniques et réglages détaillés : GUIDE_ANNEE_ELECTORALE.md. Données brutes : artifacts/campaign-validation.json et artifacts/campaign-baseline-validation.json.
