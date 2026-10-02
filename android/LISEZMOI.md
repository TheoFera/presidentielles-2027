# Application Android — du projet au Play Store

Ce dossier contient l'application Android de « Présidentielle 2027 : Le Jeu ». Elle affiche le jeu web en plein écran, en paysage, **sans connexion Internet nécessaire** (sauf pour le multijoueur entre téléphones). Les fichiers du jeu viennent de `dist/`, produit automatiquement à partir des sources.

- Identifiant Play Store : `fr.presidentielles2027.jeu` (définitif après la première publication).
- Android 7.0 minimum, cible Android 16 (API 36), exigence actuelle de Google.
- Poids : environ 120 Mo (images WebP sans perte, décors betatest non inclus).

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
4. **Fiche du Play Store** : textes, catégorie et réponses aux questionnaires dans [`play-store/fiche-play-store.md`](play-store/fiche-play-store.md). Envoie l'icône `play-store/icone-512-v2.png` et la bannière dans `play-store/`. Les icônes du téléphone sont déjà intégrées au projet : voir [le guide des icônes](play-store/icones.md). Ajoute 2 à 8 captures d'écran prises sur ton téléphone.
5. **Test fermé obligatoire** : pour un compte personnel récent, Google exige un test fermé avec **au moins 12 testeurs pendant 14 jours d'affilée** avant d'autoriser la publication publique. Crée un *Test fermé*, envoie le fichier `.aab`, puis invite tes testeurs (leurs adresses Gmail).
6. **Production** : une fois le test validé, demande l'accès à la production, envoie le même `.aab` (ou une version plus récente) et lance le déploiement. Google examine l'application, souvent en quelques jours.

## 5. Publier une mise à jour

1. Dans `android/app/build.gradle`, augmente `versionCode` de 1 (2, 3, 4…) et change `versionName` (par exemple `1.0.1`).
2. Relance `npm run android`.
3. Dans la Play Console, crée une nouvelle version et envoie le nouveau `.aab`.

## Bon à savoir

- Le jeu exporté (`dist/`) est reconstruit à chaque `npm run android` : ne modifie jamais `dist/` à la main.
- La première conversion des images en WebP prend quelques minutes (avec `ffmpeg`), ensuite elle est gardée dans `.cache/webp/`.
- Le mode multijoueur « Avec un serveur local » n'existe pas dans l'application ; le mode « Entre téléphones » fonctionne.
- Le jeu met en scène des personnalités politiques réelles de façon parodique. Google peut refuser une application qui laisse croire à un lien officiel : la description précise qu'il s'agit d'une parodie non affiliée. Ce n'est pas un avis juridique.
- Connexion au compte PartageTonJeu : l'appli utilise la connexion Google native (Credential Manager), car Google refuse les connexions dans une WebView. Il faut créer un client OAuth « Android » avec l'empreinte SHA-1 de chaque clé de signature (test et Play Store) : voir `docs/comptes-partagetonjeu.md`, « Ce qu'il reste à configurer ».
