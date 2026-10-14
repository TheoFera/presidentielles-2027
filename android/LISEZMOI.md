# Application Android — du projet au Play Store

Ce dossier contient l'application Android de « Présidentielle 2027 : Le Jeu ». Elle affiche le jeu web en plein écran, en paysage, **sans connexion Internet nécessaire** en solo (le multijoueur en ligne, les comptes et les pubs ont besoin d'Internet). Les fichiers du jeu viennent de `dist/`, produit automatiquement à partir des sources.

- Identifiant Play Store : `fr.presidentielles2027.jeu` (définitif après la première publication).
- Android 7.0 minimum, cible Android 16 (API 36), exigence actuelle de Google.
- Poids : environ 130 Mo (carte plate seule, images WebP sans perte).

## 1. Construire et essayer sur ton téléphone

Android Studio est déjà installé sur ton ordinateur : rien d'autre à installer. Dans un terminal, à la racine du projet :

```bash
npm run android:test
```

Le fichier `android/app/build/outputs/apk/debug/app-debug.apk` est créé. Pour l'installer :

1. Sur le téléphone : *Paramètres → À propos du téléphone*, touche 7 fois *Numéro de build* pour activer le mode développeur, puis active *Débogage USB* dans *Options pour les développeurs*.
2. Branche le téléphone en USB, accepte l'autorisation affichée, puis lance :

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r "android\app\build\outputs\apk\debug\app-debug.apk"
```

Tu peux aussi ouvrir le dossier `android/` dans Android Studio et cliquer sur ▶ (Run).

À vérifier sur le téléphone : chargement, menus, une partie, le bouton retour (il revient au menu précédent ou met en pause ; sur l'accueil il quitte), le son, et le multijoueur entre deux téléphones avec le scan des QR.

## 2. Créer ta clé de signature (une seule fois)

Google exige que chaque fichier envoyé soit signé avec **ta** clé. Tu crées la clé toi-même ; elle ne doit jamais être partagée.

Dans un terminal, depuis le dossier `android/` :

```powershell
& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair -v -keystore presidentielles-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

L'outil te demande deux mots de passe et ton nom : choisis des mots de passe solides et note-les dans ton gestionnaire de mots de passe.

Ensuite, copie `keystore.properties.example` en `keystore.properties` et remplace les valeurs par tes mots de passe.

**Important :** sauvegarde `presidentielles-upload.jks` et tes mots de passe hors de l'ordinateur (clé USB, coffre-fort de mots de passe). Ces deux fichiers sont exclus de Git. Grâce à la *signature d'application Play* (activée par défaut), Google peut réinitialiser cette clé si tu la perds, mais la procédure prend plusieurs jours.

## 3. Construire le fichier pour le Play Store

```bash
npm run android
```

