# Économiser le contexte et préparer le mobile

## Pour tes prochains prompts

Le petit fichier `AGENTS.md` à la racine oriente Codex vers les bons dossiers. Les longs guides restent disponibles à la demande. Exemple de prompt :

> Dans le menu de pause, agrandis le bouton Reprendre sur téléphone. Conserve le comportement actuel et vérifie le test concerné.

Décris le résultat attendu et le problème observé ; inutile de joindre tous les fichiers du jeu. Une tâche précise limite les recherches nécessaires. Les économies exactes de tokens dépendent de la demande et ne sont pas garanties.

`.rgignore` masque les archives, productions graphiques et rapports dans les recherches courantes de ripgrep. Il ne supprime rien et n'empêche pas Codex de lire un fichier utile. Pour une recherche exceptionnelle : `rg --no-ignore -n "motif" visual_codex`. `.gitignore` évite d'ajouter de nouveaux rapports locaux ; les fichiers déjà suivis par Git restent suivis.

Les consignes restent courtes car elles font elles-mêmes partie du contexte de Codex. Voir la [documentation officielle sur AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

## Ce qui sera embarqué

Lance `npm run build` pour préparer `dist/`. La commande affiche le nombre de fichiers et leur poids non compressé en Mio. Ce dossier est la base web à embarquer dans une future application mobile ; il ne constitue pas encore une application Android ou iOS.

L'export contient la page d'accueil, les modules JavaScript, les styles, les licences tierces, les cinq fichiers de configuration et les PNG référencés par les sources exportées. Les JSON exportés sont compactés ; leurs sources restent lisibles.

Les documents, consignes Codex, tests, scripts de développement, ZIP, captures, registres de production, pages de prévisualisation et images originales ne sont pas copiés. Ils occupent donc **zéro octet dans le paquet**, même s'ils restent sur ton ordinateur. Cette exclusion existait déjà pour une grande partie des documents et originaux.

`dist/` est recréé à chaque export pour ne pas conserver d'anciens fichiers. Ne mets aucun document personnel dedans. Une destination personnalisée passée à `buildPages()` doit être vide ; seule la destination standard `dist/` est nettoyée automatiquement.

## Pour les futures évolutions

- Configurer l'outil mobile pour embarquer uniquement `dist/`, jamais la racine du projet. Le poids final inclura aussi les composants Android/iOS.
- Les images dominent le poids. Les originaux sont conservés pour permettre de futures retouches ; aucune compression destructive n'est appliquée.
- Les chemins PNG doivent rester explicites dans le manifeste, le HTML ou le CSS, au format `assets/generated/catégorie/fichier.png` avec les noms techniques ASCII actuels. Si tu ajoutes un autre format, des sons, des polices ou des chemins construits dynamiquement, adapter le script d'export et ses tests.
- Toutes les entrées du manifeste sont conservées, même chargées seulement dans certaines scènes. Un visuel abandonné doit être retiré du manifeste après vérification de ses usages. Le registre de production peut conserver son historique.
- Les modules JS/CSS sont conservés sans minification ; éliminer automatiquement du code demanderait une étape de compilation supplémentaire et des vérifications dédiées.
- Après une modification de l'export : `node --test test/pages.test.js`, puis `npm run build`.

La simulation et le multijoueur ne sont pas modifiés par cette optimisation. L'intégration native et la vérification sur téléphone seront des étapes distinctes.
