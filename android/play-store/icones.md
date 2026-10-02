# Icônes de Présidentielle 2027 : Le Jeu

## Fichier à envoyer sur le Play Store

Dans la Play Console, ouvre la fiche de l'application et envoie **`icone-512-v2.png`** dans le champ de l'icône. Ce fichier mesure 512 × 512 pixels, possède un fond entièrement opaque et pèse moins de 1 Mio. Les coins restent carrés dans le fichier : Google Play les arrondit lors de l'affichage.

Le visuel reprend le style de l'illustration du jeu, avec le titre « PRÉSIDENTIELLE 2027 » corrigé au singulier et recentré. Les anciennes icônes au pluriel ont été supprimées du projet et des ressources Android.

L'image d'accueil et la bannière `banniere-1024x500.png` portent également le titre au singulier. Les visuels ont été retouchés avec l'outil intégré de génération d'images ; les [consignes exactes et les chemins des fichiers](../../docs/production/icones-application-v3.json) sont conservés dans le projet.

## Icône sur le téléphone

Le manifeste Android utilise déjà les nouvelles ressources `ic_launcher_v2` et `ic_launcher_round_v2`. Il suffit de reconstruire l'application pour les embarquer :

```bash
npm run android:test
```

Cette commande produit un APK de test à installer sur le téléphone. Pour préparer le fichier destiné au Play Store, utilise `npm run android` avec la clé de signature configurée comme expliqué dans [le guide Android](../LISEZMOI.md).

| Versions Android | Ressources utilisées |
|---|---|
| Android 7 | Images classiques de 48, 72, 96, 144 et 192 pixels, avec variante ronde |
| Android 8 et suivantes | Icône adaptative : illustration couvrant toute la forme ronde ou arrondie, sans bord sombre |
| Android 13 et suivantes | Calque monochrome « 2027 » et couronne, si le thème des icônes est activé |

Les calques adaptatifs mesurent 108, 162, 216, 324 et 432 pixels selon la précision de l'écran. L'illustration conserve ses proportions et remplit les 72 dp centraux affichés par le lanceur. Les pixels de ses bords prolongent le décor dans les 18 dp extérieurs réservés aux animations : il n'y a plus de marge transparente laissant apparaître un cadre sombre. Le lanceur du téléphone choisit la forme finale. Le calque monochrome utilise des chiffres de style arcade et reste dans le cercle central de sécurité de 66 dp.

L'écran de démarrage d'Android 12 utilise aussi le nouveau calque. `apercu-icones-v2.png` montre une simulation des affichages, avec des miniatures de 48 pixels. Cet aperçu sert à vérifier le rendu ; il ne faut pas l'envoyer comme icône dans la Play Console.

## Recréer les fichiers

La source conservée se trouve à `assets/generated/masters/application-icone-v3.png`. Le script n'effectue aucune nouvelle génération de dessin : il exporte les tailles Android, prolonge les bords de l'image pour remplir le calque adaptatif, applique les masques nécessaires, puis crée le calque monochrome et l'aperçu. La source actuelle de l'accueil se trouve à `assets/generated/masters/accueil-singulier-v3.png`. Ces sources restent hors du dossier `dist/` embarqué dans l'application.

```bash
python scripts/export-android-icons.py
```

Ce script nécessite Python et Pillow. Ils servent uniquement à recréer les images ; aucune dépendance n'est ajoutée au jeu. Il vérifie les dimensions, l'absence de marges transparentes dans le calque adaptatif, l'intégrité de l'illustration centrale, le poids du fichier Play Store et les coordonnées du calque monochrome.

Spécifications : [icône Google Play](https://developer.android.com/distribute/google-play/resources/icon-design-specifications) et [icônes adaptatives Android](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive).
