# Publicités interstitielles (Google)

Une **pub interstitielle** est une pub plein écran. Dans le jeu, elle passe seulement **après un clic de fin de partie, en solo** :

| Moment | Boutons concernés | Règle |
|---|---|---|
| Fin de campagne (résultats définitifs) | « Rejouer », « Retour au menu » | au moins 3 min depuis la pub précédente |
| Fin de débat | « Revanche », « Changer de combattants », « Menu » | au plus une pub tous les 3 débats, et au moins 4 min depuis la précédente |

Pour tous les cas :

- une pub dès la fin de la première campagne (`freeGames: 0`) ;
- jamais en multijoueur, jamais pendant une partie, jamais après un abandon (quitter après le 1er tour) ;
- le son du jeu est coupé pendant la pub ;
- si la pub n'est pas prête (pas de réseau, bloqueur de pubs…), le jeu continue aussitôt.

Ces chiffres se règlent dans `src/network/ads-config.js` (`AD_RULES`).

## Comment c'est construit

| Où | Régie Google | Fichiers |
|---|---|---|
| Appli Android | **AdMob** (SDK natif, plus fiable et mieux payé dans une appli) | `android/app/src/main/java/…/AdsManager.java`, `android/app/build.gradle`, `android/gradle.properties` |
| Site web | **AdSense**, API « H5 Games Ads » (faite pour les jeux web) | `src/network/ads-config.js` |
| Les deux | Règles de fréquence, son, simulation | `src/presentation/menus/ads.js`, tests `test/ads.test.js` (`npm run test:pubs`) |

Le **consentement RGPD** (obligatoire en Europe) est affiché par Google : par le SDK « UMP » dans l'appli (déjà codé), et par AdSense sur le site (à activer dans AdSense, sans code).

## Tester sans compte Google

- **Sur ordinateur** : `npm start`, puis ouvrir `http://localhost:2027/?pub=simulation`. Une fausse pub de 3 secondes s'affiche à **chaque** fin de campagne et de débat, sans délai ni plafond, pour voir chaque placement. La console du navigateur (F12) affiche des lignes `[pub] …` qui expliquent chaque décision.
- **Sur téléphone Android** : `npm run android:test` produit une appli de test qui affiche les **pubs de test officielles de Google** (marquées « Test Ad »). Elles ne rapportent rien et ne risquent rien.

---

## Ce qu'il te reste à faire, étape par étape

### Étape 1 : l'appli Android avec AdMob (à faire en premier, c'est le plus simple)

