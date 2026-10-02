# Icônes de Présidentielle 2027 : Le Jeu

## Fichier à envoyer sur le Play Store

Dans la Play Console, ouvre la fiche de l'application et envoie **`icone-512-v2.png`** dans le champ de l'icône. Ce fichier mesure 512 × 512 pixels, possède un fond entièrement opaque et pèse moins de 1 Mio. Les coins restent carrés dans le fichier : Google Play les arrondit lors de l'affichage.

Le visuel reprend l'illustration existante du jeu. La génération d'un nouveau dessin n'a pas pu aboutir, car la limite d'utilisation du service d'images était atteinte. L'ancien fichier `icone-512.png` et les anciennes ressources Android sont conservés.

## Icône sur le téléphone

Le manifeste Android utilise déjà les nouvelles ressources `ic_launcher_v2` et `ic_launcher_round_v2`. Il suffit de reconstruire l'application pour les embarquer :

```bash
npm run android:test
```

Cette commande produit un APK de test à installer sur le téléphone. Pour préparer le fichier destiné au Play Store, utilise `npm run android` avec la clé de signature configurée comme expliqué dans [le guide Android](../LISEZMOI.md).

| Versions Android | Ressources utilisées |
|---|---|
| Android 7 | Images classiques de 48, 72, 96, 144 et 192 pixels, avec variante ronde |
| Android 8 et suivantes | Icône adaptative : fond et illustration séparés, avec une marge transparente |
| Android 13 et suivantes | Calque monochrome « 2027 » et couronne, si le thème des icônes est activé |

Les calques adaptatifs mesurent 108, 162, 216, 324 et 432 pixels selon la précision de l'écran. L'illustration conserve ses proportions dans une zone centrale de 60 dp. Le lanceur du téléphone choisit la forme finale. Le calque monochrome utilise des chiffres de style arcade et reste dans le cercle central de sécurité de 66 dp.

L'écran de démarrage d'Android 12 utilise aussi le nouveau calque. `apercu-icones-v2.png` montre une simulation des affichages, avec des miniatures de 48 pixels. Cet aperçu sert à vérifier le rendu ; il ne faut pas l'envoyer comme icône dans la Play Console.

## Recréer les fichiers

La source conservée se trouve à `assets/generated/masters/application-icone-v1.png`. Le script n'effectue aucune nouvelle génération de dessin : il exporte les tailles Android, ajoute les marges et les masques nécessaires, puis crée le calque monochrome et l'aperçu.

```bash
python scripts/export-android-icons.py
```

Ce script nécessite Python et Pillow. Ils servent uniquement à recréer les images ; aucune dépendance n'est ajoutée au jeu. Il vérifie les dimensions, la transparence, le poids du fichier Play Store et les coordonnées du calque monochrome.

Spécifications : [icône Google Play](https://developer.android.com/distribute/google-play/resources/icon-design-specifications) et [icônes adaptatives Android](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive).
