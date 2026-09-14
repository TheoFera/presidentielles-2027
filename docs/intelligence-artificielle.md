# Intelligence artificielle

L’IA choisit un territoire à conquérir, le rejoint, attaque ses défenseurs, recrute et investit sur place. Elle vise aussi bien les implantations du joueur que celles des autres IA. Une implantation adverse compte même si son propriétaire n’a pas encore atteint le seuil de contrôle électoral.

Elle commence par chercher un QG, puis arbitre entre conquête et défense. La valeur électorale, la distance sur la carte circulaire, les territoires voisins, les soutiens présents, les bâtiments et le style de campagne comptent dans le choix. Un objectif est conservé assez longtemps pour permettre le déplacement et l’offensive ; il est réévalué à son expiration ou après la conquête. Une IA blessée se replie pour récupérer.

Les achats utilisent les mêmes devis, délais, exigences de présence et plafonds de dépenses que le joueur. L’IA sait capturer, financer une collecte, former des militants, équiper le service d’ordre, déclencher un raid ou utiliser le cabinet administratif de Philippe. Les services neutres sont utilisés comme tels. Elle préserve les soutiens nécessaires aux bâtiments avant de les envoyer à l’imprimerie.

## Difficulté

Le niveau par défaut est **normal**. Les trois profils sont centralisés dans `src/simulation/ai-settings.js` :

| Niveau | Comportement |
| --- | --- |
| Facile | Préparation plus longue, préférence offensive moins forte, attaques espacées, aucun dash volontaire. |
| Normal | Conquête plus prioritaire, attaques plus régulières, dash de poursuite et de repli. |
| Difficile | Recherche plus large des adversaires, objectifs offensifs plus insistants, réactions plus rapides aux événements et au combat, repli plus précoce. |

Aucun niveau ne modifie les revenus, les prix, la vitesse de marche, la résistance ou les dégâts. Ces profils règlent le comportement ; ils ne garantissent pas un classement identique à chaque partie.

Pour choisir le niveau depuis le code au lancement d’une partie :

```js
const simulation = new GameSimulation(config, 42, 'candidate:melenchon', profile, {
  aiDifficulty: 'difficile', // 'facile', 'normal' ou 'difficile'
});
```

Il est aussi possible de définir `config.balance.ai = { difficulty: 'normal' }` avant de créer la simulation. L’option du constructeur est prioritaire. Le sélecteur de difficulté dans les menus pourra appeler cette option ; aucun menu supplémentaire n’est nécessaire à la configuration actuelle.

## Styles et sauvegardes

Au premier QG, chaque IA choisit parmi **les trois styles propres à son candidat**, même si le joueur ne les a pas débloqués. Le biome du QG influence le tirage, sans exclure aucun style. Ce choix ne débloque rien dans le profil du joueur. Les neuf pouvoirs sont pris en charge, y compris l’allonge de l’Écharpe, la direction de la Vague et l’unique relève de Bardella.

Les difficultés et les objectifs sont enregistrés dans l’état de la partie. Le contrôleur ne conserve pas de mémoire cachée et ne consomme pas le générateur aléatoire lorsqu’il consulte une décision. Une sauvegarde puis une reprise reproduisent donc la même suite d’actions. Les sauvegardes du format courant sans les nouveaux champs restent acceptées ; en l’absence de réglage, elles utilisent le niveau normal.

## Vérification

`npm run test:ia` vérifie la conquête adverse, les achats, les raids, les fermetures, les neuf pouvoirs, les différences de difficulté et la reprise des sauvegardes. Ces tests font également partie de `npm test`.