Le fichier signé est `android/app/build/outputs/bundle/release/app-release.aab`. C'est lui qu'on envoie au Play Store (pas l'APK).

## 4. Publier sur Google Play

1. **Compte développeur** : sur [play.google.com/console](https://play.google.com/console), crée un compte (25 $ une seule fois, pièce d'identité demandée). La vérification peut prendre quelques jours.
2. **Créer l'application** : nom « Présidentielle 2027 : Le Jeu », langue française, type *Jeu*, *Gratuit*.
3. **Politique de confidentialité** : la page `confidentialite.html` est publiée avec le site GitHub Pages du jeu après ton prochain envoi sur GitHub. Vérifie qu'elle s'ouvre, puis colle son adresse dans la Play Console.
4. **Fiche du Play Store** : textes, catégorie, réponses aux questionnaires, icône 512 px et bannière sont dans le dossier voisin « Presidentielles 2027 - fichiers retirés/2026-10-09 carte plate seule », sous `android/play-store/` (`fiche-play-store.md`, `icone-512-v2.png`, `icones.md`). Les icônes du téléphone sont déjà intégrées au projet. Ajoute 2 à 8 captures d'écran prises sur ton téléphone.
5. **Test fermé obligatoire** : pour un compte personnel récent, Google exige un test fermé avec **au moins 12 testeurs pendant 14 jours d'affilée** avant d'autoriser la publication publique. Crée un *Test fermé*, envoie le fichier `.aab`, puis invite tes testeurs (leurs adresses Gmail).
6. **Production** : une fois le test validé, demande l'accès à la production, envoie le même `.aab` (ou une version plus récente) et lance le déploiement. Google examine l'application, souvent en quelques jours.

## 5. Publier une mise à jour

1. Dans `android/app/build.gradle`, augmente `versionCode` de 1 (2, 3, 4…). Change le numéro lisible (par exemple `1.0.2`) dans `src/version.js` : c'est le seul endroit où il est écrit, l'appli le reprend pour le Play Store et le menu principal l'affiche en bas à droite.
2. Relance `npm run android`.
3. Dans la Play Console, crée une nouvelle version et envoie le nouveau `.aab`.

### Mise à jour 1.0.4 (code 5)

La version précédente publiée est **1.0.3 (code 4)**. La prochaine est **1.0.4 (code 5)**. L’identifiant de l’application reste `fr.presidentielles2027.jeu`.

Réutilise la clé de téléversement des versions précédentes : **ne crée pas une nouvelle clé**. Sur cet ordinateur, elle se trouve dans `C:/Users/ferat/Documents/AndroidKeys/presidentielle2027-upload.jks`, avec l’alias `presidentielle2027`. Le fichier local `android/keystore.properties` doit contenir ce chemin, cet alias et les deux mots de passe. Il est exclu de Git. `npm run android` refuse désormais de construire une version Play Store si ce fichier manque.

Après la construction, envoie `android/app/build/outputs/bundle/release/app-release.aab`. Garde aussi `android/app/build/outputs/mapping/release/mapping.txt` : il permet de rendre lisibles les rapports de plantage du code Android optimisé. Le fichier AAB produit par Gradle inclut normalement cette correspondance.

Nom de la version dans la Play Console : **1.0.4**. Notes de mise à jour à copier dans le champ français :

```text
<fr-FR>
Amélioration de la fluidité pendant les meetings et en fin de campagne.
Ajustement des tactiques et des objectifs des adversaires contrôlés par le jeu.
Rééquilibrage d’Édouard Philippe : partisans plus résistants et contrôle renforcé.
Possibilité de se retourner pendant un étourdissement léger.
</fr-FR>
```

Avant le déploiement, utilise une piste de test interne pour essayer cette version finale sur téléphone : ouverture, menu affichant 1.0.4, campagne jusqu’aux résultats, débat, son, retour, connexion Google, publicités et multijoueur. Vérifie aussi la mise à jour depuis la version Play Store précédente, avec conservation de la progression. Un APK de débogage ne remplace pas cet essai, car sa signature et ses publicités sont différentes.

Dans la Play Console, ouvre la piste utilisée par ton application (test fermé ou production), crée une version, ajoute l’AAB, colle les notes, puis vérifie le résumé et les messages de Google avant de lancer le déploiement. Conserve les déclarations de confidentialité, de sécurité des données et de publicités à jour si les fonctionnalités changent. La préparation locale ne publie rien automatiquement. [Procédure officielle Google](https://support.google.com/googleplay/android-developer/answer/9859348?hl=fr).

## Bon à savoir

- Le jeu exporté (`dist/`) est reconstruit à chaque `npm run android` : ne modifie jamais `dist/` à la main.
- La première conversion des images en WebP prend quelques minutes (avec `ffmpeg`), ensuite elle est gardée dans `.cache/webp/`. Détails de l'export : `docs/export-et-performances.md`.
- Dans l'application, le multijoueur « En ligne, avec un code » et « Entre téléphones » (QR) fonctionnent ; le mode « Avec un serveur local » n'existe pas. Voir `docs/multijoueur.md`.
- Le jeu met en scène des personnalités politiques réelles de façon parodique. Google peut refuser une application qui laisse croire à un lien officiel : la description précise qu'il s'agit d'une parodie non affiliée. Ce n'est pas un avis juridique.
- Connexion au compte PartageTonJeu : l'appli utilise la connexion Google native (Credential Manager), car Google refuse les connexions dans une WebView. Il faut créer un client OAuth « Android » avec l'empreinte SHA-1 de chaque clé de signature (test et Play Store) : voir `docs/comptes-partagetonjeu.md`, « Ce qu'il reste à configurer ».

## Fluidité : ce qu'il faut savoir (mesures du 5 octobre 2026)

Mesuré sur un Redmi Note 13 Pro 5G (écran 120 Hz), en comparant le même jeu dans Chrome et dans l'appli :

- **Juger la fluidité sur la version finale, pas sur la version de test.** La version installée par Android Studio (debug) contient les outils de débogage et charge des pubs de test : elle est nettement moins fluide que la version Play Store.
- **Tester débranché et téléphone froid.** En charge USB et après quelques minutes de jeu, le téléphone chauffe (vers 38-39 °C) et bride son processeur à environ la moitié de sa puissance : le jeu ralentit, dans l'appli comme dans Chrome.
- **60 images par seconde.** Dans l'appli, le jeu dessine au plus 60 images par seconde à intervalles égaux (`src/presentation/rendu/frame-cadence.js`) : la carte graphique de la WebView a besoin d'environ 8,4 ms par image, trop pour un écran à 120 Hz (8,3 ms). Chrome est fluide pour la même raison : Xiaomi le met à 60 Hz. L'appli demande aussi 60 Hz à l'écran (`MainActivity.preferSixtyHertz`), demande que Xiaomi ignore.
- **dist/ doit être la version appli.** La construction Android refuse de démarrer si `dist/` contient la version web (`npm run build`) : lancer `node scripts/build-pages.mjs --app` avant de construire l'appli dans Android Studio.
- **Mesurer sur le téléphone** : `-PwebDebug=true` (ex. `gradlew assembleRelease -PadmobAppId= -PadmobInterstitialId= -PwebDebug=true`) rend une version finale inspectable depuis `chrome://inspect` ; jamais pour le Play Store.
- **Appli déclarée comme jeu** (`android:isGame`, `appCategory="game"`). Android 15 et plus peut alors limiter un jeu à 60 images par seconde (`game_default_frame_rate_override`) : c'est la cadence que Chrome obtient pour ce jeu, donc sans inconvénient. Retirée le 05/10/2026 par erreur, puis remise le 09/10 : sur le téléphone de test, cette limite n'était même pas appliquée (`ro.surface_flinger.enable_frame_rate_override=false`).
- **Version finale et optimisation du code (R8)** : `app/proguard-rules.pro` garde la base de données de WorkManager (utilisée par les pubs). Sans cette règle, la version Play Store plantait au démarrage. Après une mise à jour des bibliothèques ou du plugin Android, installer la version finale sur un téléphone et vérifier qu'elle s'ouvre.