1. Va sur <https://admob.google.com> et connecte-toi avec ton compte Google (le même que la Play Console, c'est plus simple).
2. Accepte les conditions et renseigne ton pays et ta devise.
3. **Informations de paiement** (Paiements → Ajouter un mode de paiement) : ton nom, ton adresse et ton IBAN. Google paie quand le solde dépasse 70 €. Google demande aussi une vérification d'identité et d'adresse (un code PIN envoyé par courrier).
4. **Applications → Ajouter une application** → Android → « Oui, l'appli est publiée » si elle est sur le Play Store (cherche « fr.presidentielles2027.jeu »), sinon « Non ».
5. Note l'**identifiant de l'application** : il ressemble à `ca-app-pub-1234567890123456~1234567890` (avec un **~**).
6. Dans l'appli : **Blocs d'annonces → Ajouter → Interstitiel**. Nom : « Fin de partie ». Dans les réglages avancés, coche seulement les annonces **Image et vidéo**.
7. Note l'**identifiant du bloc d'annonces** : `ca-app-pub-1234567890123456/1234567890` (avec un **/**).
8. Ouvre le fichier `android/gradle.properties`, enlève le `#` au début des deux lignes `admob…` et remplace les X par tes deux identifiants :
   ```
   admobAppId=ca-app-pub-1234567890123456~1234567890
   admobInterstitialId=ca-app-pub-1234567890123456/1234567890
   ```
9. **Confidentialité et messages** (menu de gauche d'AdMob) → **RGPD** → **Créer un message** → choisis ton appli, la langue française, et mets l'adresse de ta politique de confidentialité. **Publie** le message. Sans lui, l'écran de consentement ne s'affiche pas et les pubs en Europe rapporteront très peu.
10. **Bloquer les pubs politiques** (très important pour un jeu parodique) : **Contrôle des annonces → Catégories sensibles** → bloque « Politique », et aussi « Jeux d'argent » et « Rencontres » si tu le souhaites (beaucoup de joueurs sont jeunes).
11. Augmente `versionCode` de 1 dans `android/app/build.gradle`, puis lance `npm run android` et envoie le nouveau fichier `.aab` sur la Play Console.

> ⚠️ **Ne clique jamais sur tes propres vraies pubs**, et ne demande pas à tes amis de le faire : Google ferme les comptes pour ça. Pour tester sur ton téléphone avec les vrais identifiants, ajoute-le comme « appareil de test » dans AdMob (Paramètres → Appareils de test).

### Étape 2 : la Play Console (déclarations obligatoires)

Dans la Play Console, menu **Règles et programmes → Contenu de l'application** :

1. **Annonces** → « Oui, mon appli contient des annonces ». Le Play Store affichera la mention « Contient des annonces ».
2. **Identifiant publicitaire** → « Oui » → coche « Publicité ou marketing ». Le SDK AdMob ajoute automatiquement l'autorisation `AD_ID`.
3. **Sécurité des données** → mets à jour : l'appli collecte maintenant l'**identifiant de l'appareil**, l'**adresse IP / localisation approximative** et des **données d'utilisation de l'appli** (interactions avec les pubs), **partagés avec Google** pour la **publicité** et la **prévention des fraudes**. Google détaille les réponses pour AdMob ici : <https://developers.google.com/admob/android/privacy/play-data-disclosure>.
4. **Public cible** : choisis **13 ans et plus** (ou plus). Si tu coches des tranches d'âge d'enfants, ton jeu passe sous les règles « Familles », beaucoup plus strictes sur les pubs.

### Étape 3 : le fichier app-ads.txt (protège tes revenus)

AdMob demande un petit fichier `app-ads.txt` posé à la racine du **site web du développeur** indiqué sur ta fiche Play Store (par exemple `https://ton-site.fr/app-ads.txt`). AdMob te donne la ligne exacte à copier (Applications → Afficher toutes les applications → app-ads.txt). Sans ce fichier, les pubs sont moins bien payées.

⚠️ Il doit être **à la racine d'un nom de domaine**. Une adresse `theofera.github.io/presidentielles-2027/` ne convient pas, mais `theofera.github.io` (sans dossier) convient : solution gratuite avec un dépôt GitHub nommé `TheoFera.github.io` qui contient seulement `index.html` et `app-ads.txt`. Indique ensuite `https://theofera.github.io` comme site Web dans la fiche Play Store (Coordonnées), puis, dans AdMob, Applications → app-ads.txt → « Rechercher des mises à jour » (vérification sous 24 h environ).

### Étape 4 : le site web avec AdSense (plus difficile, peut attendre)

1. **Il te faut un nom de domaine à toi** (par exemple `presidentielle2027-lejeu.fr`, environ 10 € par an chez OVH, Gandi ou Cloudflare). AdSense refuse les sous-dossiers comme `theofera.github.io/presidentielles-2027/`. Tu peux brancher ce domaine sur GitHub Pages (Settings → Pages → Custom domain) : le site reste hébergé au même endroit.
2. Crée un compte sur <https://adsense.google.com> et ajoute ton site (ton domaine).
3. Note ton **identifiant d'éditeur** : `ca-pub-1234567890123456`.
4. Crée un fichier `ads.txt` à la racine du projet (à côté de `index.html`) et colle dedans la ligne qu’AdSense te donne. `npm run build` le publie automatiquement (pareil pour `app-ads.txt` de l’étape 3). Vérifie ensuite qu’il s’ouvre à l’adresse `https://ton-domaine/ads.txt`.
5. Attends la **validation du site** par Google (quelques jours à quelques semaines).
6. Demande l'accès aux **« H5 Games Ads »** (pubs pour les jeux web) : <https://adsense.google.com/start/h5-games-ads/>. Cette autorisation est accordée séparément.
7. Dans AdSense : **Confidentialité et messages → RGPD** → crée et publie un message pour ton site (même principe que l'étape 1.9).
8. Dans AdSense : **Contrôle des annonces → Catégories sensibles** → bloque « Politique ».
9. Dans `src/network/ads-config.js` : mets ton identifiant dans `ADSENSE_CLIENT`. Laisse d'abord `ADSENSE_TEST = true` (pubs de test), vérifie sur ton site, puis passe-le à `false`.
10. `npm run build` puis publication habituelle.

### Étape 5 : le côté légal

- La **politique de confidentialité** (`confidentialite.html`) et les **conditions** (`conditions.html`) ont été mises à jour pour mentionner les pubs. Relis-les, et complète le « responsable du traitement » (ton nom ou ta structure et un e-mail de contact), toujours marqué « À COMPLÉTER ».
- Les revenus publicitaires sont des **revenus imposables**. En France, le plus simple est souvent le statut de **micro-entrepreneur** (déclaration sur <https://www.autoentrepreneur.urssaf.fr>). AdMob et AdSense te demanderont aussi des **informations fiscales**. Demande conseil si tu as un doute.
- Comme évoqué : un **avis d'avocat** sur la parodie de personnalités réelles **avec monétisation** est une bonne idée avant d'en tirer de vrais revenus.

## Java et compilation de l'appli

Android Studio fournit parfois un Java trop récent pour Gradle 8.14 (Java 25 : erreur « Unsupported class file major version 69 »). `npm run android` choisit alors tout seul un autre Java compatible (17 à 24) installé sur la machine, par exemple dans `~/.jdks`. Rien à faire de ton côté.
