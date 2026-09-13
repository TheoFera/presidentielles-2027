# Styles de campagne — intégration et validation du 13 septembre 2026

La logique des choix successifs a été remplacée par `CampaignStyleSystem`. Chaque candidat démarre avec `current_campaign_style = null`, puis choisit un seul des trois styles lors de l’établissement du premier QG. Le choix du joueur ouvre un dialogue plein écran obligatoire et suspend la simulation. Les candidats IA choisissent leur style par défaut.

Le retour au QG donne accès à « CHANGER DE STYLE » : maintenir E ou le bouton tactile pendant trois secondes. Le maintien est annulé par déplacement, sortie de zone, attaque, coup reçu, étourdissement, KO, relâchement ou interaction incompatible. Le dialogue de changement peut être annulé. Aucun paiement ni délai supplémentaire n’est ajouté.

## Catalogue et réglages

Le catalogue des neuf styles est dans `src/simulation/campaign-styles.js`. Les réglages sont surchargeables via `balance.campaign_styles.definitions[styleId]` dans `Présidentielles 2027/game_balance.json` : `biome_multipliers`, `penalized_biomes`, `event_tag_weights`, `opinion_tag_multipliers`, `skin`, `ultimate`. Le bonus initial est ×1,10 sur le biome principal. Aucune pénalité ni bonus secondaire n’est ajouté par défaut.

Les durées et valeurs des nouveaux ultimes sont dans `balance.specials`. Les charges existantes restent à un point par coup léger réussi, deux par fin de combo, pour un seuil de dix points. L’écharpe, les invocations, le feu, la vague et les ripostes ne rechargent pas le pouvoir par leurs dégâts.

Un événement mémorise les multiplicateurs de chaque candidat à son déclenchement. Ses récompenses restent ainsi identiques si un style change entre-temps. Les pondérations par tags concernent les prochains tirages.

## Profil

Le profil est distinct de la sauvegarde de partie. La clé de stockage du navigateur est `presidentielles2027:profile:v1`. Les styles Universaliste, Souverainiste et Gestionnaire sont les seuls débloqués par défaut.

Les points d’intégration sont `isCampaignStyleUnlocked`, `unlockCampaignStyle` et `persistCampaignStyleUnlock`. Cette dernière fonction enregistre un déblocage pour les parties suivantes ; une future interface de progression devra aussi actualiser le profil de la simulation et de la sélection si elle autorise un déblocage pendant une partie. Aucun système de boutique, challenge ou monnaie n’est créé.

## Présentation et ultimes

Les neuf costumes et portraits utilisent désormais neuf PNG générés distincts, dans `assets/generated/characters/character-style-*.png`. Cinq autres PNG représentent Bardella, Zemmour, les silhouettes encapuchonnées, le Gilet jaune et le Super Européiste. Les hologrammes réutilisent le sprite Universaliste ; les CRS gardent leurs assets existants. Les effets animés (vague, feu, écharpe, aura et étoiles) sont dessinés par le moteur du jeu.

Les sources haute définition sont conservées dans `assets/generated/masters/`. Les prompts et la provenance de génération sont dans `visual_codex/production/character-style-*.json` et `character-ultimate-*.json`. Les 14 PNG intégrés possèdent un véritable canal transparent. La galerie `artifacts/styles-gallery.html` rassemble les neuf cartes et les captures des neuf ultimes.

Les PNJ standards ne consultent jamais le style actif pour choisir leur apparence. Le nettoyage d’un ultime retire uniquement les effets et invocations temporaires du candidat concerné, sans modifier les PNJ standards, les bâtiments ou les scores déjà acquis.

La Bardellisation s’arme pour un KO et restaure la résistance à la même position. Son utilisation est mémorisée jusqu’au véritable KO : changer de style ne réinitialise pas ce verrou. Le respawn restaure Marine. Les effets temporaires sont également nettoyés aux transitions entre monde et arènes.

## Validation effectuée

Les 32 tests de styles passent, notamment les neuf activations, les neuf sauvegardes pendant un ultime, les interruptions au QG, l’absence de recharge par les dégâts d’ultime, la protection contre les résurrections répétées et la conservation des PNJ. Ils sont accessibles par `npm run test:styles` et intégrés à `npm test` avec les tests de transparence des sprites et de non-régression.

Le script `scripts/validate-styles-browser.mjs` vérifie les neuf cartes à trois tailles (1440 × 900, 844 × 390, 390 × 844), le maintien au QG, les neuf sélections et exports réels, ainsi que le rendu des neuf ultimes. Rapport : `artifacts/styles-browser/report.json`. Les captures des ultimes utilisent des scènes contrôlées dans le moteur réel, et les tailles mobiles sont émulées dans Chrome ; ce n’est pas un test sur appareil physique.

Trois campagnes accélérées jusqu’à la fin de la phase de campagne se terminent sans blocage (`artifacts/styles-campaign-runs.json`). À cette vitesse, certaines IA n’établissent pas leur QG et gardent donc un style nul : ces campagnes ne remplacent pas les tests ciblés des neuf styles. La construction du jeu par `npm run build` réussit. L’équilibrage des dégâts, distances et rythmes reste à apprécier lors de parties humaines.

Les sauvegardes passent en version 8. Les anciennes sauvegardes en version 7 sont explicitement refusées : elles contiennent l’ancien modèle cumulatif.
