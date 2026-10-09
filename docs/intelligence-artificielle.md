# Intelligence artificielle

L’IA choisit un territoire à conquérir, le rejoint, attaque ses défenseurs, recrute et investit sur place. Elle vise aussi bien les implantations du joueur que celles des autres IA. Une implantation adverse compte même si son propriétaire n’a pas encore atteint le seuil de contrôle électoral.

Elle commence par chercher un QG, puis arbitre entre conquête et défense. La valeur électorale, la distance sur la carte circulaire, les territoires voisins, les soutiens présents, les bâtiments et le style de campagne comptent dans le choix. Un objectif est conservé assez longtemps pour permettre le déplacement et l’offensive ; il est réévalué à son expiration, après la conquête, et de temps en temps en chemin : l’IA change d’avis si une option nettement meilleure apparaît, parfois après une courte pause de réflexion. Une IA blessée se replie pour récupérer.

Au début de partie, l’IA ramasse les billets de départ de son quartier en sautant : d’abord pour payer son QG, puis ceux qui restent à portée. Elle ramasse aussi les billets tombés au sol près d’elle, sauf si un rival l’attend dessus.

Les achats utilisent les mêmes devis, délais, exigences de présence et plafonds de dépenses que le joueur. L’IA sait capturer, former des militants, équiper le service d’ordre, déclencher un raid ou utiliser le cabinet administratif. Les services neutres (meeting, institut de sondage) sont utilisés comme tels. Elle cherche à jouer comme un bon joueur : groupes de militants, prise de son local de camp, raids et fermetures, conquête des bâtiments adverses, sans bonus caché. Ses réglages économiques sont dans la section `ai_economy` de `donnees-jeu/game_balance.json`.

## Partie à trois : contenir le plus fort

Chaque IA mesure le **rapport de force** (`src/simulation/ai-balance.js`) : opinion nationale, territoires contrôlés, bâtiments actifs et un peu d’argent. Les deux autres camps se liguent naturellement contre le plus fort : ses territoires et ses bâtiments deviennent leurs cibles prioritaires. « Attaquer » veut surtout dire lui reprendre du terrain, pas forcément le frapper.

L’IA s’adapte aussi au niveau des joueurs humains (en solo comme en multijoueur, tous les humains comptent) :

- **Un humain domine** : les IA réagissent plus vite, hésitent moins, font de plus longs détours pour capturer un bâtiment, lancent plus volontiers leurs meetings, frappent plus souvent et convainquent jusqu’à 25 % plus vite.
- **Un humain est distancé** : les IA le laissent respirer. Elles évitent ses territoires, ne ferment pas ses bâtiments, retiennent leurs coups contre lui, convainquent un peu moins vite (jusqu’à 15 %) et s’affrontent entre elles.

L’IA ne cherche pas à conquérir la sous-zone d’un candidat sans style de campagne (Glucksmann, Roussel…), mais s’y défend si elle y passe.

Ces seuils sont réglables dans la section `ai_adaptation` de `donnees-jeu/game_balance.json` (`enabled: false` désactive l’adaptation).

## Réflexion : observer, combattre ou fuir

Quand un candidat rival entre dans son champ de vision, l’IA **l’observe** d’abord : elle garde ses distances, fait quelques pas, se tourne vers lui. Puis elle tranche, et réévalue régulièrement sa décision (`src/simulation/ai-mind.js`) :

- **Combattre** si ses chances sont bonnes : résistance comparée, ultime prêt, militants et service d’ordre autour, terrain ami ou hostile.
- **Fuir** si la défaite coûterait cher : un K.-O. fait tomber 30 % de l’argent transporté, donc une IA chargée d’argent est plus prudente. Un rival riche est au contraire une proie tentante. Un candidat sous le coup d’un scandale évite le combat ; ses rivaux le traquent.
- **Éviter** : continuer sa route sans s’approcher du rival.

L’avis peut changer : frappée, l’IA riposte ; acculée, elle se retourne ; bloquée trop longtemps, elle force le passage ; un rival qui détale n’est poursuivi que s’il en vaut la peine. Les événements de campagne sont pesés **après** les rivaux proches : l’IA ne passe plus devant un adversaire sans réagir pour courir vers un événement. Elle tient compte du territoire où il a lieu, des rivaux déjà sur place et de son coût.

## Difficulté

Le jeu utilise toujours le niveau **normal** : aucun choix de difficulté n’est proposé dans les menus. Trois profils existent dans le code, centralisés dans `src/simulation/ai-settings.js` :

| Niveau | Comportement |
| --- | --- |
| Facile | Préparation plus longue, préférence offensive moins forte, attaques espacées, aucun dash volontaire, observation plus longue et hésitations fréquentes, adaptation modérée. |
| Normal | Conquête plus prioritaire, attaques plus régulières, dash de poursuite et de repli. |
| Difficile | Recherche plus large des adversaires, objectifs offensifs plus insistants, réactions plus rapides aux événements et au combat, repli plus précoce, peu d’hésitation, moins de clémence envers un humain distancé. |

Aucun niveau ne modifie les revenus, les prix, la vitesse de marche, la résistance ou les dégâts. Seule l’adaptation au niveau des humains change légèrement la vitesse de persuasion des IA (voir plus haut). Ces profils règlent le comportement ; ils ne garantissent pas un classement identique à chaque partie.

Pour choisir le niveau depuis le code au lancement d’une partie :

```js
const simulation = new GameSimulation(config, 42, 'candidate:melenchon', profile, {
  aiDifficulty: 'difficile', // 'facile', 'normal' ou 'difficile'
});
```

Il est aussi possible de définir `config.balance.ai = { difficulty: 'normal' }` avant de créer la simulation. L’option du constructeur est prioritaire.

## Styles et sauvegardes

Au premier QG, chaque IA choisit parmi **les trois styles propres à son candidat**, même si le joueur ne les a pas débloqués. Le biome du QG influence le tirage, sans exclure aucun style. Ce choix ne débloque rien dans le profil du joueur. Les neuf pouvoirs sont pris en charge, y compris l’allonge de l’Écharpe, la direction de la Vague et l’unique relève de Bardella.

Les difficultés, les objectifs et la réflexion en cours (`ai_mind`) sont enregistrés dans l’état de la partie. En multijoueur, l’hôte calcule les IA et transmet cet état aux invités. Le contrôleur ne conserve pas de mémoire cachée et ne consomme pas le générateur aléatoire lorsqu’il consulte une décision. Une sauvegarde puis une reprise reproduisent donc la même suite d’actions. Les sauvegardes du format courant sans les nouveaux champs restent acceptées ; en l’absence de réglage, elles utilisent le niveau normal.

## Vérification

`npm run test:ia` vérifie la conquête adverse, les achats, les raids, les fermetures, les neuf pouvoirs, les différences de difficulté, l’adaptation au niveau des humains, l’observation, le choix combattre/fuir, les billets de départ et la reprise des sauvegardes. Ces tests font également partie de `npm test`.
